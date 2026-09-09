import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f1eb] text-[#1d2a25]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 sm:px-10 lg:px-14">
        <nav className="flex items-center justify-between py-7" aria-label="Main navigation">
          <Link className="text-2xl font-black tracking-[-0.08em] text-[#183c31]" href="/">
            banora<span className="text-[#e26d42]">.</span>
          </Link>
          <a
            className="hidden rounded-full border border-[#b9c2ba] px-5 py-2.5 text-sm font-semibold text-[#365048] transition hover:border-[#183c31] hover:bg-white sm:inline-block"
            href="mailto:hello@banora.build"
          >
            Join the network
          </a>
        </nav>

        <section className="grid flex-1 items-center gap-14 pb-16 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:pb-24 lg:pt-16">
          <div>
            <p className="mb-7 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em] text-[#e26d42]">
              <span className="h-px w-8 bg-[#e26d42]" />
              Built for better builds
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.07em] text-[#183c31] sm:text-7xl lg:text-[5.5rem]">
              Find trusted contractors.
              <br />
              <span className="text-[#e26d42]">Build with confidence.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-8 text-[#607068]">
              See what they&apos;ve built, follow real progress, and connect with the people who can bring your next space to life.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a className="rounded-full bg-[#183c31] px-7 py-4 text-center text-sm font-bold text-[#f4f1eb] transition hover:bg-[#285847]" href="mailto:hello@banora.build">
                Explore Banora
              </a>
              <a className="rounded-full border border-[#aab8af] px-7 py-4 text-center text-sm font-bold text-[#365048] transition hover:border-[#183c31] hover:bg-white" href="mailto:hello@banora.build">
                I&apos;m a contractor
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -right-6 -top-7 h-28 w-28 rounded-full border border-[#d6b79a] sm:-right-10 sm:-top-10 sm:h-40 sm:w-40" />
            <div className="relative aspect-[0.86] overflow-hidden rounded-[2rem] bg-[#d9c6ae] shadow-[18px_20px_0_0_#e2dcd2]">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0_47%,rgba(24,60,49,0.13)_47%_48%,transparent_48%_100%),linear-gradient(45deg,transparent_0_57%,rgba(226,109,66,0.2)_57%_58%,transparent_58%_100%)]" />
              <div className="absolute bottom-0 left-0 right-0 h-[62%] bg-[#b68961]" />
              <div className="absolute bottom-[28%] left-[9%] h-[40%] w-[82%] border-[14px] border-[#f1e6d5] bg-[#80948a] shadow-[14px_14px_0_0_rgba(24,60,49,0.2)] sm:border-[20px]">
                <div className="absolute inset-x-0 top-[43%] h-3 bg-[#f1e6d5] sm:h-5" />
                <div className="absolute bottom-0 left-[28%] h-[58%] w-[21%] bg-[#d8b58f]" />
                <div className="absolute bottom-0 right-[12%] h-[43%] w-[18%] bg-[#e5c9a4]" />
              </div>
              <div className="absolute bottom-[12%] left-[14%] h-5 w-[72%] bg-[#183c31]" />
              <div className="absolute bottom-[8%] left-[23%] h-3 w-[54%] bg-[#e26d42]" />
              <span className="absolute left-6 top-6 rounded-full bg-[#f4f1eb] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#183c31]">Project / 001</span>
              <span className="absolute bottom-6 right-6 rounded-full bg-[#183c31] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#f4f1eb]">Ongoing</span>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-5 border-t border-[#cdd2cb] py-7 text-sm font-semibold text-[#607068] sm:flex-row sm:items-center sm:justify-between">
          <p>One place for the people behind the work.</p>
          <div className="flex gap-6 text-xs uppercase tracking-[0.16em] text-[#8a9890]">
            <span>Discover</span>
            <span>Verify</span>
            <span>Build</span>
          </div>
        </div>
      </div>
    </main>
  );
}
