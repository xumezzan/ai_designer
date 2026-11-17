import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Run against an isolated local data directory, never against customer data.
const origin = process.env.PLATFORM_QA_BASE_URL;
if (!origin || !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) {
  throw new Error(
    "Set PLATFORM_QA_BASE_URL to the isolated local test server.",
  );
}
async function request(
  path,
  { cookie, body, method = "GET", expected = 200, headers = {} } = {},
) {
  const response = await fetch(`${origin}${path}`, {
    method,
    redirect: "manual",
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${await response
      .clone()
      .text()
      .then((x) => x.slice(0, 200))}`,
  );
  return response;
}
const tag = randomUUID();
const templateId = process.env.PLATFORM_QA_TEMPLATE || "botanical";
assert.ok(
  ["classic", "botanical", "nocturne", "heritage"].includes(templateId),
  "Unknown QA template",
);
const credentials = {
  email: `qa-${tag}@example.test`,
  name: "QA organizer",
  password: `qa-password-${tag}`,
};
const registration = await request("/api/platform/auth/register", {
  method: "POST",
  body: credentials,
});
assert.match(registration.headers.get("set-cookie"), /HttpOnly/i);
assert.match(registration.headers.get("set-cookie"), /SameSite=lax/i);
const cookie = registration.headers.get("set-cookie").split(";")[0];
await request("/api/platform/auth/me", { cookie });
await request("/api/platform/invitations", { expected: 401 });
const otherRegistration = await request("/api/platform/auth/register", {
  method: "POST",
  body: { ...credentials, email: `other-${tag}@example.test` },
});
const otherCookie = otherRegistration.headers.get("set-cookie").split(";")[0];
const draft = {
  title: "PRIVATE DASHBOARD TITLE",
  templateId,
  paletteId: templateId === "heritage" ? "cinnabar" : "sage",
  fontPairId: templateId === "heritage" ? "romantic" : "editorial",
  eventType: "wedding",
  locale: "uz-latn",
  names: ["Aziz", "Malika"],
  date: {
    day: "2027-05-24",
    time: "18:00",
    timezone: "Asia/Tashkent",
    showCountdown: true,
  },
  greeting: "Aziz yaqinlar, sizni kutamiz!",
  story: "PRIVATE DISABLED STORY",
  venue: { name: "QA Garden", address: "Toshkent" },
  timeline: [{ time: "18:00", title: "Mehmonlarni kutib olish" }],
  closing: "Ko‘rishguncha!",
  enabledSections: ["greeting", "date", "venue", "timeline", "rsvp", "closing"],
  media: [],
};
let invitation = (
  await (
    await request("/api/platform/invitations", {
      cookie,
      method: "POST",
      body: { draft },
      expected: 201,
    })
  ).json()
).invitation;
const path = `/api/platform/invitations/${invitation.id}`;
await request(path, { cookie: otherCookie, expected: 404 });
await request(`/i/${invitation.slug}`, { expected: 404 });
await request(path, {
  cookie,
  method: "PATCH",
  body: { draft, expectedUpdatedAt: "2000-01-01T00:00:00.000Z" },
  expected: 409,
});
invitation = (
  await (
    await request(`${path}/publish`, {
      cookie,
      method: "POST",
      body: { expectedUpdatedAt: invitation.updatedAt },
    })
  ).json()
).invitation;
const publicPath = `/api/platform/public/${invitation.slug}`;
const published = await (await request(publicPath)).json();
assert.ok(!JSON.stringify(published).includes("PRIVATE"));
assert.equal(published.invitation.content.greeting, draft.greeting);
const html = await (await request(`/i/${invitation.slug}`)).text();
assert.ok(html.includes("Aziz"));
if (templateId === "heritage")
  assert.ok(html.includes('data-studio-template="heritage"'));
assert.ok(!html.includes("PRIVATE DISABLED STORY"));
assert.ok(html.includes('name="robots"'));
draft.greeting = "UNPUBLISHED NEW GREETING";
invitation = (
  await (
    await request(path, {
      cookie,
      method: "PATCH",
      body: { draft, expectedUpdatedAt: invitation.updatedAt },
    })
  ).json()
).invitation;
assert.ok(
  !JSON.stringify(await (await request(publicPath)).json()).includes(
    "UNPUBLISHED",
  ),
);
const rsvpPath = `${publicPath}/rsvp`;
let rsvp = await (
  await request(rsvpPath, {
    method: "POST",
    body: { name: "QA Guest", status: "yes", guestCount: 2 },
  })
).json();
assert.match(rsvp.editToken, /^[0-9a-f]{64}$/);
rsvp = await (
  await request(rsvpPath, {
    method: "POST",
    body: {
      name: "QA Guest",
      status: "maybe",
      guestCount: 1,
      editToken: rsvp.editToken,
    },
  })
).json();
assert.equal(rsvp.response.status, "maybe");
const responses = await (await request(`${path}/rsvps`, { cookie })).json();
assert.equal(responses.responses.length, 1);
assert.ok(!JSON.stringify(responses).includes("editToken"));
await request(`${path}/rsvps`, { cookie: otherCookie, expected: 404 });
const native = await fetch(`${origin}${rsvpPath}`, {
  method: "POST",
  redirect: "manual",
  headers: {
    Origin: origin,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ name: "Native QA Guest", status: "no" }),
});
assert.equal(native.status, 303);
assert.match(native.headers.get("location"), /rsvp=saved/);
await request(`${path}/archive`, {
  cookie,
  method: "POST",
  body: { expectedUpdatedAt: invitation.updatedAt },
});
await request(publicPath, { expected: 404 });
await request(`/i/${invitation.slug}`, { expected: 404 });
await request("/api/platform/auth/logout", { cookie, method: "POST" });
await request(path, { cookie, expected: 401 });
await request("/api/platform/auth/login", {
  method: "POST",
  body: { email: credentials.email, password: credentials.password },
  headers: { Origin: "https://other.invalid" },
  expected: 403,
});
await request(
  "/_next/image?url=%2Fapi%2Fplatform%2Fmedia%2Fprivate&w=64&q=75",
  { expected: 404 },
);
if (process.env.PLATFORM_QA_PRODUCTION === "1") {
  await request("/studio", { expected: 404 });
  await request("/api/projects", { expected: 404 });
  await request("/preview/private/letter/1", { expected: 404 });
}
console.log(
  "PASS: HTTP auth, ownership, snapshots, hidden content, revision conflict, RSVP editing/native form, archive, logout, CSRF and image-cache boundary.",
);
