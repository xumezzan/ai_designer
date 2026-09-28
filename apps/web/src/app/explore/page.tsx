import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { Showcase } from "@/components/Showcase";

export default function Explore() {
  return (
    <div>
      <SiteNav />
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24">
        <p className="eyebrow mb-3">Design directions</p>
        <h1 className="display text-4xl md:text-6xl max-w-3xl">Ten art directions. Infinite events.</h1>
        <p className="mt-5 max-w-xl text-ink-2">Each direction is a complete design language — composition, typography, spacing, image treatment and section rhythm. The AI picks three that fit your brief and adapts them to your palette and content.</p>
        <div className="mt-12">
          <Showcase limit={6} columns={2} linkTo="/signup" />
        </div>
        <div className="mt-16 text-center">
          <Link href="/signup" className="btn btn-primary btn-lg">Create your event</Link>
        </div>
      </section>
    </div>
  );
}
