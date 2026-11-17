import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, it } from "vitest";
import { createEmptyDraft } from "@/lib/platform/schema";
import { PlatformService } from "@/lib/platform/service";
import { PlatformStore } from "@/lib/platform/store";
import { platformTheme, resolvePlatformDesignSelection } from "@/lib/platform-render/theme";
import { toCssVars } from "@/lib/theme/toCssVars";
import { moodProfiles, resolveMoodProfile } from "@/registry/moodProfiles";
import { applyInvitationDesign, invitationDesign } from "./schema";
import { PlatformDesignService } from "./service";

const profileCases = [
  {
    id: "modern-editorial", templateId: "editorial", name: "Modern Editorial",
    palette: { bg: "#FAF9F6", surface: "#F3F1EC", ink: "#1A1A1A", accent: "#8C7A6B" },
    display: "Cormorant Garamond", body: "Inter", cyrillicFallback: undefined, radius: "0px",
  },
  {
    id: "botanical-haute", templateId: "botanical", name: "Botanical Haute",
    palette: { bg: "#F5F4F0", surface: "#EAE7DF", ink: "#2C352D", accent: "#B89778", accentAlt: "#8A9A86" },
    display: "Prata", body: "Manrope", cyrillicFallback: undefined, radius: "16px",
  },
  {
    id: "velvet-noir", templateId: "nocturne", name: "Velvet Noir",
    palette: { bg: "#0F0F0F", surface: "#1A1A1A", ink: "#E5E5E5", accent: "#D4AF37", accentAlt: "#737373" },
    display: "Bodoni Moda", body: "Montserrat", cyrillicFallback: "Cormorant Garamond", radius: "6px",
  },
] as const;

it.each(profileCases)("applies, publishes and restores $name through the saved design IDs", async (fixture) => {
  const directory = await mkdtemp(path.join(tmpdir(), "taklif-mood-profile-"));
  try {
    const platform = new PlatformService(new PlatformStore(directory));
    const designs = new PlatformDesignService(platform);
    const owner = (await platform.auth.register({
      name: "Fixture Host",
      email: "mood-profile@example.test",
      password: "local-test-password",
    })).user;
    const draft = {
      ...createEmptyDraft("classic"),
      names: ["Азиз", "Малика"],
      date: { day: "2028-06-12", time: "18:00", timezone: "Asia/Tashkent", showCountdown: true },
      venue: { name: "Тестовый зал", address: "Ташкент" },
      greeting: "Приглашаем на торжество!",
    };
    const invitation = await platform.createInvitation(owner.id, draft);
    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "ivory" } }).png().toBuffer();
    const photo = await platform.uploadMedia(owner.id, invitation.id, png);
    const withPhoto = await platform.updateInvitation(owner.id, invitation.id, { ...invitation.draft, media: [photo] }, invitation.updatedAt);
    const original = await platform.publishInvitation(owner.id, invitation.id, withPhoto.updatedAt);
    const profile = moodProfiles.find(({ id }) => id === fixture.id);
    if (!profile) throw new Error(`Missing mood profile ${fixture.id}`);

    const selected = await platform.updateInvitation(owner.id, invitation.id,
      applyInvitationDesign(original.draft, profile.selection), original.updatedAt);
    expect(invitationDesign(selected.draft)).toMatchObject({
      templateId: fixture.templateId, paletteId: fixture.id, fontPairId: fixture.id,
    });
    expect(invitationDesign(selected.draft)).toEqual(profile.selection);
    expect(selected.draft).toMatchObject({
      names: draft.names, date: draft.date, venue: draft.venue,
      greeting: draft.greeting, media: [photo],
    });
    expect((await platform.getPublicInvitation(invitation.slug))?.content).toEqual(original.published!.content);

    const theme = platformTheme(selected.draft);
    expect(theme.palette).toMatchObject(fixture.palette);
    const css = toCssVars(theme);
    expect(css["--font-display"]).toContain(`"${fixture.display}"`);
    if (fixture.cyrillicFallback) expect(css["--font-display"]).toContain(`"${fixture.cyrillicFallback}"`);
    expect(css["--font-body"]).toContain(`"${fixture.body}"`);
    expect(profile.css["--mood-radius"]).toBe(fixture.radius);
    expect(resolveMoodProfile(resolvePlatformDesignSelection(selected.draft))?.id).toBe(fixture.id);
    expect(resolveMoodProfile(resolvePlatformDesignSelection(original.draft))?.id).toBeUndefined();

    await designs.save(owner.id, invitation.id, { action: "save", expectedUpdatedAt: selected.updatedAt });
    const published = await platform.publishInvitation(owner.id, invitation.id, selected.updatedAt);
    const restarted = new PlatformService(new PlatformStore(directory));
    const history = new PlatformDesignService(restarted);
    const storedSnapshot = (await restarted.getPublicInvitation(invitation.slug))?.content;
    expect(storedSnapshot).toEqual(published.published!.content);
    expect(invitationDesign(storedSnapshot!)).toEqual(profile.selection);

    const replacement = await restarted.updateInvitation(owner.id, invitation.id, {
      ...applyInvitationDesign(published.draft, invitationDesign(original.draft)),
      greeting: "Обновлённое приглашение",
    }, published.updatedAt);
    expect((await restarted.getPublicInvitation(invitation.slug))?.content).toEqual(storedSnapshot);
    const [saved] = (await history.list(owner.id, invitation.id)).versions;
    expect(saved.design).toEqual(profile.selection);
    const restored = await history.restore(owner.id, invitation.id, {
      action: "restore", reference: saved.reference, expectedUpdatedAt: replacement.updatedAt,
    });
    expect(invitationDesign(restored.draft)).toEqual(profile.selection);
    expect(restored.draft.greeting).toBe(replacement.draft.greeting);
    expect(restored.draft.media).toEqual([photo]);
    expect((await restarted.getPublicInvitation(invitation.slug))?.content).toEqual(storedSnapshot);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
