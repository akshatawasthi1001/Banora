"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { ApiRequestError, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { DashboardAccessPending } from "@/components/dashboard-shell";
import { useRequireContractor } from "@/lib/auth-context";
import type { ContractorProfile, ContractorProfileInput } from "@/lib/api/types";

const emptyForm: ContractorProfileInput = {
  name: "",
  company_name: null,
  bio: null,
  profile_image_url: null,
  phone: null,
  city: "",
  state: "",
  country: "",
  latitude: null,
  longitude: null,
  experience_years: 0,
};

type FormErrors = Partial<Record<keyof ContractorProfileInput, string>>;

function profileToForm(response: ContractorProfile): ContractorProfileInput {
  return {
    name: response.name,
    company_name: response.company_name,
    bio: response.bio,
    profile_image_url: response.profile_image_url,
    phone: response.phone,
    city: response.city,
    state: response.state,
    country: response.country,
    latitude: response.latitude,
    longitude: response.longitude,
    experience_years: response.experience_years,
  };
}

/** Client-side validation mirroring backend ContractorProfileUpdate rules. */
function validateProfile(form: ContractorProfileInput): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  if (!form.city.trim()) errors.city = "City is required.";
  if (!form.state.trim()) errors.state = "State is required.";
  if (!form.country.trim()) errors.country = "Country is required.";
  if (!Number.isInteger(form.experience_years) || form.experience_years < 0) {
    errors.experience_years = "Experience must be a whole number of 0 or more.";
  }
  if (form.latitude !== null && (form.latitude < -90 || form.latitude > 90)) {
    errors.latitude = "Latitude must be between -90 and 90.";
  }
  if (form.longitude !== null && (form.longitude < -180 || form.longitude > 180)) {
    errors.longitude = "Longitude must be between -180 and 180.";
  }
  return errors;
}

function normalizeForm(form: ContractorProfileInput): ContractorProfileInput {
  return {
    ...form,
    name: form.name.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    country: form.country.trim(),
    experience_years: Math.max(0, Math.floor(form.experience_years || 0)),
  };
}

export default function ProfilePage() {
  const auth = useRequireContractor();
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [form, setForm] = useState<ContractorProfileInput>(emptyForm);
  const [savedForm, setSavedForm] = useState<ContractorProfileInput>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  // True when the backend returned 404 for /contractors/me: the account exists
  // but no profile has been created yet, so we offer the create flow instead.
  const [notFound, setNotFound] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<ContractorProfileInput>(emptyForm);
  const [createErrors, setCreateErrors] = useState<FormErrors>({});

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm],
  );

  // Warn before closing/refreshing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (auth.isLoading || !auth.user || auth.user.role !== "CONTRACTOR") return;
    let cancelled = false;
    apiGet<ContractorProfile>("/contractors/me")
      .then((response) => {
        if (cancelled) return;
        const next = profileToForm(response);
        setProfile(response);
        setForm(next);
        setSavedForm(next);
      })
      .catch((requestError) => {
        if (cancelled) return;
        if (requestError instanceof ApiRequestError && requestError.status === 404) {
          setNotFound(true);
          return;
        }
        setError(
          requestError instanceof ApiRequestError
            ? requestError.detail
            : "We could not load your profile.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isLoading, auth.user]);

  function updateField<K extends keyof ContractorProfileInput>(field: K, value: ContractorProfileInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess(null);
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const nextForm = normalizeForm(form);
    const errors = validateProfile(nextForm);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await apiPatch<ContractorProfile>("/contractors/me", nextForm);
      const hydrated = profileToForm(response);
      setProfile(response);
      setForm(hydrated);
      setSavedForm(hydrated);
      setSuccess("Profile updated successfully. Your public profile now reflects these changes.");
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.detail
          : "We could not save those changes.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function discardChanges() {
    setForm(savedForm);
    setFieldErrors({});
    setSuccess(null);
    setError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const nextForm = normalizeForm(createForm);
    const errors = validateProfile(nextForm);
    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setIsCreating(true);
    try {
      const response = await apiPost<ContractorProfile>("/contractors/profile", nextForm);
      const hydrated = profileToForm(response);
      setProfile(response);
      setForm(hydrated);
      setSavedForm(hydrated);
      setNotFound(false);
      setSuccess("Profile created successfully. It is now visible on your public page.");
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.detail
          : "We could not create your profile.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  // Completeness based on real, saved profile data only (backend-supported fields).
  const completeness = profile
    ? [
        { label: "Name", done: Boolean(profile.name.trim()) },
        { label: "Location (city, state, country)", done: Boolean(profile.city.trim() && profile.state.trim() && profile.country.trim()) },
        { label: "Company name", done: Boolean(profile.company_name) },
        { label: "Bio", done: Boolean(profile.bio && profile.bio.trim()) },
        { label: "Profile photo", done: Boolean(profile.profile_image_url) },
        { label: "Phone", done: Boolean(profile.phone) },
        { label: "Experience years", done: profile.experience_years > 0 },
      ]
    : [];
  const completedCount = completeness.filter((item) => item.done).length;
  const completenessPercent = completeness.length
    ? Math.round((completedCount / completeness.length) * 100)
    : 0;

  if (!auth.hasAccess || isLoading) {
    return (
      <DashboardAccessPending
        label={auth.isLoading ? "Loading your workspace" : "Redirecting to your workspace..."}
      />
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="border-b border-[#d7d8d1] pb-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">Your presence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.07em] text-[#183c31] sm:text-5xl">Contractor profile.</h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-[#607068]">
          Give clients the context they need to choose your work with confidence.
        </p>
        {profile && (
          <Link
            href={`/contractors/${profile.id}`}
            className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#e26d42] transition hover:text-[#a3482d]"
          >
            View your public profile <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>

      {notFound && !profile ? (
        <form
          onSubmit={handleCreate}
          className="mt-8 rounded-2xl border border-[#d7d8d1] bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)] sm:p-8"
        >
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">Get started</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#183c31]">Create your contractor profile.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#607068]">
            Add your name and location to appear in the Banora network — you can refine everything else afterwards.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field
              label="Name"
              value={createForm.name}
              onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))}
              error={createErrors.name}
              required
            />
            <Field
              label="Company name"
              value={createForm.company_name ?? ""}
              onChange={(value) => setCreateForm((current) => ({ ...current, company_name: value || null }))}
            />
            <Field
              label="City"
              value={createForm.city}
              onChange={(value) => setCreateForm((current) => ({ ...current, city: value }))}
              error={createErrors.city}
              required
            />
            <Field
              label="State"
              value={createForm.state}
              onChange={(value) => setCreateForm((current) => ({ ...current, state: value }))}
              error={createErrors.state}
              required
            />
            <Field
              label="Country"
              value={createForm.country}
              onChange={(value) => setCreateForm((current) => ({ ...current, country: value }))}
              error={createErrors.country}
              required
            />
            <NumberField
              label="Experience years"
              value={createForm.experience_years}
              onValueChange={(value) => setCreateForm((current) => ({ ...current, experience_years: value ?? 0 }))}
              error={createErrors.experience_years}
              min={0}
              step={1}
            />
          </div>
          {error && (
            <p
              className="mt-6 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-xl bg-[#183c31] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#285847] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Creating profile..." : "Create profile"}
            </button>
          </div>
        </form>
      ) : error && !profile ? (
        <div
          className="mt-8 rounded-2xl border border-[#e8b9a8] bg-[#fff3ed] p-6 text-sm font-semibold text-[#a3482d]"
          role="alert"
        >
          {error}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-3 underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {profile && (
            <section className="mt-8 rounded-2xl border border-[#d7d8d1] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e26d42]">Profile completeness</p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#183c31]">
                    {completedCount} of {completeness.length} details added
                  </h2>
                </div>
                <p className="text-3xl font-black tracking-[-0.05em] text-[#183c31]">{completenessPercent}%</p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f4f1eb]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#286047] to-[#e26d42] transition-all"
                  style={{ width: `${completenessPercent}%` }}
                />
              </div>
              <ul className="mt-4 flex flex-wrap gap-2">
                {completeness.map((item) => (
                  <li
                    key={item.label}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                      item.done ? "bg-[#e5efe9] text-[#286047]" : "bg-[#f4f1eb] text-[#8a9890]"
                    }`}
                  >
                    <span aria-hidden="true">{item.done ? "✓" : "○"}</span> {item.label}
                  </li>
                ))}
              </ul>
              {completenessPercent < 100 && (
                <p className="mt-3 text-xs text-[#607068]">
                  Complete the items above to help clients choose with confidence — everything here appears on your public profile.
                </p>
              )}
            </section>
          )}
        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-2xl border border-[#d7d8d1] bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)] sm:p-8"
        >
          {isDirty && (
            <p
              className="mb-6 rounded-xl border border-[#e5d9a8] bg-[#fffaed] px-4 py-3 text-sm font-semibold text-[#8a6d1d]"
              role="status"
            >
              You have unsaved changes.
            </p>
          )}
          {error && (
            <p
              className="mb-6 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]"
              role="alert"
            >
              {error}
            </p>
          )}
          {success && (
            <p
              className="mb-6 rounded-xl border border-[#bad8c5] bg-[#eef8f0] px-4 py-3 text-sm font-semibold text-[#286047]"
              role="status"
            >
              {success}
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Name"
              value={form.name}
              onChange={(value) => updateField("name", value)}
              error={fieldErrors.name}
              required
            />
            <Field
              label="Company name"
              value={form.company_name ?? ""}
              onChange={(value) => updateField("company_name", value || null)}
            />
            <Field
              label="Phone"
              value={form.phone ?? ""}
              onChange={(value) => updateField("phone", value || null)}
            />
            <Field
              label="Profile image URL"
              value={form.profile_image_url ?? ""}
              onChange={(value) => updateField("profile_image_url", value || null)}
            />
            <Field
              label="City"
              value={form.city}
              onChange={(value) => updateField("city", value)}
              error={fieldErrors.city}
              required
            />
            <Field
              label="State"
              value={form.state}
              onChange={(value) => updateField("state", value)}
              error={fieldErrors.state}
              required
            />
            <Field
              label="Country"
              value={form.country}
              onChange={(value) => updateField("country", value)}
              error={fieldErrors.country}
              required
            />
            <NumberField
              label="Experience years"
              value={form.experience_years}
              onValueChange={(value) => updateField("experience_years", value ?? 0)}
              error={fieldErrors.experience_years}
              min={0}
              step={1}
            />
            <NumberField
              label="Latitude (optional)"
              value={form.latitude}
              onValueChange={(value) => updateField("latitude", value)}
              error={fieldErrors.latitude}
              min={-90}
              max={90}
              step="any"
            />
            <NumberField
              label="Longitude (optional)"
              value={form.longitude}
              onValueChange={(value) => updateField("longitude", value)}
              error={fieldErrors.longitude}
              min={-180}
              max={180}
              step="any"
            />
            <label className="block text-sm font-bold text-[#365048] sm:col-span-2">
              Bio
              <textarea
                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 font-medium outline-none focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]"
                value={form.bio ?? ""}
                onChange={(event) => updateField("bio", event.target.value || null)}
                placeholder="A short introduction to your work"
              />
            </label>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={discardChanges}
              className="rounded-xl border border-[#cdd2cb] px-5 py-3 text-sm font-bold text-[#365048] transition hover:border-[#183c31] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Discard changes
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#183c31] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#285847] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving changes..." : "Save profile"}
            </button>
          </div>
        </form>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block text-sm font-bold text-[#365048]">
      {label}
      <input
        className={`mt-2 w-full rounded-xl border bg-[#fcfcfa] px-4 py-3 outline-none focus:ring-2 focus:ring-[#dce7df] ${
          error ? "border-[#c2502c]" : "border-[#cdd2cb] focus:border-[#183c31]"
        }`}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <span className="mt-2 block text-xs font-semibold text-[#c2502c]" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function NumberField({
  label,
  value,
  onValueChange,
  error,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number | null;
  onValueChange: (value: number | null) => void;
  error?: string;
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  return (
    <label className="block text-sm font-bold text-[#365048]">
      {label}
      <input
        className={`mt-2 w-full rounded-xl border bg-[#fcfcfa] px-4 py-3 outline-none focus:ring-2 focus:ring-[#dce7df] ${
          error ? "border-[#c2502c]" : "border-[#cdd2cb] focus:border-[#183c31]"
        }`}
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onValueChange(null);
            return;
          }
          const parsed = Number(raw);
          onValueChange(Number.isFinite(parsed) ? parsed : null);
        }}
      />
      {error && (
        <span className="mt-2 block text-xs font-semibold text-[#c2502c]" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
