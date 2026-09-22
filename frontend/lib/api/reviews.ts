import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  RatingSummary,
  Review,
  ReviewInput,
  ReviewList,
  ReviewPatchInput,
} from "./types";

export function createReview(
  contractorId: string,
  input: ReviewInput,
): Promise<Review> {
  return apiPost<Review>(`/contractors/${contractorId}/reviews`, input);
}

export function listContractorReviews(
  contractorId: string,
  page = 1,
  pageSize = 20,
): Promise<ReviewList> {
  return apiGet<ReviewList>(
    `/contractors/${contractorId}/reviews?page=${page}&page_size=${pageSize}`,
  );
}

export function getContractorReview(
  contractorId: string,
  reviewId: string,
): Promise<Review> {
  return apiGet<Review>(`/contractors/${contractorId}/reviews/${reviewId}`);
}

export function updateReview(
  contractorId: string,
  reviewId: string,
  input: ReviewPatchInput,
): Promise<Review> {
  return apiPatch<Review>(
    `/contractors/${contractorId}/reviews/${reviewId}`,
    input,
  );
}

export function deleteReview(
  contractorId: string,
  reviewId: string,
): Promise<void> {
  return apiDelete<void>(`/contractors/${contractorId}/reviews/${reviewId}`);
}

export function getRatingSummary(contractorId: string): Promise<RatingSummary> {
  return apiGet<RatingSummary>(`/contractors/${contractorId}/rating`);
}

const REVIEWS_KEY = "banora_my_review_ids";

function readStore(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(REVIEWS_KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string>): void {
  try {
    window.localStorage.setItem(REVIEWS_KEY, JSON.stringify(store));
  } catch {
    // Storage may be unavailable (private mode/quota). The app still works:
    // creating a review again surfaces the backend 409, which we handle.
  }
}

/** Remember the id of a review the current client submitted for a contractor. */
export function rememberReviewId(
  contractorId: string,
  reviewId: string,
): void {
  const store = readStore();
  store[contractorId] = reviewId;
  writeStore(store);
}

/** Forget a stored review id (e.g. after the review is deleted). */
export function forgetReviewId(contractorId: string): void {
  const store = readStore();
  delete store[contractorId];
  writeStore(store);
}

/** Look up a possibly-stored review id for a contractor. */
export function getStoredReviewId(contractorId: string): string | null {
  return readStore()[contractorId] ?? null;
}
