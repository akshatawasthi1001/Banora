"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { PublicNav } from "@/components/public-nav";
import { ApiRequestError, apiGet } from "@/lib/api/client";
import type { ContractorList, ContractorProfile, RatingSummary } from "@/lib/api/types";

interface ContractorFilters {
  search: string;
  city: string;
  state: string;
  experience: string;
}

const initialFilters: ContractorFilters = { search: "", city: "", state: "", experience: "" };

export default function ContractorsPage() {
  const [filters, setFilters] = useState<ContractorFilters>(() => {
    if (typeof window === "undefined") return initialFilters;
    const params = new URLSearchParams(window.location.search);
    return { search: params.get("search") ?? "", city: params.get("city") ?? "", state: params.get("state") ?? "", experience: params.get("experience_years_min") ?? "" };
  });
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadContractors(nextPage: number, nextFilters: ContractorFilters) {
    setIsLoading(true);
    const query = new URLSearchParams({ page: String(nextPage), page_size: "12" });
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) query.set(key === "experience" ? "experience_years_min" : key, value);
    });
    window.history.replaceState(null, "", `/contractors?${query.toString()}`);
    try {
      const response = await apiGet<ContractorList>(`/contractors?${query.toString()}`);
      setContractors(response.items);
      setPage(response.page);
      setTotalPages(response.total_pages);
      setTotal(response.total);
      setError(null);
      const ratingEntries = await Promise.all(response.items.map(async (contractor) => {
        try {
          return [contractor.id, await apiGet<RatingSummary>(`/contractors/${contractor.id}/rating`)] as const;
        } catch {
          return null;
        }
      }));
      setRatings(Object.fromEntries(ratingEntries.filter((entry): entry is readonly [string, RatingSummary] => entry !== null)));
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not load contractors right now.");
      setContractors([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlFilters = { search: params.get("search") ?? "", city: params.get("city") ?? "", state: params.get("state") ?? "", experience: params.get("experience_years_min") ?? "" };
    void (async () => { await loadContractors(Number(params.get("page") ?? "1"), urlFilters); })();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadContractors(1, filters);
  }

  function clearFilters() {
    setFilters(initialFilters);
    void loadContractors(1, initialFilters);
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]"><PublicNav /><div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12"><header className="max-w-3xl border-b border-[#d7d8d1] pb-10 pt-10 sm:pt-16"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">The Banora network</p><h1 className="mt-4 text-5xl font-black leading-[0.96] tracking-[-0.07em] text-[#183c31] sm:text-7xl">Find trusted contractors.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-[#607068]">Explore the people behind the work, see their experience, and choose with more confidence.</p></header><form onSubmit={handleSubmit} className="mt-8 grid gap-3 rounded-2xl border border-[#d7d8d1] bg-white p-4 shadow-[0_10px_30px_rgba(24,60,49,0.04)] md:grid-cols-[1.5fr_1fr_1fr_0.7fr_auto_auto]"><input aria-label="Search contractors" className="rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#183c31]" placeholder="Search name or company" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /><input aria-label="City" className="rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#183c31]" placeholder="City" value={filters.city} onChange={(event) => setFilters({ ...filters, city: event.target.value })} /><input aria-label="State" className="rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#183c31]" placeholder="State" value={filters.state} onChange={(event) => setFilters({ ...filters, state: event.target.value })} /><input aria-label="Minimum experience" className="rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#183c31]" type="number" min="0" placeholder="Years" value={filters.experience} onChange={(event) => setFilters({ ...filters, experience: event.target.value })} /><button className="rounded-xl bg-[#183c31] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#285847]" type="submit">Search</button><button className="rounded-xl px-3 py-3 text-sm font-bold text-[#607068] hover:text-[#183c31]" type="button" onClick={clearFilters}>Clear</button></form><div className="mt-8 flex items-center justify-between"><p className="text-sm font-semibold text-[#607068]">{isLoading ? "Finding contractors..." : `${total} contractor${total === 1 ? "" : "s"} found`}</p>{totalPages > 1 && <div className="flex items-center gap-2"><button disabled={page <= 1 || isLoading} onClick={() => void loadContractors(page - 1, filters)} className="rounded-lg border border-[#cdd2cb] px-3 py-2 text-xs font-bold text-[#365048] disabled:opacity-40">Previous</button><span className="px-2 text-xs font-bold text-[#607068]">{page} / {totalPages}</span><button disabled={page >= totalPages || isLoading} onClick={() => void loadContractors(page + 1, filters)} className="rounded-lg border border-[#cdd2cb] px-3 py-2 text-xs font-bold text-[#365048] disabled:opacity-40">Next</button></div>}</div>{error && <div className="mt-5 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]" role="alert">{error}</div>}{!isLoading && !error && contractors.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-[#b9c2ba] bg-white px-6 py-16 text-center"><p className="text-xl font-black text-[#183c31]">No contractors found.</p><p className="mt-3 text-sm text-[#607068]">Try a broader search or clear your filters.</p><button onClick={clearFilters} className="mt-6 rounded-lg bg-[#183c31] px-5 py-3 text-sm font-bold text-white">Clear filters</button></div>}{isLoading && <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-white" />)}</div>}{!isLoading && contractors.length > 0 && <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{contractors.map((contractor) => <ContractorCard key={contractor.id} contractor={contractor} rating={ratings[contractor.id]} />)}</div>}</div></main>
  );
}

function ContractorCard({ contractor, rating }: { contractor: ContractorProfile; rating?: RatingSummary }) {
  return <article className="group flex min-h-72 flex-col rounded-2xl border border-[#d7d8d1] bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)] transition hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(24,60,49,0.1)]"><div className="flex items-start justify-between gap-4"><div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#d9c6ae] text-xl font-black text-[#183c31]">{contractor.profile_image_url ? <img className="h-full w-full object-cover" src={contractor.profile_image_url} alt={`${contractor.name} profile`} /> : contractor.name.slice(0, 1).toUpperCase()}</div>{rating && rating.review_count > 0 && <span className="rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-black text-[#a3482d]">★ {rating.average_rating.toFixed(1)}</span>}</div><div className="mt-6"><h2 className="text-2xl font-black tracking-[-0.05em] text-[#183c31]">{contractor.name}</h2><p className="mt-1 text-sm font-semibold text-[#607068]">{contractor.company_name ?? "Independent contractor"}</p><p className="mt-4 text-sm text-[#607068]">{contractor.city}, {contractor.state}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-[#607068]">{contractor.bio ?? "A Banora contractor ready to share their work."}</p></div><div className="mt-auto flex items-end justify-between border-t border-[#e9e9e3] pt-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a9890]">{contractor.experience_years} years experience</p><Link href={`/contractors/${contractor.id}`} className="text-sm font-black text-[#e26d42] hover:text-[#a3482d]">View profile ↗</Link></div></article>;
}
