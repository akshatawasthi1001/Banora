import Link from "next/link";

import { PublicNav } from "@/components/public-nav";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]">
      <PublicNav />
      <div className="mx-auto flex max-w-7xl flex-col items-center px-5 py-24 text-center sm:px-8 lg:px-12">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">404 — Page not found</p>
        <h1 className="mt-4 text-5xl font-black leading-[0.98] tracking-[-0.07em] text-[#183c31] sm:text-6xl">
          This page went off-plan.
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-[#607068]">
          The page you are looking for does not exist or may have been moved.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-[#183c31] px-7 py-3.5 text-center text-sm font-bold text-white transition hover:bg-[#285847]"
          >
            Back to home
          </Link>
          <Link
            href="/contractors"
            className="rounded-full border border-[#aab8af] px-7 py-3.5 text-center text-sm font-bold text-[#365048] transition hover:border-[#183c31] hover:bg-white"
          >
            Find contractors
          </Link>
        </div>
      </div>
    </main>
  );
}
