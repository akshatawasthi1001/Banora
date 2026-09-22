"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiRequestError } from "@/lib/api/client";
import {
  getReceivedInquiries,
  updateInquiryStatus,
} from "@/lib/api/inquiries";
import { DashboardAccessPending } from "@/components/dashboard-shell";
import { useRequireContractor } from "@/lib/auth-context";
import type { Inquiry, InquiryStatus } from "@/lib/api/types";

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

/* The backend only allows NEW → CONTACTED → CLOSED; any other
   transition is rejected with a 409, so actions are only offered
   for these two source statuses. */
const nextAction: Partial<
  Record<InquiryStatus, { status: InquiryStatus; label: string }>
> = {
  NEW: { status: "CONTACTED", label: "Mark as contacted" },
  CONTACTED: { status: "CLOSED", label: "Mark as closed" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function ReceivedInquiriesPage() {
  const auth = useRequireContractor();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isLoading || !auth.user || auth.user.role !== "CONTRACTOR") {
      return;
    }

    async function loadInquiries() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getReceivedInquiries(1, 100);
        setInquiries(response.items);
      } catch (requestError) {
        if (requestError instanceof ApiRequestError) {
          setError(requestError.detail);
        } else {
          setError(
            "We could not load your received inquiries. Please try again.",
          );
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadInquiries();
  }, [auth.isLoading, auth.user]);

  async function handleStatusUpdate(
    inquiry: Inquiry,
    nextStatus: InquiryStatus,
  ) {
    if (updatingId) {
      return;
    }

    setUpdatingId(inquiry.id);
    setActionError(null);

    try {
      const updated = await updateInquiryStatus(inquiry.id, {
        status: nextStatus,
      });

      setInquiries((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        setActionError(requestError.detail);
      } else if (requestError instanceof Error) {
        setActionError(requestError.message);
      } else {
        setActionError(
          "We could not update the inquiry status. Please try again.",
        );
      }
    } finally {
      setUpdatingId(null);
    }
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
            Contractor workspace
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] text-[#183c31] sm:text-5xl">
            Received inquiries.
          </h1>

          <p className="mt-4 max-w-xl text-base leading-7 text-[#607068]">
            Review requests from clients and keep every conversation moving
            with clear statuses.
          </p>
        </div>

        <div className="rounded-2xl border border-[#d7d8d1] bg-white px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#91aaa0]">
            Total received
          </p>

          <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-[#183c31]">
            {inquiries.length}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 rounded-2xl border border-[#d7d8d1] bg-white p-8">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#607068]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#e26d42]" />
            Loading received inquiries...
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
            When clients contact you through Banora, their inquiries will
            appear here with their current status.
          </p>

          <Link
            href="/dashboard/profile"
            className="mt-7 inline-flex rounded-xl bg-[#e26d42] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c95731]"
          >
            Polish your profile →
          </Link>
        </div>
      ) : (
        <div className="mt-10 space-y-4">
          {actionError && (
            <div
              className="rounded-2xl border border-[#e8b9a8] bg-[#fff3ed] p-5 text-sm font-semibold text-[#a3482d]"
              role="alert"
            >
              {actionError}
            </div>
          )}

          {inquiries.map((inquiry) => {
            const action = nextAction[inquiry.status];
            const isUpdating = updatingId === inquiry.id;

            return (
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

                  {action && (
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleStatusUpdate(inquiry, action.status)
                        }
                        disabled={updatingId !== null}
                        className="w-full rounded-xl bg-[#183c31] px-5 py-3 text-sm font-black text-white transition hover:bg-[#285847] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {isUpdating ? "Updating..." : action.label}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-[#e5e5df] pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#91aaa0]">
                    Client request
                  </p>

                  <p className="mt-1 break-all text-xs font-semibold text-[#607068]">
                    Client #{inquiry.client_id.slice(0, 8)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
