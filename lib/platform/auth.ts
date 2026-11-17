import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { z } from "zod";
import type { PlatformUser } from "./schema";
import { PlatformStore, type StoredUser } from "./store";
import { PlatformError } from "./errors";

const HASH_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const deriveKey = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, HASH_OPTIONS, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_COOKIE = "invitation_session";
export const RegisterSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(10).max(128),
  })
  .strict();
export const LoginSchema = RegisterSchema.pick({ email: true, password: true });
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt);
  return `scrypt-v1$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [version, salt, expected] = encoded.split("$");
  if (
    version !== "scrypt-v1" ||
    !/^[a-f0-9]{32}$/.test(salt || "") ||
    !/^[a-f0-9]{128}$/.test(expected || "")
  )
    return false;
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}
export function publicUser(user: StoredUser): PlatformUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}
export class PlatformAuth {
  constructor(readonly store: PlatformStore) {}
  async register(input: unknown) {
    const data = RegisterSchema.parse(input);
    const passwordHash = await hashPassword(data.password);
    return this.store.transaction((state) => {
      if (state.users.some((user) => user.email === data.email))
        throw new PlatformError(
          409,
          "EMAIL_EXISTS",
          "Этот email уже зарегистрирован",
        );
      const user = {
        id: randomUUID(),
        name: data.name,
        email: data.email,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      state.users.push(user);
      const sessionToken = this.addSession(state.sessions, user.id);
      return { user: publicUser(user), sessionToken };
    });
  }
  private addSession(
    sessions: { tokenHash: string; userId: string; expiresAt: string }[],
    userId: string,
  ) {
    const now = Date.now();
    const live = sessions.filter(
      (session) =>
        Date.parse(session.expiresAt) > now && session.userId !== userId,
    );
    const own = sessions
      .filter(
        (session) =>
          Date.parse(session.expiresAt) > now && session.userId === userId,
      )
      .slice(-9);
    sessions.splice(0, sessions.length, ...live, ...own);
    const token = randomBytes(32).toString("hex");
    sessions.push({
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString(),
    });
    return token;
  }
  async login(input: unknown) {
    const data = LoginSchema.parse(input);
    const key = hashToken(data.email);
    const user = await this.store.transaction((state) => {
      const now = Date.now();
      state.loginAttempts = state.loginAttempts.filter(
        (attempt) => Date.parse(attempt.resetAt) > now,
      );
      let attempt = state.loginAttempts.find((item) => item.key === key);
      if (attempt && attempt.count >= 10)
        throw new PlatformError(
          429,
          "TOO_MANY_ATTEMPTS",
          "Слишком много попыток. Попробуйте через 15 минут",
        );
      if (!attempt) {
        if (state.loginAttempts.length >= 10000)
          throw new PlatformError(
            429,
            "TOO_MANY_ATTEMPTS",
            "Слишком много попыток. Попробуйте позднее",
          );
        attempt = {
          key,
          count: 0,
          resetAt: new Date(now + 15 * 60_000).toISOString(),
        };
        state.loginAttempts.push(attempt);
      }
      attempt.count++;
      return state.users.find((item) => item.email === data.email) || null;
    });
    // Equal scrypt work for unknown email and a wrong password.
    const valid = user
      ? await verifyPassword(data.password, user.passwordHash)
      : (await hashPassword(data.password), false);
    if (!user || !valid)
      throw new PlatformError(
        401,
        "INVALID_CREDENTIALS",
        "Неверный email или пароль",
      );
    return this.store.transaction((state) => {
      state.loginAttempts = state.loginAttempts.filter(
        (attempt) => attempt.key !== key,
      );
      return {
        user: publicUser(user),
        sessionToken: this.addSession(state.sessions, user.id),
      };
    });
  }
  async userForSession(
    token: string | undefined,
  ): Promise<PlatformUser | null> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return this.store.transaction((state) => {
      const session = state.sessions.find(
        (item) =>
          item.tokenHash === hashToken(token) &&
          Date.parse(item.expiresAt) > Date.now(),
      );
      const user =
        session && state.users.find((item) => item.id === session.userId);
      return user ? publicUser(user) : null;
    }, false);
  }
  async logout(token: string | undefined) {
    if (token)
      await this.store.transaction((state) => {
        state.sessions = state.sessions.filter(
          (session) => session.tokenHash !== hashToken(token),
        );
      });
  }
}
