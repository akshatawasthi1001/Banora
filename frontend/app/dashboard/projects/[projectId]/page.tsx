"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getProjectJourney } from "@/lib/api/construction";
import { ApiRequestError, apiGet } from "@/lib/api/client";
import ConstructionJourney from "@/components/construction-journey";
import { DashboardAccessPending } from "@/components/dashboard-shell";
import { useRequireContractor } from "@/lib/auth-context";
import type { ContractorProfile, MediaAsset, Project, ProjectJourney, RatingSummary, Review } from "@/lib/api/types";

export default function ProjectDetailPage() {
  const auth = useRequireContractor();
  const params = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [journey, setJourney] = useState<ProjectJourney | null>(null);
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<RatingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshJourney = useCallback(async () => {
    try {
      setJourney(await getProjectJourney(params.projectId));
      setJourneyError(null);
    } catch (requestError) {
      setJourneyError(
        requestError instanceof ApiRequestError
          ? requestError.detail
          : "We could not load the construction journey.",
      );
    }
  }, [params.projectId]);

  useEffect(() => {
    if (auth.isLoading || !auth.user || auth.user.role !== "CONTRACTOR") return;
    async function loadProject() {
      try {
        const [profileResponse, projectResponse, mediaResponse] = await Promise.all([
          apiGet<ContractorProfile>("/contractors/me"),
          apiGet<Project>(`/projects/${params.projectId}`),
          apiGet<{ items: MediaAsset[] }>(`/projects/${params.projectId}/media?page=1&page_size=100`),
        ]);
        setProject(projectResponse);
        setMedia(mediaResponse.items);
        const reviewsResponse = await apiGet<{ items: Review[] }>(`/contractors/${profileResponse.id}/reviews?page=1&page_size=3`).catch(() => null);
        if (reviewsResponse) setReviews(reviewsResponse.items);
        const ratingResponse = await apiGet<RatingSummary>(`/contractors/${profileResponse.id}/rating`).catch(() => null);
        if (ratingResponse) setRating(ratingResponse);
        await refreshJourney();
      } catch (requestError) {
        setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not load this project.");
      }
    }
    loadProject();
  }, [auth.isLoading, auth.user, params.projectId, refreshJourney]);

  if (!auth.hasAccess) {
    return (
      <DashboardAccessPending
        label={
          auth.isLoading
            ? "Loading your workspace"
            : "Redirecting to your workspace..."
        }
      />
    );
  }

  if (error) return <div><Link href="/dashboard/projects" className="text-sm font-bold text-[#607068]">← Back to projects</Link><div className="mt-8 rounded-2xl border border-[#e8b9a8] bg-[#fff3ed] px-5 py-4 text-sm font-semibold text-[#a3482d]">{error}</div></div>;
  if (!project) return <div className="py-16 text-center text-sm font-semibold text-[#607068]">Loading project...</div>;

  return <div><Link href="/dashboard/projects" className="text-sm font-bold text-[#607068] transition hover:text-[#183c31]">← Back to projects</Link><div className="mt-6 flex flex-col justify-between gap-6 border-b border-[#d7d8d1] pb-8 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e26d42]">{project.project_type} · {project.city}, {project.state}</p><h1 className="mt-3 text-4xl font-black tracking-[-0.07em] text-[#183c31] sm:text-5xl">{project.title}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-[#607068]">{project.description ?? "No project description yet."}</p></div><span className="w-fit rounded-full bg-[#fff0e8] px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-[#a3482d]">{project.status}</span></div><div className="mt-8 grid gap-5 sm:grid-cols-3"><Metric label="Stages" value={journey ? journey.stages.length.toString() : "…"} /><Metric label="Media assets" value={media.length.toString()} /><Metric label="Rating" value={rating && rating.review_count ? rating.average_rating.toFixed(1) : "—"} /></div><section className="mt-10 rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">Construction journey</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">Progress at a glance</h2>{journeyError ? <div className="mt-6 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-5 py-4"><p className="text-sm font-semibold text-[#a3482d]" role="alert">{journeyError}</p><button type="button" onClick={() => void refreshJourney()} className="mt-3 rounded-lg bg-[#a3482d] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#183c31]">Retry</button></div> : !journey ? <p className="mt-6 text-sm font-semibold text-[#607068]">Loading construction journey…</p> : <ConstructionJourney projectId={project.id} stages={journey.stages} onJourneyChange={() => void refreshJourney()} />}</section><div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-[#d7d8d1] bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">Media</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">Project gallery</h2>{media.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-[#cdd2cb] bg-[#f9f8f4] px-5 py-8 text-center"><p className="text-sm font-bold text-[#183c31]">No media assets yet.</p><p className="mt-2 text-sm text-[#607068]">Attach photos or videos to your progress updates below — they appear in your public project gallery automatically.</p></div> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{media.map((item) => <figure key={item.id} className="overflow-hidden rounded-xl border border-[#e9e9e3] bg-white"><a href={item.url} target="_blank" rel="noreferrer" className="block">{item.media_type === "IMAGE" ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={item.thumbnail_url ?? item.url} alt={item.alt_text ?? item.caption ?? "Project media"} className="h-28 w-full object-cover transition duration-300 hover:scale-105 sm:h-32" loading="lazy" />) : <span className="flex h-28 items-center justify-center gap-1 bg-[#183c31] text-[10px] font-black uppercase tracking-[0.12em] text-white sm:h-32">▶ {item.media_type}</span>}</a><figcaption className="flex items-center justify-between gap-2 px-2.5 py-2"><span className="truncate text-[11px] font-semibold text-[#607068]">{item.caption ?? item.media_type}</span><span className="shrink-0 text-[9px] font-black uppercase tracking-[0.1em] text-[#8a9890]">{item.media_type}</span></figcaption></figure>)}</div>}</section><section className="rounded-2xl border border-[#d7d8d1] bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">Reputation</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">Client feedback</h2>{rating && rating.review_count > 0 ? <p className="mt-5 text-sm text-[#607068]"><strong className="text-3xl font-black text-[#183c31]">{rating.average_rating.toFixed(1)}</strong> average from {rating.review_count} reviews.</p> : <p className="mt-6 text-sm text-[#607068]">No reviews yet. Your work will speak first.</p>}{reviews.length > 0 && <div className="mt-5 space-y-3">{reviews.map((review) => <div key={review.id} className="border-t border-[#e9e9e3] pt-3 text-sm text-[#607068]">{"★".repeat(review.rating)} {review.comment ?? "No written comment"}</div>)}</div>}</section></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-[#d7d8d1] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a9890]">{label}</p><p className="mt-3 text-3xl font-black tracking-[-0.06em] text-[#183c31]">{value}</p></div>; }
