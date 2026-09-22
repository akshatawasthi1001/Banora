"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { PublicNav } from "@/components/public-nav";
import { ContractorReviewPanel, Stars } from "@/components/review-form";
import { ApiRequestError, apiGet } from "@/lib/api/client";
import { createInquiry } from "@/lib/api/inquiries";
import { useAuth } from "@/lib/auth-context";import type {
  ContractorProfile,
  Inquiry,
  MediaAsset,
  Project,
  ProjectList,
  RatingSummary,
  Review,
} from "@/lib/api/types";

interface ProjectWithMedia extends Project {
  media: MediaAsset[];
}

export default function ContractorDetailPage() {
  const params = useParams<{ contractorId: string }>();
  const { user } = useAuth();
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [rating, setRating] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [projects, setProjects] = useState<ProjectWithMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContractor() {
      try {
        const [profileResponse, ratingResponse, reviewsResponse, projectsResponse] =
          await Promise.all([
            apiGet<ContractorProfile>(`/contractors/${params.contractorId}`),
            apiGet<RatingSummary>(`/contractors/${params.contractorId}/rating`),
            apiGet<{ items: Review[] }>(
              `/contractors/${params.contractorId}/reviews?page=1&page_size=24`,
            ),
            apiGet<ProjectList>(
              `/projects?contractor_id=${params.contractorId}&page=1&page_size=100`,
            ),
          ]);

        if (cancelled) {
          return;
        }

        setContractor(profileResponse);
        document.title = `${profileResponse.name} | Banora`;
        setRating(ratingResponse);
        setReviews(reviewsResponse.items);

        const projectsWithMedia = await Promise.all(
          projectsResponse.items.map(async (project) => {
            const mediaResponse = await apiGet<{ items: MediaAsset[] }>(
              `/projects/${project.id}/media?page=1&page_size=4`,
            ).catch(() => ({ items: [] }));
            return { ...project, media: mediaResponse.items };
          }),
        );

        if (cancelled) {
          return;
        }

        setProjects(projectsWithMedia);
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        if (requestError instanceof ApiRequestError && requestError.status === 404) {
          setNotFound(true);
        } else {
          setError(
            requestError instanceof ApiRequestError
              ? requestError.detail
              : "We could not load this contractor.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadContractor();

    return () => {
      cancelled = true;
    };
  }, [params.contractorId]);

  async function refreshReviews() {
    try {
      const reviewsResponse = await apiGet<{ items: Review[] }>(
        `/contractors/${params.contractorId}/reviews?page=1&page_size=24`,
      );
      setReviews(reviewsResponse.items);
    } catch {
      // Keep the previously loaded reviews; the section still renders.
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]">
      <PublicNav />

      <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">
        <Link
          href="/contractors"
          className="mt-8 inline-block text-sm font-bold text-[#607068] transition hover:text-[#183c31]"
        >
          ← Back to contractors
        </Link>

        {isLoading && (
          <div className="py-16">
            <div className="h-8 w-40 animate-pulse rounded-lg bg-[#e3e0d8]" />
            <div className="mt-6 h-16 w-2/3 animate-pulse rounded-2xl bg-[#e3e0d8]" />
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.7fr]">
              <div className="h-64 animate-pulse rounded-2xl bg-[#e3e0d8]" />
              <div className="h-64 animate-pulse rounded-2xl bg-[#183c31] opacity-20" />
            </div>
          </div>
        )}

        {notFound && (
          <EmptyPage
            title="Contractor not found"
            body="This profile may have moved or is no longer available."
          />
        )}

        {error && <EmptyPage title="Something went wrong" body={error} />}

        {!isLoading && !notFound && !error && contractor && (
          <>
            <section className="grid gap-8 border-b border-[#d7d8d1] py-10 sm:py-16 lg:grid-cols-[1fr_0.7fr] lg:items-end">
              <div>
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#d9c6ae] text-3xl font-black text-[#183c31]">
                  {contractor.profile_image_url ? (
                    <img
                      className="h-full w-full object-cover"
                      src={contractor.profile_image_url}
                      alt={`${contractor.name} profile`}
                    />
                  ) : (
                    contractor.name.slice(0, 1).toUpperCase()
                  )}
                </div>

                <p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">
                  Contractor profile
                </p>

                <h1 className="mt-3 text-5xl font-black leading-[0.96] tracking-[-0.07em] text-[#183c31] sm:text-7xl">
                  {contractor.name}
                </h1>

                <p className="mt-4 text-lg font-semibold text-[#607068]">
                  {contractor.company_name ?? "Independent contractor"}
                </p>

                <p className="mt-4 text-base text-[#607068]">
                  {contractor.city}, {contractor.state}, {contractor.country}
                </p>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#607068]">
                  {contractor.bio ?? "This contractor has not added a bio yet."}
                </p>
              </div>

              <aside className="rounded-2xl bg-[#183c31] p-7 text-[#f4f1eb]">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f0b39b]">
                  Trust signals
                </p>

                <div className="mt-6 flex items-end gap-3">
                  <span className="text-5xl font-black tracking-[-0.08em]">
                    {rating && rating.review_count > 0
                      ? rating.average_rating.toFixed(1)
                      : "—"}
                  </span>

                  <span className="pb-2 text-sm text-[#c6d3cc]">
                    {rating?.review_count ?? 0} reviews
                  </span>
                </div>

                <div className="mt-6 space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="flex items-center gap-3 text-xs">
                      <span className="w-3 text-[#f0b39b]">{star}</span>

                      <div className="h-1.5 flex-1 rounded-full bg-[#44665a]">
                        <div
                          className="h-full rounded-full bg-[#e26d42]"
                          style={{
                            width: `${
                              rating && rating.review_count > 0
                                ? ((rating.rating_distribution[String(star)] ?? 0) /
                                    rating.review_count) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>

                      <span className="w-4 text-right text-[#91aaa0]">
                        {rating?.rating_distribution[String(star)] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-7 border-t border-[#44665a] pt-5">
                  <p className="text-sm text-[#c6d3cc]">
                    {contractor.experience_years} years of experience
                  </p>

                  {contractor.phone ? (
                    <a
                      href={`tel:${contractor.phone}`}
                      className="mt-4 inline-block rounded-lg bg-[#e26d42] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#c95731]"
                    >
                      Contact Contractor
                    </a>
                  ) : (
                    <span className="mt-4 inline-block text-sm font-semibold text-[#f0b39b]">
                      Contact feature coming soon
                    </span>
                  )}

                  <a
                    href="#send-inquiry"
                    className="mt-3 block text-sm font-bold text-[#f0b39b] transition hover:text-white"
                  >
                    Send an inquiry ↓
                  </a>
                </div>
              </aside>
            </section>

            {user?.role === "CLIENT" && (
              <ContractorReviewPanel
                contractorId={contractor.id}
                contractorName={contractor.name}
                onDeleted={() => void refreshReviews()}
              />
            )}

            <InquirySection contractor={contractor} />

            <section className="mt-12">
              <div className="flex items-end justify-between border-b border-[#d7d8d1] pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e26d42]">
                    Selected work
                  </p>

                  <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">
                    Project portfolio
                  </h2>
                </div>

                <span className="text-sm font-semibold text-[#607068]">
                  {projects.length} project{projects.length === 1 ? "" : "s"}
                </span>
              </div>

              {projects.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[#b9c2ba] bg-white px-6 py-14 text-center text-sm text-[#607068]">
                  No public projects yet.
                </div>
              ) : (
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-12">
              <div className="border-b border-[#d7d8d1] pb-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e26d42]">
                  Client perspective
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">
                  Reviews
                </h2>
              </div>

              <p className="mt-4 max-w-xl text-sm leading-6 text-[#607068]">
                Real feedback from verified clients who worked with{" "}
                {contractor.name} through Banora.
              </p>

              {reviews.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-[#b9c2ba] bg-white px-6 py-14 text-center text-sm text-[#607068]">
                  No reviews yet.
                </div>
              ) : (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-2xl border border-[#d7d8d1] bg-white p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Stars rating={review.rating} />

                        <span className="text-xs font-semibold text-[#8a9890]">
                          {new Date(review.created_at).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-7 text-[#607068]">
                        {review.comment ?? "No written comment."}
                      </p>

                      <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#8a9890]">
                        Verified Banora review
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ProjectCard({ project }: { project: ProjectWithMedia }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#d7d8d1] bg-white shadow-[0_10px_30px_rgba(24,60,49,0.04)]">
      {project.media[0] ? (
        <div className="h-44 bg-[#d9c6ae]">
          <img
            className="h-full w-full object-cover"
            src={project.media[0].thumbnail_url ?? project.media[0].url}
            alt={project.media[0].alt_text ?? project.title}
          />
        </div>
      ) : (
        <div className="flex h-44 items-end bg-[#d9c6ae] p-5">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-[#6f513b]">
            {project.project_type}
          </span>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black tracking-[-0.05em] text-[#183c31]">
              <Link
                href={`/projects/${project.id}`}
                className="transition hover:text-[#e26d42]"
              >
                {project.title}
              </Link>
            </h3>

            <p className="mt-2 text-sm text-[#607068]">
              {project.city}, {project.state}
            </p>
          </div>

          <span className="rounded-full bg-[#e5efe9] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#286047]">
            {project.status}
          </span>
        </div>

        {project.description && (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#607068]">
            {project.description}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-bold uppercase tracking-[0.12em] text-[#8a9890]">Type</p>
            <p className="mt-1 font-semibold text-[#365048]">{project.project_type}</p>
          </div>

          <div>
            <p className="font-bold uppercase tracking-[0.12em] text-[#8a9890]">Budget</p>
            <p className="mt-1 font-semibold text-[#365048]">
              {project.budget_min || project.budget_max
                ? `${project.budget_min ? project.budget_min.toLocaleString() : "—"} – ${
                    project.budget_max ? project.budget_max.toLocaleString() : "—"
                  }`
                : "Not listed"}
            </p>
          </div>

          <div>
            <p className="font-bold uppercase tracking-[0.12em] text-[#8a9890]">Built-up</p>
            <p className="mt-1 font-semibold text-[#365048]">
              {project.built_up_area_sqft
                ? `${project.built_up_area_sqft.toLocaleString()} sqft`
                : "Not listed"}
            </p>
          </div>

          <div>
            <p className="font-bold uppercase tracking-[0.12em] text-[#8a9890]">Floors</p>
            <p className="mt-1 font-semibold text-[#365048]">
              {project.floors ? String(project.floors) : "Not listed"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[#e9e9e3] pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a9890]">
            {project.status === "COMPLETED" && project.completion_date
              ? `Completed ${project.completion_date.slice(0, 10)}`
              : project.start_date
                ? `Started ${project.start_date.slice(0, 10)}`
                : "Banora project"}
          </p>

          <Link
            href={`/projects/${project.id}`}
            className="text-sm font-black text-[#e26d42] hover:text-[#a3482d]"
          >
            View project ↗
          </Link>
        </div>
      </div>
    </article>
  );
}

function EmptyPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="text-4xl font-black tracking-[-0.06em] text-[#183c31]">{title}</h1>

      <p className="mt-4 text-base leading-7 text-[#607068]">{body}</p>

      <Link
        href="/contractors"
        className="mt-7 inline-block rounded-lg bg-[#183c31] px-5 py-3 text-sm font-bold text-white"
      >
        Back to contractors
      </Link>
    </div>
  );
}

function InquirySection({ contractor }: { contractor: ContractorProfile }) {
  const { user, isLoading: authLoading } = useAuth();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedInquiry, setSubmittedInquiry] = useState<Inquiry | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (authLoading || !user) {
      setFormError("Please log in with a client account to send this inquiry.");
      return;
    }

    if (user.role !== "CLIENT") {
      setFormError("Inquiries can only be sent from a client account.");
      return;
    }

    if (isSubmitting) {
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setFormError("Add a subject and a message before sending.");
      return;
    }

    setIsSubmitting(true);

    try {
      const inquiry = await createInquiry({
        contractor_id: contractor.id,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubmittedInquiry(inquiry);
      setSubject("");
      setMessage("");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 401) {
          setFormError("Your session has expired. Please log in again.");
        } else {
          setFormError(requestError.detail);
        }
      } else if (requestError instanceof Error) {
        setFormError(requestError.message);
      } else {
        setFormError("We could not send your inquiry. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="send-inquiry" className="mt-12 scroll-mt-20">
      <div className="border-b border-[#d7d8d1] pb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e26d42]">
          Work with this contractor
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">
          Send an inquiry.
        </h2>
      </div>

      {authLoading ? (
        <div className="mt-6 rounded-2xl border border-[#d7d8d1] bg-white px-6 py-10 text-center text-sm font-semibold text-[#607068]">
          Checking your session...
        </div>
      ) : !user ? (
        <div className="mt-6 rounded-2xl border border-[#d7d8d1] bg-white px-6 py-10 text-center">
          <h3 className="text-xl font-black tracking-[-0.03em] text-[#183c31]">
            Log in to contact {contractor.name}.
          </h3>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#607068]">
            Sign in with a client account to send an inquiry and track the
            contractor&apos;s response from your dashboard.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-block rounded-xl bg-[#e26d42] px-5 py-3 text-sm font-black text-white transition hover:bg-[#c95731]"
          >
            Log in to send an inquiry
          </Link>
        </div>
      ) : user.role === "CONTRACTOR" ? (
        <div className="mt-6 rounded-2xl border border-[#cddbd2] bg-[#edf2ee] px-6 py-8 text-center">
          <h3 className="text-xl font-black tracking-[-0.03em] text-[#183c31]">
            Inquiries are for client accounts.
          </h3>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#607068]">
            You are signed in as a contractor, so sending inquiries is not
            available. Clients use this form to start a conversation, and
            inquiries you receive appear in your contractor workspace.
          </p>
        </div>
      ) : submittedInquiry ? (
        <div className="mt-6 rounded-2xl border border-[#cddbd2] bg-[#edf2ee] px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#183c31] text-lg text-[#f4f1eb]">
            ✓
          </div>

          <h3 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#183c31]">
            Inquiry sent.
          </h3>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#607068]">
            Your inquiry &quot;{submittedInquiry.subject}&quot; is on its way to{" "}
            {contractor.name}. You can follow its status from your dashboard.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/dashboard/inquiries"
              className="rounded-xl bg-[#183c31] px-5 py-3 text-sm font-black text-white transition hover:bg-[#285847]"
            >
              View my inquiries
            </Link>

            <button
              type="button"
              onClick={() => setSubmittedInquiry(null)}
              className="rounded-xl border border-[#cdd2cb] bg-white px-5 py-3 text-sm font-bold text-[#365048] transition hover:border-[#183c31]"
            >
              Send another inquiry
            </button>
          </div>
        </div>
      ) : (
        <form
          className="mt-6 rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-bold text-[#365048]">
              Subject

              <input
                className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-white px-4 py-3.5 text-base font-medium outline-none transition placeholder:text-[#a1aaa3] focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]"
                type="text"
                maxLength={200}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={`e.g. Inquiry about ${contractor.name}'s work`}
                disabled={isSubmitting}
              />
            </label>
          </div>

          <label className="mt-5 block text-sm font-bold text-[#365048]">
            Message

            <textarea
              className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-white px-4 py-3.5 text-base font-medium outline-none transition placeholder:text-[#a1aaa3] focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]"
              rows={6}
              maxLength={10000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe your project, timeline, and budget so the contractor can respond quickly."
              disabled={isSubmitting}
            />
          </label>

          {formError && (
            <p
              className="mt-5 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]"
              role="alert"
            >
              {formError}
            </p>
          )}

          <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs font-semibold text-[#91aaa0]">
              Sent as {user.email} · Your inquiry appears in My Inquiries.
            </p>

            <button
              className="w-full rounded-xl bg-[#e26d42] px-5 py-4 text-sm font-black text-white transition hover:bg-[#c95731] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending inquiry..." : "Send inquiry"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
