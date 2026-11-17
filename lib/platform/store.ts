import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { GenerationJobSchema, type GenerationJob } from "../platform-ai/schema";
import { StoredDesignVersionSchema, type StoredDesignVersion } from "../platform-design/schema";
import {
  InvitationDraftSchema,
  type InvitationRecord,
  type PlatformUser,
  type RsvpRecord,
} from "./schema";

export type StoredUser = PlatformUser & { passwordHash: string };
export type StoredSession = {
  tokenHash: string;
  userId: string;
  expiresAt: string;
};
export type StoredRsvp = RsvpRecord & {
  invitationId: string;
  editTokenHash: string;
};
export type StoredMedia = {
  id: string;
  ownerId: string;
  invitationId: string;
  createdAt: string;
};
export type PlatformState = {
  version: 1;
  users: StoredUser[];
  sessions: StoredSession[];
  invitations: InvitationRecord[];
  rsvps: StoredRsvp[];
  media: StoredMedia[];
  loginAttempts: { key: string; count: number; resetAt: string }[];
  generationJobs: GenerationJob[];
  designVersions: StoredDesignVersion[];
};
const StateSchema = z
  .object({
    version: z.literal(1),
    users: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        createdAt: z.string(),
        passwordHash: z.string(),
      }),
    ),
    sessions: z.array(
      z.object({
        tokenHash: z.string(),
        userId: z.string(),
        expiresAt: z.string(),
      }),
    ),
    invitations: z.array(
      z.object({
        id: z.string(),
        ownerId: z.string(),
        slug: z.string(),
        status: z.enum(["draft", "published", "archived"]),
        draft: InvitationDraftSchema,
        published: z
          .object({ content: InvitationDraftSchema, publishedAt: z.string() })
          .nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    ),
    rsvps: z.array(
      z.object({
        id: z.string(),
        invitationId: z.string(),
        name: z.string(),
        email: z.string().optional(),
        status: z.enum(["yes", "no", "maybe"]),
        guestCount: z.number(),
        message: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
        editTokenHash: z.string(),
      }),
    ),
    media: z.array(
      z.object({
        id: z.string(),
        ownerId: z.string(),
        invitationId: z.string(),
        createdAt: z.string(),
      }),
    ),
    loginAttempts: z.array(
      z.object({ key: z.string(), count: z.number(), resetAt: z.string() }),
    ),
    generationJobs: z.array(GenerationJobSchema).default([]),
    designVersions: z.array(StoredDesignVersionSchema).default([]),
  })
  .strict();
const emptyState = (): PlatformState => ({
  version: 1,
  users: [],
  sessions: [],
  invitations: [],
  rsvps: [],
  media: [],
  loginAttempts: [],
  generationJobs: [],
  designVersions: [],
});

// All instances in one Node process serialize by directory. Multiple processes
// or network filesystems require a database, not this local MVP repository.
const lockKey = Symbol.for("invitation-platform.store-locks.v1");
const processState = globalThis as typeof globalThis & {
  [lockKey]?: Map<string, Promise<void>>;
};
const locks = (processState[lockKey] ??= new Map<string, Promise<void>>());
export class PlatformStore {
  readonly directory: string;
  constructor(
    directory = process.env.PLATFORM_DATA_DIR ||
      path.join(process.cwd(), ".platform-data"),
  ) {
    this.directory = path.resolve(directory);
  }
  async transaction<T>(
    operation: (state: PlatformState) => T | Promise<T>,
    write = true,
  ): Promise<T> {
    const previous = locks.get(this.directory) || Promise.resolve();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    locks.set(this.directory, pending);
    await previous;
    try {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const filename = path.join(this.directory, "state.json");
      let state: PlatformState;
      try {
        const parsed = StateSchema.safeParse(
          JSON.parse(await readFile(filename, "utf8")),
        );
        if (!parsed.success) throw new Error("Platform repository is invalid");
        state = parsed.data;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          state = emptyState();
        else throw error;
      }
      const result = await operation(state);
      if (write) {
        const temporary = `${filename}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, JSON.stringify(StateSchema.parse(state)), {
            mode: 0o600,
            flag: "wx",
          });
          await rename(temporary, filename);
        } finally {
          await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
      }
      return structuredClone(result);
    } finally {
      release();
      if (locks.get(this.directory) === pending) locks.delete(this.directory);
    }
  }
}
