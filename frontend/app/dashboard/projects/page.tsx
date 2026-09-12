"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { ApiRequestError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { useRequireContractor } from "@/lib/auth-context";
import type { Project, ProjectInput, ProjectList, ProjectStatus, ProjectType } from "@/lib/api/types";

const projectTypes: ProjectType[] = ["RESIDENTIAL", "COMMERCIAL", "RENOVATION", "INTERIOR", "OTHER"];
const initialProject: ProjectInput = { title: "", description: "", project_type: "RESIDENTIAL", city: "", state: "", country: "", status: "ONGOING" };

function formatMoney(value: number | null) {
  return value === null ? "Budget not set" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "Date not set";
}

export default function ProjectsPage() {
  const auth = useRequireContractor();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectInput>(initialProject);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function loadProjects() {
    setIsLoading(true);
    try {
      const response = await apiGet<ProjectList>("/projects/me?page=1&page_size=100");
      setProjects(response.items);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not load your projects.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (auth.isLoading || !auth.user || auth.user.role !== "CONTRACTOR") return;
    void (async () => {
      await loadProjects();
    })();
  }, [auth.isLoading, auth.user]);

  function startCreate() {
    setEditingId(null);
    setForm(initialProject);
    setShowForm(true);
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setForm({ title: project.title, description: project.description, project_type: project.project_type, city: project.city, state: project.state, country: project.country, status: project.status });
    setShowForm(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      if (editingId) await apiPatch<Project>(`/projects/me/${editingId}`, form);
      else await apiPost<Project>("/projects", form);
      setShowForm(false);
      setEditingId(null);
      await loadProjects();
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not save this project.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(`Delete ${project.title}? This cannot be undone.`)) return;
    try {
      await apiDelete(`/projects/me/${project.id}`);
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not delete this project.");
    }
  }

  if (isLoading || !auth.user) return null;

  return (
    <div>
      <div className="flex flex-col justify-between gap-6 border-b border-[#d7d8d1] pb-8 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">Your portfolio</p><h1 className="mt-3 text-4xl font-black tracking-[-0.07em] text-[#183c31] sm:text-5xl">Projects.</h1><p className="mt-3 text-base leading-7 text-[#607068]">Keep the work you are proud of easy to find and easy to trust.</p></div><button onClick={startCreate} className="rounded-xl bg-[#e26d42] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#c95731]">+ Add project</button></div>
      {error && <p className="mt-6 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]" role="alert">{error}</p>}
      {showForm && <form onSubmit={handleSave} className="mt-8 rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">{editingId ? "Edit project" : "New project"}</p><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">A few useful details.</h2></div><button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-[#607068]">Cancel</button></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold text-[#365048] sm:col-span-2">Title<input required className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31]" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="block text-sm font-bold text-[#365048]">Project type<select className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31]" value={form.project_type} onChange={(event) => setForm({ ...form, project_type: event.target.value as ProjectType })}>{projectTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="block text-sm font-bold text-[#365048]">Status<select className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31]" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })}><option>ONGOING</option><option>COMPLETED</option></select></label><label className="block text-sm font-bold text-[#365048]">City<input required className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31]" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label className="block text-sm font-bold text-[#365048]">State<input required className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31]" value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></label><label className="block text-sm font-bold text-[#365048]">Country<input required className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31]" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label><label className="block text-sm font-bold text-[#365048] sm:col-span-2">Description<textarea className="mt-2 min-h-24 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31]" value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><button disabled={isSaving} className="mt-7 rounded-xl bg-[#183c31] px-6 py-3.5 text-sm font-bold text-white disabled:opacity-60">{isSaving ? "Saving..." : editingId ? "Save project" : "Create project"}</button></form>}
      {projects.length === 0 && !showForm ? <div className="mt-8 rounded-2xl border border-dashed border-[#b9c2ba] bg-white px-6 py-16 text-center"><p className="text-xl font-black tracking-[-0.04em] text-[#183c31]">No projects yet.</p><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#607068]">Your portfolio starts with one project. Add the work that best represents your team.</p><button onClick={startCreate} className="mt-6 rounded-lg bg-[#183c31] px-5 py-3 text-sm font-bold text-white">Add your first project</button></div> : <div className="mt-8 grid gap-5 lg:grid-cols-2">{projects.map((project) => <article key={project.id} className="rounded-2xl border border-[#d7d8d1] bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)]"><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e26d42]">{project.project_type}</span><h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">{project.title}</h2><p className="mt-2 text-sm text-[#607068]">{project.city}, {project.state}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${project.status === "COMPLETED" ? "bg-[#e5efe9] text-[#286047]" : "bg-[#fff0e8] text-[#a3482d]"}`}>{project.status}</span></div><div className="mt-6 grid grid-cols-2 gap-y-4 border-t border-[#e9e9e3] pt-5 text-sm"><div><p className="text-[#8a9890]">Budget</p><p className="mt-1 font-bold text-[#365048]">{formatMoney(project.budget_min ?? project.budget_max)}</p></div><div><p className="text-[#8a9890]">Built-up area</p><p className="mt-1 font-bold text-[#365048]">{project.built_up_area_sqft ? `${project.built_up_area_sqft.toLocaleString()} sqft` : "Not set"}</p></div><div><p className="text-[#8a9890]">Timeline</p><p className="mt-1 font-bold text-[#365048]">{formatDate(project.start_date)}</p></div><div><p className="text-[#8a9890]">Floors</p><p className="mt-1 font-bold text-[#365048]">{project.floors ?? "Not set"}</p></div></div><div className="mt-6 flex flex-wrap gap-2"><Link href={`/dashboard/projects/${project.id}`} className="rounded-lg bg-[#183c31] px-4 py-2.5 text-xs font-bold text-white">View project</Link><button onClick={() => startEdit(project)} className="rounded-lg border border-[#cdd2cb] px-4 py-2.5 text-xs font-bold text-[#365048]">Edit</button><button onClick={() => handleDelete(project)} className="rounded-lg border border-[#e8b9a8] px-4 py-2.5 text-xs font-bold text-[#a3482d]">Delete</button></div></article>)}</div>}
    </div>
  );
}
