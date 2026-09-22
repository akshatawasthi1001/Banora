"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PublicNav } from "@/components/public-nav";
import { ApiRequestError, apiGet } from "@/lib/api/client";
import type {
  ContractorProfile,
  MediaAsset,
  Project,
  ProjectJourney,
  RatingSummary,
  Review,
} from "@/lib/api/types";

interface JourneyUpdateWithMedia {
  id: string;
  title: string;
  description: string | null;
  progress_percentage: number;
  update_date: string;
  media: MediaAsset[];
  mediaError: boolean;
}

interface JourneyStageWithMedia {
  id: string;
  name: string;
  stage_order: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  started_at: string | null;
  completed_at: string | null;
  progress_updates: JourneyUpdateWithMedia[];
}

export default function PublicProjectPage() {
  const params = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [stages, setStages] = useState<JourneyStageWithMedia[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [rating, setRating] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const [projectResponse, journeyResponse, mediaResponse] =
          await Promise.all([
            apiGet<Project>(`/projects/${params.projectId}`),
            apiGet<ProjectJourney>(`/projects/${params.projectId}/journey`),
            apiGet<{ items: MediaAsset[] }>(
              `/projects/${params.projectId}/media?page=1&page_size=100`,
            ),
          ]);

        if (cancelled) return;

        setProject(projectResponse);
        document.title = `${projectResponse.title} | Banora`;
        setMedia(mediaResponse.items);

        const contractorResponse = await apiGet<ContractorProfile>(
          `/contractors/${projectResponse.contractor_id}`,
        );
        if (cancelled) return;
        setContractor(contractorResponse);

        const [ratingResponse, reviewsResponse] = await Promise.all([
          apiGet<RatingSummary>(
            `/contractors/${projectResponse.contractor_id}/rating`,
          ).catch(() => null),
          apiGet<{ items: Review[] }>(
            `/contractors/${projectResponse.contractor_id}/reviews?page=1&page_size=3`,
          ).catch(() => null),
        ]);
        if (cancelled) return;
        setRating(ratingResponse);
        setReviews(reviewsResponse?.items ?? []);

        // Hydrate progress-update media via the existing public media endpoint.
        const hydratedStages: JourneyStageWithMedia[] = await Promise.all(
          journeyResponse.stages.map(async (stage) => ({
            ...stage,
            progress_updates: await Promise.all(
              stage.progress_updates.map(async (update) => {
                const updateMedia = await apiGet<MediaAsset[]>(
                  `/projects/${params.projectId}/stages/${stage.id}/updates/${update.id}/media`,
                ).catch(() => null);
                return {
                  ...update,
                  media: updateMedia ?? [],
                  mediaError: updateMedia === null,
                };
              }),
            ),
          })),
        );
        if (cancelled) return;
        setStages(hydratedStages);
      } catch (requestError) {
        if (cancelled) return;
        if (requestError instanceof ApiRequestError && requestError.status === 404) {
          setNotFound(true);
        } else {
          setError(
            requestError instanceof ApiRequestError
              ? requestError.detail
              : "We could not load this project.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [params.projectId]);

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]">
      <PublicNav />

      <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">
        {loading && (
          <div className="py-16">
            <div className="h-5 w-52 animate-pulse rounded bg-[#e3e0d8]" />
            <div className="mt-5 h-14 w-2/3 animate-pulse rounded-2xl bg-[#e3e0d8]" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {["a", "b", "c", "d"].map((key) => (
                <div key={key} className="h-24 animate-pulse rounded-2xl bg-[#e3e0d8]" />
              ))}
            </div>
            <div className="mt-10 h-72 animate-pulse rounded-2xl bg-[#e3e0d8]" />
          </div>
        )}

        {notFound && (
          <div className="mx-auto max-w-lg py-24 text-center">
            <h1 className="text-4xl font-black tracking-[-0.06em] text-[#183c31]">
              Project not found
            </h1>
            <p className="mt-4 text-[#607068]">
              This project may have moved or is no longer public.
            </p>
            <Link
              href="/contractors"
              className="mt-7 inline-block rounded-lg bg-[#183c31] px-5 py-3 text-sm font-bold text-white"
            >
              Explore contractors
            </Link>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-lg py-24 text-center">
            <h1 className="text-4xl font-black text-[#183c31]">
              Something went wrong
            </h1>
            <p className="mt-4 text-[#607068]">{error}</p>
          </div>
        )}

        {!loading && !notFound && !error && project && (
          <>
            <header className="grid gap-8 border-b border-[#d7d8d1] py-10 sm:py-16 lg:grid-cols-[1fr_0.65fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e26d42]">
                  {project.project_type} · {project.city}, {project.state}
                </p>

                <h1 className="mt-4 text-5xl font-black leading-[0.96] tracking-[-0.07em] text-[#183c31] sm:text-7xl">
                  {project.title}
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#607068]">
                  {project.description ?? "A project documented on Banora."}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <span className="w-fit rounded-full bg-[#fff0e8] px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-[#a3482d]">
                    {project.status}
                  </span>

                  {contractor && (
                    <Link
                      href={`/contractors/${contractor.id}`}
                      className="rounded-full border border-[#cddbd2] bg-white px-4 py-2 text-xs font-bold text-[#286047] transition hover:border-[#286047]"
                    >
                      Built by {contractor.name} · View profile ↗
                    </Link>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a9890]">
                  Built by
                </p>

                {contractor ? (
                  <Link
                    href={`/contractors/${contractor.id}`}
                    className="mt-3 block text-2xl font-black tracking-[-0.05em] text-[#183c31] transition hover:text-[#e26d42]"
                  >
                    {contractor.name}
                  </Link>
                ) : (
                  <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-[#183c31]">
                    Banora contractor
                  </p>
                )}

                <p className="mt-1 text-sm text-[#607068]">
                  {contractor?.company_name ?? "Contractor profile"}
                </p>

                <p className="mt-4 text-sm text-[#607068]">
                  {contractor ? `${contractor.city}, ${contractor.state}` : "\u00a0"}
                </p>

                {contractor && (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Link
                      href={`/contractors/${contractor.id}#send-inquiry`}
                      className="inline-block rounded-lg bg-[#e26d42] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#c95731]"
                    >
                      Send an inquiry
                    </Link>

                    <Link
                      href={`/contractors/${contractor.id}`}
                      className="inline-block text-sm font-bold text-[#286047] transition hover:text-[#183c31]"
                    >
                      View contractor profile →
                    </Link>
                  </div>
                )}

                {rating && rating.review_count > 0 && (
                  <p className="mt-5 border-t border-[#e9e9e3] pt-4 text-sm font-semibold text-[#607068]">
                    <span className="text-[#e26d42]">★</span>{" "}
                    {rating.average_rating.toFixed(1)} · {rating.review_count}{" "}
                    client review{rating.review_count === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </header>

            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SpecCard label="Status" value={project.status} />

              <SpecCard
                label="Project type"
                value={project.project_type.replace("_", " ")}
              />

              <SpecCard
                label="Budget range"
                value={
                  project.budget_min || project.budget_max
                    ? `${project.budget_min ? project.budget_min.toLocaleString() : "—"} – ${
                        project.budget_max ? project.budget_max.toLocaleString() : "—"
                      }`
                    : "Not listed"
                }
              />

              <SpecCard
                label="Location"
                value={`${project.city}, ${project.state}, ${project.country}`}
              />

              <SpecCard
                label="Plot area"
                value={
                  project.plot_area_sqft
                    ? `${project.plot_area_sqft.toLocaleString()} sqft`
                    : "Not listed"
                }
              />

              <SpecCard
                label="Built-up area"
                value={
                  project.built_up_area_sqft
                    ? `${project.built_up_area_sqft.toLocaleString()} sqft`
                    : "Not listed"
                }
              />

              <SpecCard
                label="Floors"
                value={project.floors ? String(project.floors) : "Not listed"}
              />

              <SpecCard
                label="Timeline"
                value={
                  project.start_date || project.completion_date
                    ? `${project.start_date ? project.start_date.slice(0, 10) : "—"} → ${
                        project.completion_date ? project.completion_date.slice(0, 10) : "ongoing"
                      }`
                    : "Not listed"
                }
              />
            </section>

            <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">
                  Portfolio media
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">
                  See the work.
                </h2>

                {media.length === 0 ? (
                  <p className="mt-6 text-sm text-[#607068]">
                    No media has been added to this project yet.
                  </p>
                ) : (
                  <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {media.map((item) => (
                      <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block aspect-[1.2] overflow-hidden rounded-xl bg-[#d9c6ae]"
                      >
                        {item.media_type === "IMAGE" ? (
                          <img
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            src={item.thumbnail_url ?? item.url}
                            alt={item.alt_text ?? item.caption ?? project.title}
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#183c31] text-[10px] font-black uppercase tracking-[0.14em] text-[#f4f1eb]">
                            <span className="text-2xl">▶</span>
                            {item.caption ?? "Watch video"}
                          </span>
                        )}

                        {item.caption && item.media_type === "IMAGE" && (
                          <span className="absolute inset-x-2 bottom-2 truncate rounded bg-[#183c31]/90 px-2 py-1 text-[10px] font-semibold text-white">
                            {item.caption}
                          </span>
                        )}

                        <span className="absolute right-2 top-2 rounded bg-[#183c31]/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
                          {item.media_type}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-[#183c31] p-7 text-[#f4f1eb]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f0b39b]">
                  Trust context
                </p>

                <div className="mt-5 text-5xl font-black">
                  {rating && rating.review_count
                    ? rating.average_rating.toFixed(1)
                    : "—"}
                </div>

                <p className="mt-2 text-sm text-[#c6d3cc]">
                  {rating?.review_count ?? 0} client reviews for this contractor
                </p>

                {reviews.slice(0, 2).map((review) => (
                  <div key={review.id} className="mt-6 border-t border-[#44665a] pt-4">
                    <p className="text-[#f0b39b]">{"★".repeat(review.rating)}</p>

                    <p className="mt-2 text-sm leading-6 text-[#c6d3cc]">
                      {review.comment ?? "No written comment."}
                    </p>
                  </div>
                ))}

                <Link
                  href={contractor ? `/contractors/${contractor.id}` : "/contractors"}
                  className="mt-7 inline-block text-sm font-bold text-[#f0b39b]"
                >
                  View contractor profile →
                </Link>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">
                    The build story
                  </p>

                  <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">
                    Construction journey
                  </h2>
                </div>

                <p className="text-sm font-semibold text-[#607068]">
                  {stages.length} recorded stage{stages.length === 1 ? "" : "s"}
                </p>
              </div>

              {stages.length === 0 ? (
                <p className="mt-7 text-sm text-[#607068]">
                  No construction journey updates yet.
                </p>
              ) : (
                <ol className="mt-8">
                  {stages.map((stage, index) => {
                    const latestUpdate = stage.progress_updates[0];
                    const latestPercent = latestUpdate
                      ? Math.round(latestUpdate.progress_percentage)
                      : null;

                    return (
                      <li key={stage.id} className="relative pb-10 pl-12 sm:pl-14 last:pb-0">
                        {index < stages.length - 1 && (
                          <span
                            aria-hidden
                            className="absolute left-[15px] top-10 h-[calc(100%-40px)] w-px bg-[#cddbd2] sm:left-[19px]"
                          />
                        )}

                        <span
                          className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-black sm:h-10 sm:w-10 sm:text-sm ${
                            stage.status === "COMPLETED"
                              ? "bg-[#286047] text-white"
                              : stage.status === "IN_PROGRESS"
                                ? "bg-[#e26d42] text-white"
                                : "bg-[#e5efe9] text-[#286047]"
                          }`}
                        >
                          {stage.stage_order}
                        </span>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-xl font-black tracking-[-0.04em] text-[#183c31] sm:text-2xl">
                            {stage.name}
                          </h3>

                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                              stage.status === "COMPLETED"
                                ? "bg-[#e5efe9] text-[#286047]"
                                : stage.status === "IN_PROGRESS"
                                  ? "bg-[#fff0e8] text-[#a3482d]"
                                  : "bg-[#f4f1eb] text-[#8a9890]"
                            }`}
                          >
                            {stage.status.replace("_", " ")}
                          </span>
                        </div>

                        <p className="mt-2 text-xs font-semibold text-[#8a9890]">
                          {stage.started_at
                            ? `Started ${formatDate(stage.started_at)}`
                            : "Not started yet"}
                          {stage.completed_at
                            ? ` · Finished ${formatDate(stage.completed_at)}`
                            : ""}
                        </p>

                        {latestPercent !== null && (
                          <div className="mt-4 max-w-md">
                            <div className="flex items-center justify-between text-xs font-bold text-[#607068]">
                              <span>Latest progress</span>
                              <span className="text-[#e26d42]">{latestPercent}%</span>
                            </div>

                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f4f1eb]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#286047] to-[#e26d42]"
                                style={{ width: `${latestPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {stage.progress_updates.length === 0 ? (
                          <p className="mt-3 text-sm text-[#8a9890]">
                            No updates recorded for this stage.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-3">
                            {stage.progress_updates.map((update) => (
                              <div key={update.id} className="rounded-xl bg-[#f9f8f4] p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-bold text-[#365048]">{update.title}</p>

                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-[#e26d42]">
                                      {Math.round(update.progress_percentage)}%
                                    </span>

                                    <time className="text-xs font-semibold text-[#8a9890]">
                                      {formatDate(update.update_date)}
                                    </time>
                                  </div>
                                </div>

                                {update.description && (
                                  <p className="mt-1.5 text-sm leading-6 text-[#607068]">
                                    {update.description}
                                  </p>
                                )}

                                {update.mediaError ? (
                                  <p className="mt-3 text-xs font-semibold text-[#a3482d]">
                                    Media for this update could not be loaded.
                                  </p>
                                ) : update.media.length === 0 ? null : (
                                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {update.media.map((item) => (
                                      <a
                                        key={item.id}
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group relative block overflow-hidden rounded-lg border border-[#e9e9e3] bg-white"
                                      >
                                        {item.media_type === "IMAGE" ? (
                                          <img
                                            src={item.thumbnail_url ?? item.url}
                                            alt={item.alt_text ?? item.caption ?? update.title}
                                            className="h-24 w-full object-cover transition duration-300 group-hover:scale-105 sm:h-28"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <span className="flex h-24 items-center justify-center gap-1 bg-[#183c31] text-[10px] font-black uppercase tracking-[0.12em] text-white sm:h-28">
                                            ▶ {item.caption ?? "Video"}
                                          </span>
                                        )}

                                        {item.caption && (
                                          <span className="absolute inset-x-2 bottom-2 truncate rounded bg-[#183c31]/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                            {item.caption}
                                          </span>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d7d8d1] bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8a9890]">
        {label}
      </p>

      <p className="mt-3 text-lg font-black text-[#183c31]">{value}</p>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}
