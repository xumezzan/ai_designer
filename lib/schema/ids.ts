// Shared by browser schemas and filesystem readers; no server imports here.
export const safeId = (id: string) => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);
