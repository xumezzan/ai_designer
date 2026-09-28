"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Logo, Spinner } from "./ui";
import { useAuth } from "@/lib/auth";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password, name || undefined);
      router.push("/app");
    } catch (err) {
      setError((err as Error).message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex flex-col p-8 md:p-14">
        <Link href="/"><Logo /></Link>
        <form onSubmit={submit} className="my-auto max-w-sm w-full mx-auto space-y-5">
          <div>
            <h1 className="display text-4xl">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-ink-2 mt-2">{mode === "login" ? "Log in to continue to your events." : "Start with a brief. Publish in an afternoon."}</p>
          </div>
          {mode === "signup" && (
            <Field label="Name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </Field>
          )}
          <Field label="Email">
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password" hint={mode === "signup" ? "At least 6 characters" : undefined}>
            <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-danger text-[13px]">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy && <Spinner />} {mode === "login" ? "Log in" : "Create account"}
          </button>
          <p className="text-[13px] text-ink-2 text-center">
            {mode === "login" ? (
              <>No account yet? <Link className="underline underline-offset-4" href="/signup">Sign up</Link></>
            ) : (
              <>Already have an account? <Link className="underline underline-offset-4" href="/login">Log in</Link></>
            )}
          </p>
        </form>
      </div>
      <div className="hidden md:block relative bg-surface-2 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/stock/wedding-1.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "contrast(.94) saturate(.85) sepia(.08)" }} />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="font-display text-4xl leading-tight drop-shadow">“Restraint is the most expensive thing you can put on a page.”</p>
        </div>
      </div>
    </div>
  );
}
