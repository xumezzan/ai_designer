import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { Showcase } from "@/components/Showcase";
import { Logo } from "@/components/ui";

const STEPS = [
  ["Tell us what you want", "Event type, names, date, venue — and a few sentences about the atmosphere you're after."],
  ["Add inspiration", "Drop in screenshots, Pinterest saves, photographs. The AI reads style, palette and composition."],
  ["AI creates 3 directions", "Three genuinely different design concepts — not three colourways of the same template."],
  ["Refine with AI", "“Make the hero more premium.” “Use olive only for accents.” Changes are surgical, never a rebuild."],
  ["Publish", "A public URL and a QR code. Guests open it on their phones; RSVPs land in your dashboard."],
];

const FEATURES = [
  ["AI Art Direction", "Style, mood, palette, typography and composition extracted from your brief and references."],
  ["Visual Editor", "Select, edit, drag, duplicate. Every text, image, colour and spacing is under your control."],
  ["AI Chat Editing", "Describe changes in plain language. Preview before → after, then apply."],
  ["Design System", "Every site is built from tokens and layout variants, so it always stays coherent — on desktop and mobile."],
  ["RSVP & Guests", "A working RSVP form, guest table and counts: confirmed, declined, total."],
  ["Publish & QR", "Your own URL, QR code, password protection and unpublish at any time. Custom domains next."],
];

export default function Landing() {
  return (
    <div>
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <p className="eyebrow mb-6">Event websites · Invitations · RSVP</p>
        <h1 className="display text-[44px] md:text-[80px] max-w-4xl">
          Beautiful event websites, <em className="not-italic text-ink-2">designed with AI.</em>
        </h1>
        <p className="mt-7 max-w-xl text-[17px] text-ink-2 leading-relaxed">
          Describe your event. Share your inspiration. Get a professionally designed website in minutes — then refine every detail by hand or in conversation.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/signup" className="btn btn-primary btn-lg">Create your event</Link>
          <Link href="/explore" className="btn btn-secondary btn-lg">Explore designs</Link>
        </div>
      </section>

      {/* Showcase */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="eyebrow mb-2">Made with Invito</p>
            <h2 className="display text-3xl md:text-4xl">Real, editable websites — not mockups</h2>
          </div>
          <Link href="/explore" className="hidden md:inline text-[13.5px] underline underline-offset-4">See all</Link>
        </div>
        <Showcase limit={6} />
      </section>

      {/* Quote */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="display text-2xl md:text-[40px] leading-tight">
            “I explained to a designer what I wanted, showed a few references — and got a finished, professional site.”
          </p>
          <p className="mt-5 text-muted text-sm">That is the whole product.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <p className="eyebrow mb-2">How it works</p>
        <h2 className="display text-3xl md:text-4xl mb-12">Five steps, one afternoon</h2>
        <ol className="grid md:grid-cols-5 gap-8">
          {STEPS.map(([t, b], i) => (
            <li key={t}>
              <p className="font-display text-3xl text-muted mb-3">0{i + 1}</p>
              <p className="font-medium mb-1.5">{t}</p>
              <p className="text-ink-2 text-[13px] leading-relaxed">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Principles */}
      <section className="bg-ink text-accent-ink">
        <div className="mx-auto max-w-6xl px-6 py-24 grid md:grid-cols-2 gap-12">
          <div>
            <p className="eyebrow mb-3 !text-[#9d998f]">Our design principles</p>
            <h2 className="display text-3xl md:text-[44px]">Better too simple and expensive than too decorated.</h2>
          </div>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13.5px] text-[#d8d4ca] self-end">
            {["Typography first", "Strong hierarchy", "Whitespace", "Intentional composition", "Restrained palette", "Consistent spacing", "Editorial layouts", "Sophisticated imagery", "Minimal, meaningful motion", "Mobile first"].map((p) => (
              <li key={p} className="border-b border-white/10 pb-2">{p}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <p className="eyebrow mb-2">Features</p>
        <h2 className="display text-3xl md:text-4xl mb-12">Everything between the idea and the guest&apos;s phone</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-px bg-line border border-line rounded-xl overflow-hidden">
          {FEATURES.map(([t, b]) => (
            <div key={t} className="bg-surface p-7">
              <p className="font-medium mb-2">{t}</p>
              <p className="text-ink-2 text-[13px] leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-28">
        <div className="card p-10 md:p-16 text-center">
          <h2 className="display text-3xl md:text-5xl">Your event deserves better than a template.</h2>
          <p className="text-ink-2 mt-4 max-w-md mx-auto">Start with a brief and a few references. You&apos;ll have three design directions in under a minute.</p>
          <Link href="/signup" className="btn btn-primary btn-lg mt-8">Create your event</Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between text-[13px] text-muted">
          <Logo />
          <p>© {new Date().getFullYear()} Invito AI. Designed for people who care how things look.</p>
        </div>
      </footer>
    </div>
  );
}
