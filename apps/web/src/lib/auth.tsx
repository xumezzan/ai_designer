"use client";
import { create } from "zustand";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken, type User } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  load: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  load: async () => {
    if (!getToken()) return set({ user: null, loading: false });
    try {
      const user = await api.auth.me();
      set({ user, loading: false });
    } catch {
      setToken(null);
      set({ user: null, loading: false });
    }
  },
  login: async (email, password) => {
    const r = await api.auth.login({ email, password });
    setToken(r.access_token);
    set({ user: r.user, loading: false });
  },
  signup: async (email, password, name) => {
    const r = await api.auth.signup({ email, password, name });
    setToken(r.access_token);
    set({ user: r.user, loading: false });
  },
  logout: () => {
    setToken(null);
    set({ user: null });
  },
}));

/** Client guard for /app routes. */
export function useRequireAuth() {
  const { user, loading, load } = useAuth();
  const router = useRouter();
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  return { user, loading };
}
