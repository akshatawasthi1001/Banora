"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth-context";

export function PublicNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const links = [
    { href: "/", label: "Home" },
    { href: "/contractors", label: "Find contractors" },
  ];

  return (
    <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12" aria-label="Main navigation">
      <Link href="/" className="text-2xl font-black tracking-[-0.08em] text-[#183c31]">banora<span className="text-[#e26d42]">.</span></Link>
      <div className="flex items-center gap-2 sm:gap-5">
        {links.map((link) => <Link key={link.href} href={link.href} className={`hidden text-sm font-bold transition sm:inline-block ${pathname === link.href ? "text-[#e26d42]" : "text-[#607068] hover:text-[#183c31]"}`}>{link.label}</Link>)}
        {user?.role === "CONTRACTOR" ? <Link href="/dashboard" className="rounded-full bg-[#183c31] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#285847]">Dashboard</Link> : <Link href="/login" className="rounded-full border border-[#b9c2ba] px-4 py-2.5 text-xs font-bold text-[#365048] transition hover:border-[#183c31] hover:bg-white">Login</Link>}
      </div>
    </nav>
  );
}
