"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { PublicNav } from "@/components/public-nav";
import { ApiRequestError, apiGet } from "@/lib/api/client";
import type { ContractorList, ContractorProfile, RatingSummary } from "@/lib/api/types";

interface ContractorFilters {
  search: string;
  city: string;
  state: string;
  experience: string;
}

const emptyFilters: ContractorFilters = { search: "", city: "", state: "", experience: "" };
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;
const EXPERIENCE_OPTIONS = ["1", "3", "5", "10"];

/** Build a query containing ONLY parameters the backend understands. */
function toQuery(filters: ContractorFilters, page: number): URLSearchParams {
  const query = new URLSearchParams();
  query.set("page", String(page));
  query.set("page_size", String(PAGE_SIZE));
  if (filters.search) query.set("search", filters.search);
  if (filters.city) query.set("city", filters.city);
  if (filters.state) query.set("state", filters.state);
  if (filters.experience) query.set("experience_years_min", filters.experience);
  return query;
}

// Monotonic request id (module-level is fine: only monotonicity matters, not
// instance identity). Only the most recent load may commit state, so rapid
// filter/page changes can never let a stale response overwrite newer results.
let contractorListRequestSeq = 0;

function parseExperience(value: string): string {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0) return "";
  return String(Math.floor(parsed));
}

function readFiltersFromUrl(): { filters: ContractorFilters; page: number } {
  const params = new URLSearchParams(window.location.search);
  return {
    filters: {
      search: params.get("search") ?? "",
      city: params.get("city") ?? "",
      state: params.get("state") ?? "",
      experience: parseExperience(params.get("experience_years_min") ?? ""),
    },
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

export default function ContractorsPage() {
  // Lazy initializers restore a shared/bookmarked URL on the first client render
  // without synchronous setState inside effects.
  const [filters, setFilters] = useState<ContractorFilters>(() =>
    typeof window === "undefined" ? emptyFilters : readFiltersFromUrl().filters,
  );
  const [draftFilters, setDraftFilters] = useState<ContractorFilters>(filters);
  const [page, setPage] = useState(() => (typeof window === "undefined" ? 1 : readFiltersFromUrl().page));
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedOnceRef = useRef(false);

  const loadContractors = useCallback(async (nextPage: number, nextFilters: ContractorFilters) => {
    const requestId = ++contractorListRequestSeq;
    const isCurrent = () => contractorListRequestSeq === requestId;
    setIsLoading(true);
    const query = toQuery(nextFilters, nextPage);
    window.history.replaceState(null, "", `/contractors?${query.toString()}`);
    try {
      const response = await apiGet<ContractorList>(`/contractors?${query.toString()}`);
      if (!isCurrent()) return;
      setContractors(response.items);
      setPage(response.page);
      setTotalPages(response.total_pages);
      setTotal(response.total);
      setError(null);
      const ratingEntries = await Promise.all(
        response.items.map(async (contractor) => {
          try {
            return [contractor.id, await apiGet<RatingSummary>(`/contractors/${contractor.id}/rating`)] as const;
          } catch {
            return null;
          }
        }),
      );
      if (!isCurrent()) return;
      setRatings(
        Object.fromEntries(
          ratingEntries.filter((entry): entry is readonly [string, RatingSummary] => entry !== null),
        ),
      );
    } catch (requestError) {
      if (!isCurrent()) return;
      setError(
        requestError instanceof ApiRequestError
          ? requestError.detail
          : "We could not load contractors right now.",
      );
      setContractors([]);
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, []);

  // Initial load once; filters/page already come from the URL via lazy state.
  useEffect(() => {
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    void loadContractors(page, filters);
  }, [loadContractors, page, filters]);

  // Debounced commit for text inputs (search/city/state): the timer callback runs
  // asynchronously, so committing here never trips set-state-in-effect.
  useEffect(() => {
    if (!loadedOnceRef.current) return;
    if (
      draftFilters.search === filters.search &&
      draftFilters.city === filters.city &&
      draftFilters.state === filters.state
    ) {
      return;
    }
    const timer = setTimeout(() => {
      const committed: ContractorFilters = {
        search: draftFilters.search.trim(),
        city: draftFilters.city.trim(),
        state: draftFilters.state.trim(),
        experience: draftFilters.experience,
      };
      setDraftFilters(committed);
      setFilters(committed);
      setPage(1);
      void loadContractors(1, committed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftFilters, filters, loadContractors]);

  function applyFilters(updater: (current: ContractorFilters) => ContractorFilters) {
    const committed = updater(draftFilters);
    setDraftFilters(committed);
    setFilters(committed);
    setPage(1);
    void loadContractors(1, committed);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const committed: ContractorFilters = {
      search: draftFilters.search.trim(),
      city: draftFilters.city.trim(),
      state: draftFilters.state.trim(),
      experience: draftFilters.experience,
    };
    setDraftFilters(committed);
    setFilters(committed);
    setPage(1);
    void loadContractors(1, committed);
  }

  function clearFilters() {
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
    void loadContractors(1, emptyFilters);
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    void loadContractors(nextPage, filters);
  }

  const activeChips: { label: string; clear: () => void }[] = [
    ...(filters.search
      ? [{ label: `Search: "${filters.search}"`, clear: () => applyFilters((current) => ({ ...current, search: "" })) }]
      : []),
    ...(filters.city
      ? [{ label: `City: ${filters.city}`, clear: () => applyFilters((current) => ({ ...current, city: "" })) }]
      : []),
    ...(filters.state
      ? [{ label: `State: ${filters.state}`, clear: () => applyFilters((current) => ({ ...current, state: "" })) }]
      : []),
    ...(filters.experience
      ? [{ label: `${filters.experience}+ yrs experience`, clear: () => applyFilters((current) => ({ ...current, experience: "" })) }]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]">
      <PublicNav />
      <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">
        <header className="max-w-3xl border-b border-[#d7d8d1] pb-10 pt-10 sm:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">The Banora network</p>
          <h1 className="mt-4 text-5xl font-black leading-[0.96] tracking-[-0.07em] text-[#183c31] sm:text-7xl">
            Find trusted contractors.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#607068]">
            Explore the people behind the work, see their experience, and choose with more confidence.
          </p>
        </header>

        <form
          onSubmit={handleSearchSubmit}
          className="mt-8 grid gap-3 rounded-2xl border border-[#d7d8d1] bg-white p-4 shadow-[0_10px_30px_rgba(24,60,49,0.04)] md:grid-cols-[1.5fr_1fr_1fr_0.9fr_auto_auto]"
        >
          <input
            aria-label="Search contractors"
            className="rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#183c31]"
            placeholder="Search name or company"
            type="search"
            value={draftFilters.search}
            onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
          />
          <input
            aria-label="Filter by city"
            className="rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#183c31]"
            placeholder="City"
            value={draftFilters.city}
            onChange={(event) => setDraftFilters((current) => ({ ...current, city: event.target.value }))}
          />
          <input
            aria-label="Filter by state"
            className="rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#183c31]"
            placeholder="State"
            value={draftFilters.state}
            onChange={(event) => setDraftFilters((current) => ({ ...current, state: event.target.value }))}
          />
          <select
            aria-label="Minimum years of experience"
            className="rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 text-sm outline-none focus:border-[#183c31]"
            value={draftFilters.experience}
            onChange={(event) => applyFilters((current) => ({ ...current, experience: event.target.value }))}
          >
            <option value="">Any experience</option>
            {EXPERIENCE_OPTIONS.map((years) => (
              <option key={years} value={years}>
                {years}+ years
              </option>
            ))}
            {draftFilters.experience && !EXPERIENCE_OPTIONS.includes(draftFilters.experience) && (
              <option value={draftFilters.experience}>{draftFilters.experience}+ years</option>
            )}
          </select>
          <button
            className="rounded-xl bg-[#183c31] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#285847]"
            type="submit"
          >
            Search
          </button>
          <button
            className="rounded-xl px-3 py-3 text-sm font-bold text-[#607068] hover:text-[#183c31]"
            type="button"
            onClick={clearFilters}
          >
            Clear
          </button>
        </form>

        {activeChips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a9890]">
              Active filters ({activeChips.length})
            </span>
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.clear}
                aria-label={`Remove filter: ${chip.label}`}
                className="group inline-flex items-center gap-2 rounded-full border border-[#cdd2cb] bg-white px-3 py-1.5 text-xs font-bold text-[#365048] transition hover:border-[#183c31]"
              >
                {chip.label}
                <span aria-hidden="true" className="text-[#8a9890] group-hover:text-[#183c31]">×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-[#e26d42] hover:text-[#a3482d]"
            >
              Clear all filters
            </button>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#607068]">
            {isLoading ? "Finding contractors..." : `${total} contractor${total === 1 ? "" : "s"} found`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || isLoading}
                onClick={() => goToPage(page - 1)}
                className="rounded-lg border border-[#cdd2cb] px-3 py-2 text-xs font-bold text-[#365048] disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 text-xs font-bold text-[#607068]">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages || isLoading}
                onClick={() => goToPage(page + 1)}
                className="rounded-lg border border-[#cdd2cb] px-3 py-2 text-xs font-bold text-[#365048] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {error && (
          <div
            className="mt-5 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]"
            role="alert"
          >
            {error}
            <button
              type="button"
              onClick={() => void loadContractors(page, filters)}
              className="ml-3 underline underline-offset-2 hover:no-underline"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="ml-3 underline underline-offset-2 hover:no-underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {!isLoading && !error && contractors.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-[#b9c2ba] bg-white px-6 py-16 text-center">
            <p className="text-xl font-black text-[#183c31]">
              {activeChips.length > 0 ? "No contractors match your filters." : "No contractors yet."}
            </p>
            <p className="mt-3 text-sm text-[#607068]">Try a broader search or clear your filters.</p>
            <button
              onClick={clearFilters}
              className="mt-6 rounded-lg bg-[#183c31] px-5 py-3 text-sm font-bold text-white"
            >
              Clear filters
            </button>
          </div>
        )}

        {isLoading && (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-72 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        )}

        {!isLoading && contractors.length > 0 && (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {contractors.map((contractor) => (
              <ContractorCard key={contractor.id} contractor={contractor} rating={ratings[contractor.id]} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ContractorCard({ contractor, rating }: { contractor: ContractorProfile; rating?: RatingSummary }) {
  return (
    <article className="group flex min-h-72 flex-col rounded-2xl border border-[#d7d8d1] bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)] transition hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(24,60,49,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-[#d9c6ae] text-xl font-black text-[#183c31]">
          {contractor.profile_image_url ? (
            <img className="h-full w-full object-cover" src={contractor.profile_image_url} alt={`${contractor.name} profile`} />
          ) : (
            contractor.name.slice(0, 1).toUpperCase()
          )}
        </div>
        {rating && rating.review_count > 0 && (
          <span className="rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-black text-[#a3482d]">★ {rating.average_rating.toFixed(1)}</span>
        )}
      </div>
      <div className="mt-6">
        <h2 className="text-2xl font-black tracking-[-0.05em] text-[#183c31]">{contractor.name}</h2>
        <p className="mt-1 text-sm font-semibold text-[#607068]">{contractor.company_name ?? "Independent contractor"}</p>
        <p className="mt-4 text-sm text-[#607068]">{contractor.city}, {contractor.state}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#607068]">{contractor.bio ?? "A Banora contractor ready to share their work."}</p>
      </div>
      <div className="mt-auto flex items-end justify-between border-t border-[#e9e9e3] pt-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a9890]">{contractor.experience_years} years experience</p>
        <Link href={`/contractors/${contractor.id}`} className="text-sm font-black text-[#e26d42] hover:text-[#a3482d]">View profile ↗</Link>
      </div>
    </article>
  );
}
