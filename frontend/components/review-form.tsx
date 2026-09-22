"use client";

import { useEffect, useState } from "react";

import { ApiRequestError } from "@/lib/api/client";
import {
  createReview,
  deleteReview,
  forgetReviewId,
  getContractorReview,
  getStoredReviewId,
  rememberReviewId,
  updateReview,
} from "@/lib/api/reviews";
import { useAuth } from "@/lib/auth-context";
import type { Review } from "@/lib/api/types";

const MAX_COMMENT_LENGTH = 5000; // Backend limit: comment max_length=5000

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) return error.detail;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function StarRatingInput({
  value,
  onChange,
  disabled = false,
  idPrefix,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value;

  return (
    <fieldset
      className="flex items-center gap-1"
      onMouseLeave={() => setHovered(null)}
    >
      <legend className="sr-only">Rating from 1 (poor) to 5 (excellent) stars</legend>

      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          id={idPrefix ? `${idPrefix}-star-${star}` : undefined}
          type="button"
          disabled={disabled}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={value >= star}
          onMouseEnter={() => !disabled && setHovered(star)}
          onClick={() => onChange(star)}
          className={`text-2xl leading-none transition disabled:cursor-not-allowed ${
            shown >= star ? "text-[#e26d42]" : "text-[#d7d8d1]"
          } hover:text-[#c95731] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#183c31]`}
        >
          ★
        </button>
      ))}

      <span
        aria-live="polite"
        className="ml-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8a9890]"
      >
        {value > 0 ? `${value}/5` : "Select a rating"}
      </span>
    </fieldset>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`Rated ${rating} out of 5 stars`} className="text-[#e26d42]">
      {"★".repeat(rating)}
      <span className="text-[#d7d8d1]">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * Per-contractor review state machine for the signed-in client.
 *
 * Uses only existing backend capabilities:
 * - create → POST /contractors/{id}/reviews (409 if one already exists)
 * - lookup → GET /contractors/{id}/reviews/{reviewId} (id remembered client-side)
 * - edit → PATCH, delete → DELETE (owner-only; server enforces)
 */
export function ContractorReviewPanel({
  contractorId,
  contractorName,
  onChanged,
  onDeleted,
}: {
  contractorId: string;
  contractorName: string;
  onChanged?: (review: Review) => void;
  onDeleted?: () => void;
}) {
  const { user } = useAuth();

  const [existing, setExisting] = useState<Review | null>(null);
  const [checked, setChecked] = useState(false);
  const [mode, setMode] = useState<"idle" | "creating" | "editing">("idle");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadExisting() {
      setChecked(false);
      setExisting(null);

      const storedId = getStoredReviewId(contractorId);
      if (!storedId) {
        if (!cancelled) setChecked(true);
        return;
      }
      try {
        const review = await getContractorReview(contractorId, storedId);
        if (cancelled) return;
        setExisting(review);
      } catch {
        // Stored id is stale (review deleted elsewhere). Forget it so the
        // panel falls back to the create flow; a duplicate submit still
        // surfaces the backend 409, which we handle below.
        forgetReviewId(contractorId);
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    void loadExisting();
    return () => {
      cancelled = true;
    };
  }, [contractorId]);

  function beginCreate() {
    setMode("creating");
    setRating(0);
    setComment("");
    setError(null);
    setSuccess(null);
  }

  function beginEdit() {
    if (!existing) return;
    setMode("editing");
    setRating(existing.rating);
    setComment(existing.comment ?? "");
    setError(null);
    setSuccess(null);
  }

  function cancel() {
    setMode("idle");
    setError(null);
  }

  async function handleSubmit() {
    if (busy) return;
    if (rating < 1 || rating > 5) {
      setError("Please select a rating between 1 and 5 stars.");
      return;
    }
    if (comment.length > MAX_COMMENT_LENGTH) {
      setError(`Your review must stay under ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (mode === "editing" && existing) {
        const updated = await updateReview(contractorId, existing.id, {
          rating,
          comment: comment.trim() || null,
        });
        setExisting(updated);
        setSuccess("Your review has been updated.");
        rememberReviewId(contractorId, updated.id);
        onChanged?.(updated);
      } else {
        const created = await createReview(contractorId, {
          rating,
          comment: comment.trim() || null,
        });
        setExisting(created);
        setSuccess("Thank you! Your review is now live.");
        rememberReviewId(contractorId, created.id);
        onChanged?.(created);
      }
      setMode("idle");
    } catch (requestError) {
      if (
        requestError instanceof ApiRequestError &&
        requestError.status === 409
      ) {
        // A review already exists for this contractor — reconcile the panel
        // with the backend's rule instead of failing.
        setError("You have already reviewed this contractor.");
        setMode("idle");
      } else {
        setError(getErrorMessage(requestError, "We could not save your review. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!existing || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteReview(contractorId, existing.id);
      forgetReviewId(contractorId);
      setExisting(null);
      setConfirmingDelete(false);
      setMode("idle");
      setSuccess("Your review has been removed.");
      onDeleted?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "We could not remove your review. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  if (!user || user.role !== "CLIENT") {
    return null; // Clients only; public visitors see the read-only reviews section.
  }

  if (!checked) {
    return (
      <div className="mt-6 rounded-2xl border border-[#d7d8d1] bg-white px-6 py-8 text-center text-sm font-semibold text-[#607068]">
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#e26d42]" />
        Checking your review...
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-[#cddbd2] bg-[#f6f9f6] p-6 sm:p-8">
      <h3 className="text-xl font-black tracking-[-0.04em] text-[#183c31]">
        Your review of {contractorName}
      </h3>

      {success && (
        <p
          className="mt-4 rounded-xl border border-[#bcd8c6] bg-[#eef6f0] px-4 py-3 text-sm font-semibold text-[#286047]"
          role="status"
        >
          {success}
        </p>
      )}

      {mode === "idle" && !existing && (
        <div className="mt-4">
          <p className="text-sm text-[#607068]">
            Worked with {contractorName}? Share an honest rating to help other
            clients.
          </p>
          <button
            type="button"
            onClick={beginCreate}
            className="mt-4 inline-flex rounded-xl bg-[#e26d42] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c95731]"
          >
            Leave a review
          </button>
        </div>
      )}

      {mode === "idle" && existing && (
        <div className="mt-4 rounded-xl bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Stars rating={existing.rating} />
            <span className="text-xs font-semibold text-[#8a9890]">
              Submitted {new Date(existing.created_at).toLocaleDateString()}
            </span>
          </div>
          {existing.comment && (
            <p className="mt-3 text-sm leading-6 text-[#607068]">{existing.comment}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold">
            <button
              type="button"
              onClick={beginEdit}
              className="text-[#286047] hover:underline"
            >
              Edit review
            </button>
            {confirmingDelete ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleDelete()}
                  className="text-[#a3482d] hover:underline disabled:opacity-50"
                >
                  {busy ? "Removing…" : "Confirm remove"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-[#607068] hover:underline"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-[#a3482d] hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}

      {mode !== "idle" && (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          noValidate
        >
          <StarRatingInput
            idPrefix="contractor-review"
            value={rating}
            onChange={setRating}
            disabled={busy}
          />

          <label className="mt-4 block text-sm font-bold text-[#365048]">
            Your review (optional)
            <textarea
              rows={4}
              maxLength={MAX_COMMENT_LENGTH}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="How was the quality, communication, and timeline?"
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-white px-4 py-3 text-base font-medium outline-none transition placeholder:text-[#a1aaa3] focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]"
            />
          </label>
          <p className="mt-1 text-right text-xs font-semibold text-[#91aaa0]">
            {comment.length}/{MAX_COMMENT_LENGTH}
          </p>

          {error && (
            <p
              className="mt-3 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[#e26d42] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c95731] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "Saving…"
                : mode === "editing"
                  ? "Save changes"
                  : "Submit review"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-xl border border-[#cdd2cb] bg-white px-5 py-3 text-sm font-bold text-[#365048] transition hover:border-[#183c31]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
