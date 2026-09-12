"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useRequireContractor } from "@/lib/auth-context";

const navigation = [
  { href: "/dashboard", label: "Overview", mark: "01" },
  { href: "/dashboard/profile", label: "Profile", mark: "02" },
  { href: "/dashboard/projects", label: "Projects", mark: "03" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useRequireContractor();

  if (auth.isLoading || !auth.user || auth.user.role !== "CONTRACTOR") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f1eb] text-[#183c31]">
        <div className="flex items-center gap-3 text-sm font-semibold text-[#607068]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#e26d42]" />
          Loading your workspace
        </div>
      </div>
    );
  }

  function handleLogout() {
    auth.logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-[#d7d8d1] bg-[#183c31] px-7 py-8 text-[#f4f1eb] lg:flex">
        <Link href="/" className="text-2xl font-black tracking-[-0.08em]">
          banora<span className="text-[#e26d42]">.</span>
        </Link>
        <div className="mt-16">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-[#91aaa0]">Workspace</p>
          <nav className="space-y-1" aria-label="Dashboard navigation">
            {navigation.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition ${active ? "bg-[#f4f1eb] text-[#183c31]" : "text-[#c6d3cc] hover:bg-[#285847] hover:text-white"}`}
                >
                  {item.label}
                  <span className="text-[10px] tracking-[0.16em] opacity-60">{item.mark}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto border-t border-[#44665a] pt-5">
          <p className="truncate text-sm font-semibold">{auth.user.email}</p>
          <p className="mt-1 text-xs text-[#91aaa0]">Contractor account</p>
          <button onClick={handleLogout} className="mt-5 text-sm font-semibold text-[#f0b39b] transition hover:text-white">
            Log out <span aria-hidden="true">↗</span>
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="flex items-center justify-between border-b border-[#d7d8d1] bg-[#f4f1eb]/95 px-5 py-5 backdrop-blur sm:px-8 lg:hidden">
          <Link href="/" className="text-2xl font-black tracking-[-0.08em] text-[#183c31]">
            banora<span className="text-[#e26d42]">.</span>
          </Link>
          <button onClick={handleLogout} className="text-sm font-bold text-[#365048]">Log out</button>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-[#d7d8d1] px-5 py-3 lg:hidden sm:px-8" aria-label="Mobile dashboard navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${pathname === item.href ? "bg-[#183c31] text-white" : "bg-white text-[#607068]"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
