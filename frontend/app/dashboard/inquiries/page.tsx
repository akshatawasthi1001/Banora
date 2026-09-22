"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiRequestError, apiGet } from "@/lib/api/client";
import { getMyInquiries } from "@/lib/api/inquiries";
import { getStoredReviewId } from "@/lib/api/reviews";
import { ContractorReviewPanel } from "@/components/review-form";
import { DashboardAccessPending } from "@/components/dashboard-shell";
import { useRequireClient } from "@/lib/auth-context";
import type { ContractorProfile, Inquiry, InquiryStatus } from "@/lib/api/types";

const statusStyles: Record<InquiryStatus, string> = {
  NEW: "bg-[#fff3ed] text-[#a3482d]",
  CONTACTED: "bg-[#edf4ff] text-[#315d91]",
  CLOSED: "bg-[#edf2ee] text-[#4f6259]",
};

const statusLabels: Record<InquiryStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CLOSED: "Closed",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function InquiriesPage() {
  const auth = useRequireClient();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [contractors, setContractors] = useState<
    Record<string, ContractorProfile>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | "ALL">("ALL");
  const [openReviewContractorId, setOpenReviewContractorId] = useState<string | null>(null);
  const [, setReviewStateVersion] = useState(0);

  useEffect(() => {
    if (auth.isLoading || !auth.user || auth.user.role !== "CLIENT") {
      return;
    }

    async function loadInquiries() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getMyInquiries(1, 20);
        setInquiries(response.items);

        // Resolve the contractor profile behind each inquiry so cards can
        // show a name instead of the raw UUID. Missing profiles fall back
        // to the shortened ID without failing the whole page.
        const uniqueContractorIds = [
          ...new Set(response.items.map((item) => item.contractor_profile_id)),
        ];

        const contractorEntries = await Promise.all(
          uniqueContractorIds.map(async (contractorId) => {
            try {
              const profile = await apiGet<ContractorProfile>(
                `/contractors/${contractorId}`,
              );
              return [contractorId, profile] as const;
            } catch {
              return null;
            }
          }),
        );

        setContractors(
          Object.fromEntries(
            contractorEntries.filter(
              (entry): entry is readonly [string, ContractorProfile] =>
                entry !== null,
            ),
          ),
        );
      } catch (requestError) {
        if (requestError instanceof ApiRequestError) {
          setError(requestError.detail);
        } else {
          setError("We could not load your inquiries. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadInquiries();
  }, [auth.isLoading, auth.user]);

  // Derived during render (no effect): which contractors have a review whose
  // id we remember, so cards can label the action appropriately. Callbacks
  // from the review panel bump reviewStateVersion to recompute after changes.
  const hasStoredReview: Record<string, boolean> = {};
  for (const contractorId of Object.keys(contractors)) {
    hasStoredReview[contractorId] = getStoredReviewId(contractorId) !== null;
  }

  // The backend list endpoint supports only page/page_size, so status filtering
  // is done here. Counts are computed from the loaded inquiries.
  const statusCounts: Record<InquiryStatus, number> = {
    NEW: inquiries.filter((item) => item.status === "NEW").length,
    CONTACTED: inquiries.filter((item) => item.status === "CONTACTED").length,
    CLOSED: inquiries.filter((item) => item.status === "CLOSED").length,
  };
  const visibleInquiries =
    statusFilter === "ALL"
      ? inquiries
      : inquiries.filter((item) => item.status === statusFilter);

  function handleReviewChanged() {
    setReviewStateVersion((version) => version + 1);
  }

  if (auth.isLoading) {
    return <DashboardAccessPending label="Loading your workspace" />;
  }

  if (!auth.hasAccess) {
    return <DashboardAccessPending label="Redirecting to your workspace..." />;
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">
            Client workspace
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[#183c31] sm:text-5xl">
            My inquiries.
          </h1>

          <p className="mt-4 max-w-xl text-base leading-7 text-[#607068]">
            Keep track of your conversations with contractors and follow the
            status of every request.
          </p>

          <p className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#8a9890]">
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusStyles.NEW}`}>New</span>
            <span aria-hidden="true">→</span>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusStyles.CONTACTED}`}>Contacted</span>
            <span aria-hidden="true">→</span>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusStyles.CLOSED}`}>Closed</span>
            <span className="ml-1">The contractor updates each inquiry as they respond.</span>
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7d8d1] bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#91aaa0]">
            Total inquiries
          </p>
          <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-[#183c31]">
            {inquiries.length}
          </p>
        </div>
      </div>

      {!isLoading && !error && inquiries.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Filter inquiries by status">
          {(["ALL", "NEW", "CONTACTED", "CLOSED"] as const).map((key) => {
            const count = key === "ALL" ? inquiries.length : statusCounts[key];
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                  active
                    ? "bg-[#183c31] text-white"
                    : "bg-white text-[#607068] hover:text-[#183c31]"
                }`
              }
              >
                {key === "ALL" ? "All" : statusLabels[key]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="mt-10 rounded-2xl border border-[#d7d8d1] bg-white p-8">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#607068]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#e26d42]" />
            Loading your inquiries...
          </div>
        </div>
      ) : error ? (
        <div
          className="mt-10 rounded-2xl border border-[#e8b9a8] bg-[#fff3ed] p-6 text-sm font-semibold text-[#a3482d]"
          role="alert"
        >
          {error}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-3 underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      ) : inquiries.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-[#d7d8d1] bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#edf2ee] text-xl">
            ✦
          </div>

          <h2 className="mt-6 text-2xl font-black tracking-[-0.04em] text-[#183c31]">
            No inquiries yet.
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#607068]">
            When you contact a contractor through Banora, your inquiry and its
            current status will appear here.
          </p>

          <Link
            href="/contractors"
            className="mt-7 inline-flex rounded-xl bg-[#e26d42] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c95731]"
          >
            Find contractors
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {visibleInquiries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#cdd2cb] bg-white px-6 py-12 text-center">
              <p className="text-lg font-black text-[#183c31]">No {statusFilter === "ALL" ? "" : statusLabels[statusFilter].toLowerCase()} inquiries.</p>
              <p className="mt-2 text-sm text-[#607068]">Try a different status filter.</p>
            </div>
          ) : (
          visibleInquiries.map((inquiry) => (
            <article
              key={inquiry.id}
              className="rounded-2xl border border-[#d7d8d1] bg-white p-6 transition hover:border-[#b8c0ba] sm:p-7"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${statusStyles[inquiry.status]}`}
                    >
                      {statusLabels[inquiry.status]}
                    </span>

                    <span className="text-xs font-semibold text-[#91aaa0]">
                      {formatDate(inquiry.created_at)}
                    </span>
                  </div>

                  <h2 className="mt-4 text-xl font-black tracking-[-0.03em] text-[#183c31]">
                    {inquiry.subject}
                  </h2>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#607068]">
                    {inquiry.message}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-[#e5e5df] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#91aaa0]">
                    Contractor inquiry
                  </p>

                  {contractors[inquiry.contractor_profile_id] ? (
                    <p className="mt-1 truncate text-sm font-bold text-[#183c31]">
                      {contractors[inquiry.contractor_profile_id].name}
                      <span className="ml-2 text-xs font-semibold text-[#607068]">
                        {contractors[inquiry.contractor_profile_id]
                          .company_name ?? "Independent contractor"}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1 break-all text-xs font-semibold text-[#607068]">
                      Contractor #{inquiry.contractor_profile_id.slice(0, 8)}
                    </p>
                  )}
                </div>

                {contractors[inquiry.contractor_profile_id] && (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenReviewContractorId(
                          openReviewContractorId === inquiry.contractor_profile_id
                            ? null
                            : inquiry.contractor_profile_id,
                        )
                      }
                      aria-expanded={openReviewContractorId === inquiry.contractor_profile_id}
                      className="inline-flex items-center justify-center rounded-xl border border-[#cdd2cb] bg-white px-4 py-2.5 text-xs font-black text-[#286047] transition hover:border-[#286047]"
                    >
                      {hasStoredReview[inquiry.contractor_profile_id]
                        ? "Update your review"
                        : "Leave a review"}
                    </button>

                    <Link
                      href={`/contractors/${inquiry.contractor_profile_id}`}
                      className="inline-flex items-center justify-center rounded-xl border border-[#cdd2cb] bg-white px-4 py-2.5 text-xs font-black text-[#183c31] transition hover:border-[#183c31]"
                    >
                      View contractor →
                    </Link>
                  </div>
                )}
              </div>

              {openReviewContractorId === inquiry.contractor_profile_id &&
                contractors[inquiry.contractor_profile_id] && (
                  <ContractorReviewPanel
                    key={inquiry.contractor_profile_id}
                    contractorId={inquiry.contractor_profile_id}
                    contractorName={
                      contractors[inquiry.contractor_profile_id].name
                    }
                    onChanged={handleReviewChanged}
                    onDeleted={handleReviewChanged}
                  />
                )}
            </article>
          ))
          )}
        </div>
      )}
    </div>
  );
}