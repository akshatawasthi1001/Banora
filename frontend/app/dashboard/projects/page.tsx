"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { DashboardAccessPending } from "@/components/dashboard-shell";
import { ApiRequestError } from "@/lib/api/client";
import {
  createProject,
  deleteProject,
  getMyProjects,
  updateProject,
} from "@/lib/api/projects";
import { useRequireContractor } from "@/lib/auth-context";
import type {
  Project,
  ProjectInput,
  ProjectList,
  ProjectStatus,
  ProjectType,
} from "@/lib/api/types";

const projectTypes: ProjectType[] = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "RENOVATION",
  "INTERIOR",
  "OTHER",
];

const projectStatuses: ProjectStatus[] = ["ONGOING", "COMPLETED"];

const initialProject: ProjectInput = {
  title: "",
  description: "",
  project_type: "RESIDENTIAL",
  city: "",
  state: "",
  country: "",
  plot_area_sqft: null,
  built_up_area_sqft: null,
  floors: null,
  budget_min: null,
  budget_max: null,
  start_date: null,
  completion_date: null,
  status: "ONGOING",
};

const inputClasses =
  "mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]";

function formatMoney(value: number | null) {
  return value === null
    ? "Budget not set"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(
        new Date(`${value}T00:00:00`),
      )
    : "Date not set";
}

function toFormState(project: Project): ProjectInput {
  return {
    title: project.title,
    description: project.description,
    project_type: project.project_type,
    city: project.city,
    state: project.state,
    country: project.country,
    plot_area_sqft: project.plot_area_sqft,
    built_up_area_sqft: project.built_up_area_sqft,
    floors: project.floors,
    budget_min: project.budget_min,
    budget_max: project.budget_max,
    start_date: project.start_date,
    completion_date: project.completion_date,
    status: project.status,
  };
}

/** Mirrors the backend's ProjectCreate validation rules client-side. */
function validateForm(form: ProjectInput): string | null {
  if (!form.title.trim()) {
    return "Enter a project title.";
  }

  if (!form.city.trim() || !form.state.trim() || !form.country.trim()) {
    return "Enter the city, state, and country for this project.";
  }

  if (
    form.plot_area_sqft !== null &&
    form.plot_area_sqft !== undefined &&
    form.plot_area_sqft <= 0
  ) {
    return "Plot area must be greater than zero.";
  }

  if (
    form.built_up_area_sqft !== null &&
    form.built_up_area_sqft !== undefined &&
    form.built_up_area_sqft <= 0
  ) {
    return "Built-up area must be greater than zero.";
  }

  if (form.floors !== null && form.floors !== undefined && form.floors <= 0) {
    return "Floors must be greater than zero.";
  }

  if (form.budget_min !== null && form.budget_min !== undefined && form.budget_min < 0) {
    return "Minimum budget cannot be negative.";
  }

  if (form.budget_max !== null && form.budget_max !== undefined && form.budget_max < 0) {
    return "Maximum budget cannot be negative.";
  }

  if (
    form.budget_min !== null &&
    form.budget_min !== undefined &&
    form.budget_max !== null &&
    form.budget_max !== undefined &&
    form.budget_max < form.budget_min
  ) {
    return "Maximum budget must be greater than or equal to the minimum budget.";
  }

  if (
    form.start_date &&
    form.completion_date &&
    form.completion_date < form.start_date
  ) {
    return "Completion date must be on or after the start date.";
  }

  return null;
}

export default function ProjectsPage() {
  const auth = useRequireContractor();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectInput>(initialProject);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);

    try {
      const response: ProjectList = await getMyProjects();
      setProjects(response.items);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.detail
          : "We could not load your projects.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.isLoading || !auth.hasAccess) return;
    void (async () => {
      await loadProjects();
    })();
  }, [auth.hasAccess, auth.isLoading, loadProjects]);

  function updateField<K extends keyof ProjectInput>(
    field: K,
    value: ProjectInput[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(initialProject);
    setFormError(null);
    setShowForm(true);
  }

  // The delete confirmation dialog closes on Escape (cancelled safely).
  useEffect(() => {
    if (!deletingProject) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDeletingProject(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deletingProject]);

  function startEdit(project: Project) {
    setEditingId(project.id);
    setForm(toFormState(project));
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setError(null);

    const validationError = validateForm(form);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      if (editingId) {
        const updated = await updateProject(editingId, form);
        setProjects((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSuccess("Project updated successfully.");
      } else {
        const created = await createProject(form);
        setProjects((current) => [created, ...current]);
        setSuccess("Project created successfully.");
      }

      closeForm();
    } catch (requestError) {
      setFormError(
        requestError instanceof ApiRequestError
          ? requestError.detail
          : "We could not save this project.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingProject) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteProject(deletingProject.id);
      setProjects((current) =>
        current.filter((item) => item.id !== deletingProject.id),
      );
      setSuccess(`"${deletingProject.title}" was deleted.`);
      setDeletingProject(null);
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.detail
          : "We could not delete this project.",
      );
      setDeletingProject(null);
    } finally {
      setIsDeleting(false);
    }
  }

  if (!auth.hasAccess || (isLoading && projects.length === 0 && !error)) {
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

  return (
    <div>
      <div className="flex flex-col justify-between gap-6 border-b border-[#d7d8d1] pb-8 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">
            Your portfolio
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-[-0.07em] text-[#183c31] sm:text-5xl">
            Projects.
          </h1>

          <p className="mt-3 text-base leading-7 text-[#607068]">
            Keep the work you are proud of easy to find and easy to trust.
          </p>
        </div>

        <button
          onClick={startCreate}
          className="rounded-xl bg-[#e26d42] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#c95731]"
        >
          + Add project
        </button>
      </div>

      {error && (
        <p
          className="mt-6 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]"
          role="alert"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          className="mt-6 rounded-xl border border-[#bad8c5] bg-[#eef8f0] px-4 py-3 text-sm font-semibold text-[#286047]"
          role="status"
        >
          {success}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleSave}
          className="mt-8 rounded-2xl border border-[#d7d8d1] bg-white p-6 sm:p-8"
          noValidate
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">
                {editingId ? "Edit project" : "New project"}
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">
                A few useful details.
              </h2>
            </div>

            <button
              type="button"
              onClick={closeForm}
              className="text-sm font-bold text-[#607068] transition hover:text-[#183c31]"
            >
              Cancel
            </button>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-bold text-[#365048] sm:col-span-2">
              Title
              <input
                className={inputClasses}
                type="text"
                required
                maxLength={200}
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="e.g. Hillside villa, Phase 2"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Project type
              <select
                className={inputClasses}
                value={form.project_type}
                onChange={(event) =>
                  updateField("project_type", event.target.value as ProjectType)
                }
              >
                {projectTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Status
              <select
                className={inputClasses}
                value={form.status}
                onChange={(event) =>
                  updateField("status", event.target.value as ProjectStatus)
                }
              >
                {projectStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              City
              <input
                className={inputClasses}
                type="text"
                required
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Bengaluru"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              State
              <input
                className={inputClasses}
                type="text"
                required
                value={form.state}
                onChange={(event) => updateField("state", event.target.value)}
                placeholder="Karnataka"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Country
              <input
                className={inputClasses}
                type="text"
                required
                value={form.country}
                onChange={(event) => updateField("country", event.target.value)}
                placeholder="India"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Budget minimum (USD)
              <input
                className={inputClasses}
                type="number"
                min="0"
                step="1000"
                value={form.budget_min ?? ""}
                onChange={(event) =>
                  updateField(
                    "budget_min",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
                placeholder="e.g. 5000000"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Budget maximum (USD)
              <input
                className={inputClasses}
                type="number"
                min="0"
                step="1000"
                value={form.budget_max ?? ""}
                onChange={(event) =>
                  updateField(
                    "budget_max",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
                placeholder="e.g. 7500000"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Plot area (sqft)
              <input
                className={inputClasses}
                type="number"
                min="0"
                value={form.plot_area_sqft ?? ""}
                onChange={(event) =>
                  updateField(
                    "plot_area_sqft",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
                placeholder="e.g. 2400"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Built-up area (sqft)
              <input
                className={inputClasses}
                type="number"
                min="0"
                value={form.built_up_area_sqft ?? ""}
                onChange={(event) =>
                  updateField(
                    "built_up_area_sqft",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
                placeholder="e.g. 1800"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Floors
              <input
                className={inputClasses}
                type="number"
                min="1"
                value={form.floors ?? ""}
                onChange={(event) =>
                  updateField(
                    "floors",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
                placeholder="e.g. 2"
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Start date
              <input
                className={inputClasses}
                type="date"
                value={form.start_date ?? ""}
                onChange={(event) =>
                  updateField(
                    "start_date",
                    event.target.value === "" ? null : event.target.value,
                  )
                }
              />
            </label>

            <label className="block text-sm font-bold text-[#365048]">
              Completion date
              <input
                className={inputClasses}
                type="date"
                value={form.completion_date ?? ""}
                onChange={(event) =>
                  updateField(
                    "completion_date",
                    event.target.value === "" ? null : event.target.value,
                  )
                }
              />
            </label>

            <label className="block text-sm font-bold text-[#365048] sm:col-span-2">
              Description
              <textarea
                className={inputClasses}
                rows={4}
                value={form.description ?? ""}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="A short summary of the scope and character of this build."
              />
            </label>
          </div>

          {formError && (
            <p
              className="mt-6 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]"
              role="alert"
            >
              {formError}
            </p>
          )}

          <div className="mt-7 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-[#cdd2cb] px-5 py-3.5 text-sm font-bold text-[#365048] transition hover:border-[#183c31]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#183c31] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#285847] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving
                ? "Saving..."
                : editingId
                  ? "Save project"
                  : "Create project"}
            </button>
          </div>
        </form>
      )}

      {isLoading && !error ? (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-2xl bg-white"
            />
          ))}
        </div>
      ) : projects.length === 0 && !showForm ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#b9c2ba] bg-white px-6 py-16 text-center">
          <p className="text-xl font-black tracking-[-0.04em] text-[#183c31]">
            No projects yet.
          </p>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#607068]">
            Your portfolio starts with one project. Add the work that best
            represents your team.
          </p>

          <button
            onClick={startCreate}
            className="mt-6 rounded-lg bg-[#183c31] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#285847]"
          >
            Add your first project
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {projects.map((project) => (
            <article
              key={project.id}
              className="rounded-2xl border border-[#d7d8d1] bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e26d42]">
                    {project.project_type}
                  </span>

                  <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">
                    {project.title}
                  </h2>

                  <p className="mt-2 text-sm text-[#607068]">
                    {project.city}, {project.state}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${
                    project.status === "COMPLETED"
                      ? "bg-[#e5efe9] text-[#286047]"
                      : "bg-[#fff0e8] text-[#a3482d]"
                  }`}
                >
                  {project.status}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-y-4 border-t border-[#e9e9e3] pt-5 text-sm">
                <div>
                  <p className="text-[#8a9890]">Budget</p>

                  <p className="mt-1 font-bold text-[#365048]">
                    {project.budget_min !== null || project.budget_max !== null
                      ? `${formatMoney(project.budget_min)} – ${formatMoney(project.budget_max)}`
                      : "Budget not set"}
                  </p>
                </div>

                <div>
                  <p className="text-[#8a9890]">Built-up area</p>

                  <p className="mt-1 font-bold text-[#365048]">
                    {project.built_up_area_sqft
                      ? `${project.built_up_area_sqft.toLocaleString()} sqft`
                      : "Not set"}
                  </p>
                </div>

                <div>
                  <p className="text-[#8a9890]">Timeline</p>

                  <p className="mt-1 font-bold text-[#365048]">
                    {formatDate(project.start_date)}
                    {project.completion_date
                      ? ` → ${formatDate(project.completion_date)}`
                      : ""}
                  </p>
                </div>

                <div>
                  <p className="text-[#8a9890]">Floors</p>

                  <p className="mt-1 font-bold text-[#365048]">
                    {project.floors ?? "Not set"}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="rounded-lg bg-[#183c31] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#285847]"
                >
                  View project
                </Link>

                <button
                  onClick={() => startEdit(project)}
                  className="rounded-lg border border-[#cdd2cb] px-4 py-2.5 text-xs font-bold text-[#365048] transition hover:border-[#183c31]"
                >
                  Edit
                </button>

                <button
                  onClick={() => setDeletingProject(project)}
                  className="rounded-lg border border-[#e8b9a8] px-4 py-2.5 text-xs font-bold text-[#a3482d] transition hover:bg-[#fff3ed]"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {deletingProject && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#183c31]/50 px-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <h2
              id="delete-project-title"
              className="text-2xl font-black tracking-[-0.04em] text-[#183c31]"
            >
              Delete this project?
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#607068]">
              &quot;{deletingProject.title}&quot; will be removed from your
              portfolio and its public page. This cannot be undone.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                disabled={isDeleting}
                className="rounded-xl border border-[#cdd2cb] px-5 py-3 text-sm font-bold text-[#365048] transition hover:border-[#183c31] disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-[#a3482d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#8a3a24] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
