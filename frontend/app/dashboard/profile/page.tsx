"use client";

import { FormEvent, useEffect, useState } from "react";

import { ApiRequestError, apiGet, apiPatch } from "@/lib/api/client";
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
  experience_years: 0,
};

export default function ProfilePage() {
  const auth = useRequireContractor();
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [form, setForm] = useState<ContractorProfileInput>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (auth.isLoading || !auth.user || auth.user.role !== "CONTRACTOR") return;
    apiGet<ContractorProfile>("/contractors/me")
      .then((response) => {
        setProfile(response);
        setForm({
          name: response.name,
          company_name: response.company_name,
          bio: response.bio,
          profile_image_url: response.profile_image_url,
          phone: response.phone,
          city: response.city,
          state: response.state,
          country: response.country,
          experience_years: response.experience_years,
        });
      })
      .catch((requestError) => setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not load your profile."))
      .finally(() => setIsLoading(false));
  }, [auth.isLoading, auth.user]);

  function updateField<K extends keyof ContractorProfileInput>(field: K, value: ContractorProfileInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const response = await apiPatch<ContractorProfile>("/contractors/me", form);
      setProfile(response);
      setSuccess("Profile updated successfully.");
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.detail : "We could not save those changes.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !auth.user) return null;

  return (
    <div className="max-w-4xl">
      <div className="border-b border-[#d7d8d1] pb-8"><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">Your presence</p><h1 className="mt-3 text-4xl font-black tracking-[-0.07em] text-[#183c31] sm:text-5xl">Contractor profile.</h1><p className="mt-3 max-w-xl text-base leading-7 text-[#607068]">Give clients the context they need to choose your work with confidence.</p></div>
      {!profile && !error ? <div className="mt-8 rounded-2xl border border-[#d7d8d1] bg-white p-8 text-sm text-[#607068]">No contractor profile was found for this account.</div> : <form onSubmit={handleSubmit} className="mt-8 rounded-2xl border border-[#d7d8d1] bg-white p-6 shadow-[0_10px_30px_rgba(24,60,49,0.04)] sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" value={form.name} onChange={(value) => updateField("name", value)} required />
          <Field label="Company name" value={form.company_name ?? ""} onChange={(value) => updateField("company_name", value || null)} />
          <Field label="Phone" value={form.phone ?? ""} onChange={(value) => updateField("phone", value || null)} />
          <Field label="Profile image URL" value={form.profile_image_url ?? ""} onChange={(value) => updateField("profile_image_url", value || null)} />
          <Field label="City" value={form.city} onChange={(value) => updateField("city", value)} required />
          <Field label="State" value={form.state} onChange={(value) => updateField("state", value)} required />
          <Field label="Country" value={form.country} onChange={(value) => updateField("country", value)} required />
          <label className="block text-sm font-bold text-[#365048]">Experience years<input className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]" type="number" min="0" value={form.experience_years} onChange={(event) => updateField("experience_years", Number(event.target.value))} /></label>
          <label className="block text-sm font-bold text-[#365048] sm:col-span-2">Bio<textarea className="mt-2 min-h-32 w-full resize-y rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 font-medium outline-none focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]" value={form.bio ?? ""} onChange={(event) => updateField("bio", event.target.value || null)} placeholder="A short introduction to your work" /></label>
        </div>
        {error && <p className="mt-6 rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]" role="alert">{error}</p>}
        {success && <p className="mt-6 rounded-xl border border-[#bad8c5] bg-[#eef8f0] px-4 py-3 text-sm font-semibold text-[#286047]" role="status">{success}</p>}
        <div className="mt-8 flex items-center justify-end"><button type="submit" disabled={isSaving} className="rounded-xl bg-[#183c31] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#285847] disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving changes..." : "Save profile"}</button></div>
      </form>}
    </div>
  );
}

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block text-sm font-bold text-[#365048]">{label}<input className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-[#fcfcfa] px-4 py-3 outline-none focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]" value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}
