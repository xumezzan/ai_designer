/**
 * Typed API client. All calls are relative (`/api/...`) and proxied by Next.js
 * to the FastAPI backend, so the browser never needs to know where the API lives.
 */
import type { DesignDocument, EditOperation } from "@/design/schema";

const TOKEN_KEY = "invito.token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) window.localStorage.setItem(TOKEN_KEY, t);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!(init.body instanceof FormData)) headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/public")) {
    setToken(null);
    if (!location.pathname.startsWith("/login") && !location.pathname.startsWith("/signup") && location.pathname.startsWith("/app")) {
      location.href = "/login";
    }
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {}
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const json = (body: unknown) => JSON.stringify(body);

/* ---------- types ---------- */
export interface User { id: string; email: string; name: string | null; plan: string }
export interface Project {
  id: string; name: string; event_type: string; status: string; event_date: string | null;
  brief: Record<string, unknown>; reference_analysis: ReferenceAnalysis | null; design: DesignDocument | null;
  design_version: number; slug: string | null; thumbnail_url: string | null; created_at: string; updated_at: string;
  is_published: boolean; public_url: string | null; rsvp_count: number;
}
export interface ReferenceAnalysis {
  style: string[]; colors: string[]; colorHex: string[]; typography: string; composition: string; mood: string[];
  decoration: string; imageStyle: string; referenceCount?: number;
}
export interface Reference { id: string; url: string; width: number | null; height: number | null; note: string | null; group: string | null; palette: string[] | null; position: number }
export interface Asset { id: string; url: string; filename: string | null; width: number | null; height: number | null; size: number; content_type: string }
export interface Generation { id: string; status: string; provider: string; style_profile: StyleProfile | null; concepts: DesignDocument[] | null; error: string | null }
export interface StyleProfile { summary: { style: string; palette: string[]; typography: string; composition: string; decoration: string; animation: string; imageTreatment: string; mood: string[] } }
export interface EditResponse { id: string; summary: string; operations: EditOperation[]; provider: string }
export interface DesignIssue { severity: "error" | "warning" | "info"; title: string; detail: string; operations: EditOperation[] }
export interface Publication { slug: string; is_live: boolean; url: string; published_at: string; views: number; has_password: boolean }
export interface RsvpRow { id: string; name: string; guests: number; attending: boolean | null; dietary: string | null; message: string | null; email: string | null; created_at: string }
export interface RsvpStats { total_responses: number; total_guests: number; confirmed: number; declined: number; pending: number }

/** Public URL of a published site, relative to wherever the app is served. */
export function publicUrlFor(slug: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/e/${slug}`;
}

/* ---------- client ---------- */
export const api = {
  auth: {
    signup: (b: { email: string; password: string; name?: string }) => request<{ access_token: string; user: User }>("/api/auth/signup", { method: "POST", body: json(b) }),
    login: (b: { email: string; password: string }) => request<{ access_token: string; user: User }>("/api/auth/login", { method: "POST", body: json(b) }),
    me: () => request<User>("/api/auth/me"),
  },
  projects: {
    list: () => request<Project[]>("/api/projects"),
    create: (b: { name: string; event_type: string; brief: Record<string, unknown> }) => request<Project>("/api/projects", { method: "POST", body: json(b) }),
    get: (id: string) => request<Project>(`/api/projects/${id}`),
    update: (id: string, b: Partial<Pick<Project, "name" | "event_type" | "brief" | "status">>) => request<Project>(`/api/projects/${id}`, { method: "PATCH", body: json(b) }),
    remove: (id: string) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" }),
    duplicate: (id: string) => request<Project>(`/api/projects/${id}/duplicate`, { method: "POST" }),
    saveDesign: (id: string, design: DesignDocument, source = "manual") => request<Project>(`/api/projects/${id}/design`, { method: "PUT", body: json({ design, source }) }),
    versions: (id: string) => request<{ id: string; version: number; source: string; created_at: string; conceptName: string | null }[]>(`/api/projects/${id}/versions`),
    restore: (id: string, versionId: string) => request<Project>(`/api/projects/${id}/versions/${versionId}/restore`, { method: "POST" }),
  },
  references: {
    list: (pid: string) => request<Reference[]>(`/api/projects/${pid}/references`),
    upload: (pid: string, file: File, note?: string) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<Reference>(`/api/projects/${pid}/references${note ? `?note=${encodeURIComponent(note)}` : ""}`, { method: "POST", body: fd });
    },
    fromUrl: (pid: string, url: string, note?: string) => request<Reference>(`/api/projects/${pid}/references/from-url`, { method: "POST", body: json({ url, note }) }),
    update: (pid: string, id: string, b: { note?: string | null; group?: string | null; position?: number }) => request<Reference>(`/api/projects/${pid}/references/${id}`, { method: "PATCH", body: json(b) }),
    remove: (pid: string, id: string) => request<{ ok: boolean }>(`/api/projects/${pid}/references/${id}`, { method: "DELETE" }),
  },
  assets: {
    list: (pid: string) => request<Asset[]>(`/api/projects/${pid}/assets`),
    upload: (pid: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<Asset>(`/api/projects/${pid}/assets`, { method: "POST", body: fd });
    },
    remove: (pid: string, id: string) => request<{ ok: boolean }>(`/api/projects/${pid}/assets/${id}`, { method: "DELETE" }),
  },
  ai: {
    analyzeReferences: (pid: string) => request<ReferenceAnalysis>(`/api/projects/${pid}/ai/analyze-references`, { method: "POST" }),
    generate: (pid: string) => request<Generation>(`/api/projects/${pid}/ai/generate-design`, { method: "POST" }),
    generation: (pid: string, gid: string) => request<Generation>(`/api/projects/${pid}/ai/generations/${gid}`),
    generations: (pid: string) => request<Generation[]>(`/api/projects/${pid}/ai/generations`),
    selectConcept: (pid: string, generation_id: string, index: number) => request<Project>(`/api/projects/${pid}/ai/select-concept`, { method: "POST", body: json({ generation_id, index }) }),
    edit: (pid: string, prompt: string, design: DesignDocument) => request<EditResponse>(`/api/projects/${pid}/ai/edit-design`, { method: "POST", body: json({ prompt, design }) }),
    markApplied: (pid: string, editId: string) => request<{ ok: boolean }>(`/api/projects/${pid}/ai/edits/${editId}/applied`, { method: "POST" }),
    check: (pid: string, design: DesignDocument) => request<{ score: number; issues: DesignIssue[] }>(`/api/projects/${pid}/ai/check-design`, { method: "POST", body: json({ design }) }),
    copy: (pid: string, design: DesignDocument) => request<{ summary: string; operations: EditOperation[] }>(`/api/projects/${pid}/ai/generate-copy`, { method: "POST", body: json({ design }) }),
  },
  publish: {
    get: (pid: string) => request<Publication | null>(`/api/projects/${pid}/publish`),
    publish: (pid: string, b: { slug?: string; password?: string | null }) => request<Publication>(`/api/projects/${pid}/publish`, { method: "POST", body: json(b) }),
    unpublish: (pid: string) => request<Publication>(`/api/projects/${pid}/publish`, { method: "DELETE" }),
    qr: (pid: string) => request<{ url: string; png_base64: string }>(`/api/projects/${pid}/publish/qr`),
  },
  rsvp: {
    list: (pid: string) => request<RsvpRow[]>(`/api/projects/${pid}/rsvps`),
    stats: (pid: string) => request<RsvpStats>(`/api/projects/${pid}/rsvps/stats`),
    remove: (pid: string, id: string) => request<{ ok: boolean }>(`/api/projects/${pid}/rsvps/${id}`, { method: "DELETE" }),
    submit: (slug: string, b: { name: string; guests: number; attending: boolean; dietary?: string; message?: string; email?: string }) =>
      request<{ ok: boolean }>(`/api/public/sites/${slug}/rsvp`, { method: "POST", body: json(b) }),
  },
  public: {
    site: (slug: string, password?: string) => request<{ slug: string; design: DesignDocument; project_id: string }>(`/api/public/sites/${slug}`, { headers: password ? { "X-Site-Password": password } : {} }),
    showcase: () => request<DesignDocument[]>("/api/public/showcase"),
  },
};
