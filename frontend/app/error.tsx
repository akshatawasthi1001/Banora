"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in browser/server logs; no user-facing details exposed.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 text-[#1d2a25]">
      <div className="w-full max-w-md rounded-2xl border border-[#d7d8d1] bg-white p-8 text-center shadow-[0_10px_30px_rgba(24,60,49,0.04)]">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">Something went wrong</p>
        <h1 className="mt-4 text-3xl font-black tracking-[-0.06em] text-[#183c31]">
          We hit an unexpected error.
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#607068]">
          Please try again. If the problem persists, come back in a few minutes.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 rounded-xl bg-[#183c31] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#285847]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
