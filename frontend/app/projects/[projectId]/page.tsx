"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PublicNav } from "@/components/public-nav";
import { ApiRequestError, apiGet } from "@/lib/api/client";
import type { ContractorProfile, ConstructionStage, MediaAsset, Project, ProjectJourney, RatingSummary, Review } from "@/lib/api/types";

interface StageWithMedia extends ConstructionStage { progress_updates: Array<{ id: string; title: string; description: string | null; progress_percentage: number; update_date: string; media: MediaAsset[] }> }

export default function PublicProjectPage() {
  const params = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [journey, setJourney] = useState<StageWithMedia[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [rating, setRating] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProject() {
      try {
        const [projectResponse, journeyResponse, mediaResponse] = await Promise.all([
          apiGet<Project>(`/projects/${params.projectId}`),
          apiGet<ProjectJourney>(`/projects/${params.projectId}/journey`),
          apiGet<{ items: MediaAsset[] }>(`/projects/${params.projectId}/media?page=1&page_size=100`),
        ]);
        setProject(projectResponse);
        document.title = `${projectResponse.title} | Banora`;
        setMedia(mediaResponse.items);
        const contractorResponse = await apiGet<ContractorProfile>(`/contractors/${projectResponse.contractor_id}`);
        setContractor(contractorResponse);
        const [ratingResponse, reviewsResponse] = await Promise.all([
          apiGet<RatingSummary>(`/contractors/${projectResponse.contractor_id}/rating`),
          apiGet<{ items: Review[] }>(`/contractors/${projectResponse.contractor_id}/reviews?page=1&page_size=3`),
        ]);
        setRating(ratingResponse);
        setReviews(reviewsResponse.items);
        const hydratedStages = await Promise.all(journeyResponse.stages.map(async (stage) => ({ ...stage, progress_updates: await Promise.all(stage.progress_updates.map(async (update) => ({ ...update, media: await apiGet<MediaAsset[]>(`/projects/${params.projectId}/stages/${stage.id}/updates/${update.id}/media`).catch(() => []) }))) })));
        setJourney(hydratedStages);
      } catch (requestError) {
        if (requestError instanceof ApiRequestError && requestError.status === 404) setNotFound(true);
        else setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not load this project.");
      } finally {
        setLoading(false);
      }
    }
    void loadProject();
  }, [params.projectId]);

  return <main className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]"><PublicNav /><div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">{loading && <div className="py-24 text-center text-sm font-semibold text-[#607068]">Loading project...</div>}{notFound && <div className="mx-auto max-w-lg py-24 text-center"><h1 className="text-4xl font-black tracking-[-0.06em] text-[#183c31]">Project not found</h1><p className="mt-4 text-[#607068]">This project may have moved or is no longer public.</p><Link href="/contractors" className="mt-7 inline-block rounded-lg bg-[#183c31] px-5 py-3 text-sm font-bold text-white">Explore contractors</Link></div>}{error && <div className="mx-auto max-w-lg py-24 text-center"><h1 className="text-4xl font-black text-[#183c31]">Something went wrong</h1><p className="mt-4 text-[#607068]">{error}</p></div>}{!loading && !notFound && !error && project && <><header className="grid gap-8 border-b border-[#d7d8d1] py-10 sm:py-16 lg:grid-cols-[1fr_0.65fr] lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e26d42]">{project.project_type} · {project.city}, {project.state}</p><h1 className="mt-4 text-5xl font-black leading-[0.96] tracking-[-0.07em] text-[#183c31] sm:text-7xl">{project.title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#607068]">{project.description ?? "A project documented on Banora."}</p></div><div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a9890]">Built by</p>{contractor && <Link href={`/contractors/${contractor.id}`} className="mt-3 block text-2xl font-black tracking-[-0.05em] text-[#183c31] hover:text-[#e26d42]">{contractor.name}</Link>}<p className="mt-1 text-sm text-[#607068]">{contractor?.company_name ?? "Contractor profile"}</p><p className="mt-4 text-sm text-[#607068]">{contractor?.city}, {contractor?.state}</p>{contractor?.phone ? <a href={`tel:${contractor.phone}`} className="mt-5 inline-block rounded-lg bg-[#e26d42] px-4 py-3 text-sm font-bold text-white">Contact Contractor</a> : <p className="mt-5 text-sm font-semibold text-[#a3482d]">Contact feature coming soon</p>}</div></header><section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Status", project.status], ["Plot area", project.plot_area_sqft ? `${project.plot_area_sqft.toLocaleString()} sqft` : "Not listed"], ["Built-up area", project.built_up_area_sqft ? `${project.built_up_area_sqft.toLocaleString()} sqft` : "Not listed"], ["Floors", project.floors ? String(project.floors) : "Not listed"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#d7d8d1] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8a9890]">{label}</p><p className="mt-3 text-lg font-black text-[#183c31]">{value}</p></div>)}</section><section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">Portfolio media</p><h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">See the work.</h2>{media.length === 0 ? <p className="mt-6 text-sm text-[#607068]">No media has been added to this project yet.</p> : <div className="mt-6 grid grid-cols-2 gap-3">{media.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="group relative block aspect-[1.2] overflow-hidden rounded-xl bg-[#d9c6ae]"><img className="h-full w-full object-cover transition duration-300 group-hover:scale-105" src={item.thumbnail_url ?? item.url} alt={item.alt_text ?? item.caption ?? project.title} /><span className="absolute bottom-2 left-2 rounded bg-[#183c31]/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">{item.media_type}</span></a>)}</div>}</div><div className="rounded-2xl bg-[#183c31] p-7 text-[#f4f1eb]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f0b39b]">Trust context</p><div className="mt-5 text-5xl font-black">{rating && rating.review_count ? rating.average_rating.toFixed(1) : "—"}</div><p className="mt-2 text-sm text-[#c6d3cc]">{rating?.review_count ?? 0} client reviews for this contractor</p>{reviews.slice(0, 2).map((review) => <div key={review.id} className="mt-6 border-t border-[#44665a] pt-4"><p className="text-[#f0b39b]">{"★".repeat(review.rating)}</p><p className="mt-2 text-sm leading-6 text-[#c6d3cc]">{review.comment ?? "No written comment."}</p></div>)}<Link href={contractor ? `/contractors/${contractor.id}` : "/contractors"} className="mt-7 inline-block text-sm font-bold text-[#f0b39b]">View contractor profile →</Link></div></section><section className="mt-10 rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">The build story</p><h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">Construction journey</h2></div><p className="text-sm font-semibold text-[#607068]">{journey.length} recorded stage{journey.length === 1 ? "" : "s"}</p></div>{journey.length === 0 ? <p className="mt-7 text-sm text-[#607068]">No construction journey updates yet.</p> : <div className="mt-8 space-y-7">{journey.map((stage, index) => <div key={stage.id} className="relative pl-12"><span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#e5efe9] text-xs font-black text-[#286047]">{index + 1}</span>{index < journey.length - 1 && <span className="absolute bottom-[-28px] left-[15px] top-8 w-px bg-[#cddbd2]" />}<div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black tracking-[-0.04em] text-[#183c31]">{stage.name}</h3><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${stage.status === "COMPLETED" ? "bg-[#e5efe9] text-[#286047]" : "bg-[#fff0e8] text-[#a3482d]"}`}>{stage.status.replace("_", " ")}</span></div>{stage.progress_updates.length === 0 ? <p className="mt-2 text-sm text-[#8a9890]">No updates recorded.</p> : <div className="mt-3 space-y-3">{stage.progress_updates.map((update) => <div key={update.id} className="rounded-xl bg-[#f4f1eb] p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold text-[#365048]">{update.title}</p><span className="text-xs font-black text-[#e26d42]">{update.progress_percentage}%</span></div><p className="mt-1 text-sm leading-6 text-[#607068]">{update.description ?? "Progress update recorded."}</p>{update.media.length > 0 && <div className="mt-3 flex gap-2">{update.media.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#a3482d]">View update media ↗</a>)}</div>}</div>)}</div>}</div>)}</div>}</section></>}</div></main>;
}
