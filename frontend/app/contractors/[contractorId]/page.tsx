"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PublicNav } from "@/components/public-nav";
import { ApiRequestError, apiGet } from "@/lib/api/client";
import type { ContractorProfile, MediaAsset, Project, ProjectList, RatingSummary, Review } from "@/lib/api/types";

interface ProjectWithMedia extends Project { media: MediaAsset[] }

export default function ContractorDetailPage() {
  const params = useParams<{ contractorId: string }>();
  const [contractor, setContractor] = useState<ContractorProfile | null>(null);
  const [rating, setRating] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [projects, setProjects] = useState<ProjectWithMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContractor() {
      try {
        const [profileResponse, ratingResponse, reviewsResponse, projectsResponse] = await Promise.all([
          apiGet<ContractorProfile>(`/contractors/${params.contractorId}`),
          apiGet<RatingSummary>(`/contractors/${params.contractorId}/rating`),
          apiGet<{ items: Review[] }>(`/contractors/${params.contractorId}/reviews?page=1&page_size=6`),
          apiGet<ProjectList>(`/projects?contractor_id=${params.contractorId}&page=1&page_size=100`),
        ]);
        setContractor(profileResponse);
        document.title = `${profileResponse.name} | Banora`;
        setRating(ratingResponse);
        setReviews(reviewsResponse.items);
        const projectsWithMedia = await Promise.all(projectsResponse.items.map(async (project) => {
          const mediaResponse = await apiGet<{ items: MediaAsset[] }>(`/projects/${project.id}/media?page=1&page_size=1`).catch(() => ({ items: [] }));
          return { ...project, media: mediaResponse.items };
        }));
        setProjects(projectsWithMedia);
      } catch (requestError) {
        if (requestError instanceof ApiRequestError && requestError.status === 404) setNotFound(true);
        else setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not load this contractor.");
      } finally {
        setIsLoading(false);
      }
    }
    void loadContractor();
  }, [params.contractorId]);

  return <main className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]"><PublicNav /><div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-12">{isLoading && <div className="py-24 text-center text-sm font-semibold text-[#607068]">Loading contractor profile...</div>}{notFound && <EmptyPage title="Contractor not found" body="This profile may have moved or is no longer available." />}{error && <EmptyPage title="Something went wrong" body={error} />}{!isLoading && !notFound && !error && contractor && <><section className="grid gap-8 border-b border-[#d7d8d1] py-10 sm:py-16 lg:grid-cols-[1fr_0.7fr] lg:items-end"><div><div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#d9c6ae] text-3xl font-black text-[#183c31]">{contractor.profile_image_url ? <img className="h-full w-full object-cover" src={contractor.profile_image_url} alt={`${contractor.name} profile`} /> : contractor.name.slice(0, 1).toUpperCase()}</div><p className="mt-8 text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">Contractor profile</p><h1 className="mt-3 text-5xl font-black leading-[0.96] tracking-[-0.07em] text-[#183c31] sm:text-7xl">{contractor.name}</h1><p className="mt-4 text-lg font-semibold text-[#607068]">{contractor.company_name ?? "Independent contractor"}</p><p className="mt-4 text-base text-[#607068]">{contractor.city}, {contractor.state}, {contractor.country}</p><p className="mt-6 max-w-2xl text-lg leading-8 text-[#607068]">{contractor.bio ?? "This contractor has not added a bio yet."}</p></div><aside className="rounded-2xl bg-[#183c31] p-7 text-[#f4f1eb]"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f0b39b]">Trust signals</p><div className="mt-6 flex items-end gap-3"><span className="text-5xl font-black tracking-[-0.08em]">{rating && rating.review_count ? rating.average_rating.toFixed(1) : "—"}</span><span className="pb-2 text-sm text-[#c6d3cc]">{rating?.review_count ?? 0} reviews</span></div><div className="mt-6 space-y-2">{[5, 4, 3, 2, 1].map((star) => <div key={star} className="flex items-center gap-3 text-xs"><span className="w-3 text-[#f0b39b]">{star}</span><div className="h-1.5 flex-1 rounded-full bg-[#44665a]"><div className="h-full rounded-full bg-[#e26d42]" style={{ width: `${rating && rating.review_count ? ((rating.rating_distribution[String(star)] ?? 0) / rating.review_count) * 100 : 0}%` }} /></div><span className="w-4 text-right text-[#91aaa0]">{rating?.rating_distribution[String(star)] ?? 0}</span></div>)}</div><div className="mt-7 border-t border-[#44665a] pt-5"><p className="text-sm text-[#c6d3cc]">{contractor.experience_years} years of experience</p>{contractor.phone ? <a href={`tel:${contractor.phone}`} className="mt-4 inline-block rounded-lg bg-[#e26d42] px-4 py-3 text-sm font-bold text-white">Contact Contractor</a> : <span className="mt-4 inline-block text-sm font-semibold text-[#f0b39b]">Contact feature coming soon</span>}</div></aside></section><section className="mt-12"><div className="flex items-end justify-between border-b border-[#d7d8d1] pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e26d42]">Selected work</p><h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">Project portfolio</h2></div><span className="text-sm font-semibold text-[#607068]">{projects.length} project{projects.length === 1 ? "" : "s"}</span></div>{projects.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#b9c2ba] bg-white px-6 py-14 text-center text-sm text-[#607068]">No public projects yet.</div> : <div className="mt-6 grid gap-5 md:grid-cols-2">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>}</section><section className="mt-12"><div className="border-b border-[#d7d8d1] pb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#e26d42]">Client perspective</p><h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#183c31]">Reviews</h2></div>{reviews.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-[#b9c2ba] bg-white px-6 py-14 text-center text-sm text-[#607068]">No reviews yet.</div> : <div className="mt-6 grid gap-4 md:grid-cols-2">{reviews.map((review) => <div key={review.id} className="rounded-2xl border border-[#d7d8d1] bg-white p-6"><p className="text-[#e26d42]">{"★".repeat(review.rating)}<span className="text-[#d7d8d1]">{"★".repeat(5 - review.rating)}</span></p><p className="mt-4 text-sm leading-7 text-[#607068]">{review.comment ?? "No written comment."}</p><p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#8a9890]">Verified Banora review</p></div>)}</div>}</section></>}</div></main>;
}

function ProjectCard({ project }: { project: ProjectWithMedia }) { return <article className="overflow-hidden rounded-2xl border border-[#d7d8d1] bg-white shadow-[0_10px_30px_rgba(24,60,49,0.04)]">{project.media[0] ? <div className="h-44 bg-[#d9c6ae]"><img className="h-full w-full object-cover" src={project.media[0].thumbnail_url ?? project.media[0].url} alt={project.media[0].alt_text ?? project.title} /></div> : <div className="flex h-44 items-end bg-[#d9c6ae] p-5"><span className="text-xs font-black uppercase tracking-[0.18em] text-[#6f513b]">{project.project_type}</span></div>}<div className="p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="text-2xl font-black tracking-[-0.05em] text-[#183c31]">{project.title}</h3><p className="mt-2 text-sm text-[#607068]">{project.city}, {project.state}</p></div><span className="rounded-full bg-[#e5efe9] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#286047]">{project.status}</span></div><div className="mt-5 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a9890]">{project.built_up_area_sqft ? `${project.built_up_area_sqft.toLocaleString()} sqft` : "Portfolio project"}</p><Link href={`/projects/${project.id}`} className="text-sm font-black text-[#e26d42] hover:text-[#a3482d]">View project ↗</Link></div></div></article>; }

function EmptyPage({ title, body }: { title: string; body: string }) { return <div className="mx-auto max-w-lg py-24 text-center"><h1 className="text-4xl font-black tracking-[-0.06em] text-[#183c31]">{title}</h1><p className="mt-4 text-base leading-7 text-[#607068]">{body}</p><Link href="/contractors" className="mt-7 inline-block rounded-lg bg-[#183c31] px-5 py-3 text-sm font-bold text-white">Back to contractors</Link></div>; }
