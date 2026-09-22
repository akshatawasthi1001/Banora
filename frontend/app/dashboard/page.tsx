"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ApiRequestError, apiGet } from "@/lib/api/client";
import { DashboardAccessPending } from "@/components/dashboard-shell";
import { useRequireContractor } from "@/lib/auth-context";
import type { ContractorProfile, Project, ProjectList, RatingSummary } from "@/lib/api/types";

export default function DashboardPage() {
  const auth = useRequireContractor();
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rating, setRating] = useState<RatingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isLoading || !auth.user || auth.user.role !== "CONTRACTOR") return;
    async function loadDashboard() {
      try {
        const [profileResponse, projectsResponse] = await Promise.all([
          apiGet<ContractorProfile>("/contractors/me"),
          apiGet<ProjectList>("/projects/me?page=1&page_size=100"),
        ]);
        setProfile(profileResponse);
        setProjects(projectsResponse.items);
        try {
          setRating(await apiGet<RatingSummary>(`/contractors/${profileResponse.id}/rating`));
        } catch {
          setRating(null);
        }
      } catch (requestError) {
        setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not load your dashboard.");
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, [auth.isLoading, auth.user]);

  if (!auth.hasAccess || isLoading) {
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
  const ongoingProjects = projects.filter((project) => project.status === "ONGOING").length;
  const completedProjects = projects.filter((project) => project.status === "COMPLETED").length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-6 border-b border-[#d7d8d1] pb-8 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">Overview</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.07em] text-[#183c31] sm:text-5xl">Welcome back, {profile?.name ?? "contractor"}.</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[#607068]">A clear view of the work you are building and the reputation behind it.</p>
        </div>
        <Link href="/dashboard/projects" className="rounded-xl bg-[#183c31] px-5 py-3.5 text-center text-sm font-bold text-white transition hover:bg-[#285847]">Manage projects ↗</Link>
      </div>

      {error && <div className="mt-6 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]" role="alert">{error}<button type="button" onClick={() => window.location.reload()} className="ml-3 underline underline-offset-2 hover:no-underline">Try again</button></div>}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard statistics">
        {[
          { label: "Total projects", value: projects.length.toString(), note: "Across your portfolio" },
          { label: "Ongoing", value: ongoingProjects.toString(), note: "Currently in progress" },
          { label: "Completed", value: completedProjects.toString(), note: "Ready to showcase" },
          { label: "Rating", value: rating && rating.review_count > 0 ? rating.average_rating.toFixed(1) : "—", note: rating ? `${rating.review_count} public reviews` : "No reviews yet" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[#d7d8d1] bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a9890]">{stat.label}</p>
            <p className="mt-5 text-4xl font-black tracking-[-0.07em] text-[#183c31]">{stat.value}</p>
            <p className="mt-2 text-sm text-[#607068]">{stat.note}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">Portfolio pulse</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">Recent projects</h2></div>
            <Link href="/dashboard/projects" className="text-sm font-bold text-[#365048] hover:text-[#e26d42]">View all</Link>
          </div>
          {projects.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-[#cdd2cb] px-5 py-10 text-center"><p className="font-bold text-[#183c31]">No projects yet.</p><p className="mt-2 text-sm text-[#607068]">Add your first project to start your public portfolio.</p><Link href="/dashboard/projects" className="mt-5 inline-block rounded-lg bg-[#e26d42] px-4 py-2.5 text-sm font-bold text-white">Add a project</Link></div>
          ) : <div className="mt-6 divide-y divide-[#e9e9e3]">{projects.slice(0, 4).map((project) => <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="flex items-center justify-between gap-4 py-4 transition hover:bg-[#faf9f6]"><div><p className="font-bold text-[#183c31]">{project.title}</p><p className="mt-1 text-sm text-[#607068]">{project.city}, {project.state} · {project.project_type}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${project.status === "COMPLETED" ? "bg-[#e5efe9] text-[#286047]" : "bg-[#fff0e8] text-[#a3482d]"}`}>{project.status}</span></Link>)}</div>}
        </div>
        <div className="rounded-2xl bg-[#d9c6ae] p-7 text-[#183c31] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8e553f]">Profile health</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.05em]">Make the first impression count.</h2>
          <p className="mt-4 text-sm leading-6 text-[#4d6359]">Keep your location, experience, and story current so clients know who is behind the work.</p>
          <div className="mt-8 border-t border-[#b89b7d] pt-5"><p className="text-3xl font-black">{profile?.experience_years ?? 0}</p><p className="mt-1 text-sm font-semibold text-[#607068]">years of experience</p></div>
          <Link href="/dashboard/profile" className="mt-8 inline-block rounded-lg bg-[#183c31] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#285847]">Review profile →</Link>
        </div>
      </section>
    </div>
  );
}
