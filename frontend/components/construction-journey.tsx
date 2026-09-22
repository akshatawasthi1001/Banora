"use client";

import { useEffect, useState } from "react";

import {
  createProgressUpdate,
  createUpdateMedia,
  deleteProgressUpdate,
  deleteUpdateMedia,
  listUpdateMedia,
  updateConstructionStage,
  updateProgressUpdate,
} from "@/lib/api/construction";
import { ApiRequestError } from "@/lib/api/client";
import type {
  ConstructionStageStatus,
  JourneyStage,
  MediaAsset,
  MediaType,
  ProgressUpdate,
} from "@/lib/api/types";

const STAGE_STATUSES: ConstructionStageStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
];

const STAGE_STATUS_STYLES: Record<ConstructionStageStatus, string> = {
  NOT_STARTED: "bg-[#f4f1eb] text-[#8a9890]",
  IN_PROGRESS: "bg-[#fff0e8] text-[#a3482d]",
  COMPLETED: "bg-[#e5efe9] text-[#286047]",
};

function formatDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) return error.detail;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function latestPercentage(stage: JourneyStage): number | null {
  const latest = stage.progress_updates[0];
  return latest ? Math.round(latest.progress_percentage) : null;
}

interface ConstructionJourneyProps {
  projectId: string;
  stages: JourneyStage[];
  onJourneyChange: () => void;
}

interface UpdateFormValues {
  title: string;
  description: string;
  progress_percentage: string;
  update_date: string;
}

function emptyForm(): UpdateFormValues {
  return {
    title: "",
    description: "",
    progress_percentage: "",
    update_date: new Date().toISOString().slice(0, 10),
  };
}

export default function ConstructionJourney({
  projectId,
  stages,
  onJourneyChange,
}: ConstructionJourneyProps) {
  const [mediaByUpdate, setMediaByUpdate] = useState<
    Record<string, MediaAsset[]>
  >({});
  const [mediaErrors, setMediaErrors] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [openAddStageId, setOpenAddStageId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<UpdateFormValues>(emptyForm());

  const [editingUpdate, setEditingUpdate] = useState<ProgressUpdate | null>(
    null,
  );
  const [editForm, setEditForm] = useState<UpdateFormValues>(emptyForm());

  const [mediaStageId, setMediaStageId] = useState<string | null>(null);
  const [mediaUpdateId, setMediaUpdateId] = useState<string | null>(null);
  const [mediaForm, setMediaForm] = useState<{
    media_type: MediaType;
    url: string;
    thumbnail_url: string;
    alt_text: string;
    caption: string;
  }>({ media_type: "IMAGE", url: "", thumbnail_url: "", alt_text: "", caption: "" });

  useEffect(() => {
    const updateIds = stages.flatMap((stage) =>
      stage.progress_updates
        .filter((update) => mediaByUpdate[update.id] === undefined)
        .map((update) => update.id),
    );
    if (updateIds.length === 0) return;
    let cancelled = false;

    async function loadUpdateMedia() {
      const nextMedia: Record<string, MediaAsset[]> = {};
      const nextErrors: Record<string, boolean> = {};
      await Promise.all(
        updateIds.map(async (updateId) => {
          const stage = stages.find((item) =>
            item.progress_updates.some((update) => update.id === updateId),
          );
          if (!stage) return;
          try {
            nextMedia[updateId] = await listUpdateMedia(
              projectId,
              stage.id,
              updateId,
            );
          } catch {
            nextErrors[updateId] = true;
          }
        }),
      );
      if (cancelled) return;
      setMediaByUpdate((current) => ({ ...current, ...nextMedia }));
      setMediaErrors((current) => ({ ...current, ...nextErrors }));
    }

    void loadUpdateMedia();

    return () => {
      cancelled = true;
    };
    // mediaByUpdate intentionally omitted: hydrate only missing entries once per journey change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages, projectId]);

  async function runMutation(key: string, action: () => Promise<void>, successMessage: string) {
    setFormError(null);
    setFormSuccess(null);
    setBusyKey(key);
    try {
      await action();
      setFormSuccess(successMessage);
      onJourneyChange();
      return true;
    } catch (error) {
      setFormError(getErrorMessage(error, "Something went wrong. Please try again."));
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  function closeForms() {
    setOpenAddStageId(null);
    setEditingUpdate(null);
    setMediaStageId(null);
    setMediaUpdateId(null);
    setAddForm(emptyForm());
    setEditForm(emptyForm());
    setMediaForm({ media_type: "IMAGE", url: "", thumbnail_url: "", alt_text: "", caption: "" });
  }

  async function handleAddUpdate(stageId: string) {
    const percentage = Number(addForm.progress_percentage);
    const closed = closeFormsAndReturn(openAddStageId === stageId);
    if (closed) return;
    if (!addForm.title.trim()) {
      setFormError("A progress update needs a title.");
      return;
    }
    if (addForm.progress_percentage === "" || Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
      setFormError("Progress percentage must be between 0 and 100.");
      return;
    }
    const ok = await runMutation(
      `add-${stageId}`,
      async () => {
        await createProgressUpdate(projectId, stageId, {
          title: addForm.title.trim(),
          description: addForm.description.trim() || null,
          progress_percentage: percentage,
          update_date: addForm.update_date,
        });
      },
      "Progress update added.",
    );
    if (ok) closeForms();
  }

  function closeFormsAndReturn(isOpen: boolean): boolean {
    if (isOpen) {
      closeForms();
      return true;
    }
    return false;
  }

  async function handleSaveEdit(stageId: string) {
    if (!editingUpdate) return;
    const percentage = Number(editForm.progress_percentage);
    if (!editForm.title.trim()) {
      setFormError("A progress update needs a title.");
      return;
    }
    if (editForm.progress_percentage === "" || Number.isNaN(percentage) || percentage < 0 || percentage > 100) {
      setFormError("Progress percentage must be between 0 and 100.");
      return;
    }
    const ok = await runMutation(
      `edit-${editingUpdate.id}`,
      async () => {
        const updated = await updateProgressUpdate(
          projectId,
          stageId,
          editingUpdate.id,
          {
            title: editForm.title.trim(),
            description: editForm.description.trim() || null,
            progress_percentage: percentage,
            update_date: editForm.update_date,
          },
        );
        setMediaByUpdate((current) =>
          updated.id in current ? current : { ...current, [updated.id]: current[updated.id] ?? [] },
        );
      },
      "Progress update saved.",
    );
    if (ok) closeForms();
  }

  async function handleDeleteUpdate(stageId: string, updateId: string) {
    if (!window.confirm("Delete this progress update and its media?")) return;
    await runMutation(
      `delete-${updateId}`,
      async () => {
        await deleteProgressUpdate(projectId, stageId, updateId);
      },
      "Progress update deleted.",
    );
  }

  async function handleStageStatusChange(stageId: string, status: ConstructionStageStatus) {
    await runMutation(
      `stage-${stageId}`,
      async () => {
        await updateConstructionStage(projectId, stageId, { status });
      },
      "Stage status updated.",
    );
  }

  async function handleAddMedia(stageId: string, updateId: string) {
    const url = mediaForm.url.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setFormError("Enter a valid media URL starting with http(s)://");
      return;
    }
    const thumbnailUrl = mediaForm.thumbnail_url.trim();
    if (thumbnailUrl && !/^https?:\/\/\S+$/i.test(thumbnailUrl)) {
      setFormError("The thumbnail URL must also start with http(s)://");
      return;
    }
    const ok = await runMutation(
      `media-${updateId}`,
      async () => {
        await createUpdateMedia(projectId, stageId, updateId, {
          media_type: mediaForm.media_type,
          url,
          thumbnail_url: thumbnailUrl || null,
          alt_text: mediaForm.alt_text.trim() || null,
          caption: mediaForm.caption.trim() || null,
        });
      },
      "Media added.",
    );
    if (ok) {
      setMediaByUpdate((current) => {
        const next = { ...current };
        delete next[updateId];
        return next;
      });
      closeForms();
    }
  }

  async function handleDeleteMedia(stageId: string, updateId: string, mediaId: string) {
    if (!window.confirm("Remove this media item?")) return;
    await runMutation(
      `media-del-${mediaId}`,
      async () => {
        await deleteUpdateMedia(projectId, stageId, updateId, mediaId);
      },
      "Media removed.",
    );
    setMediaByUpdate((current) => {
      const next = { ...current };
      delete next[updateId];
      return next;
    });
  }

  if (stages.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-[#d7d8d1] bg-[#f9f8f4] px-6 py-10 text-center">
        <p className="text-sm font-bold text-[#183c31]">No construction stages yet</p>
        <p className="mt-2 text-sm text-[#607068]">
          Once stages exist for this project, your timeline and progress updates will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {(formError || formSuccess) && (
        <div className="mb-4">
          {formError && (
            <div className="rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]" role="alert">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="mt-2 rounded-xl border border-[#bcd8c6] bg-[#eef6f0] px-4 py-3 text-sm font-semibold text-[#286047]" role="status">
              {formSuccess}
            </div>
          )}
        </div>
      )}

      <ol className="relative space-y-6">
        {stages.map((stage, index) => {
          const percent = latestPercentage(stage);
          const isAddOpen = openAddStageId === stage.id;
          return (
            <li key={stage.id} className="relative pl-12 sm:pl-14">
              {index < stages.length - 1 && (
                <span aria-hidden className="absolute left-[15px] top-10 h-[calc(100%-8px)] w-px bg-[#cddbd2] sm:left-[19px]" />
              )}
              <span className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-black sm:h-10 sm:w-10 sm:text-sm ${stage.status === "COMPLETED" ? "bg-[#286047] text-white" : stage.status === "IN_PROGRESS" ? "bg-[#e26d42] text-white" : "bg-[#e5efe9] text-[#286047]"}`}>
                {stage.stage_order}
              </span>

              <div className="rounded-2xl border border-[#e9e9e3] bg-white p-5 shadow-[0_2px_10px_rgba(24,60,49,0.03)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-black tracking-[-0.03em] text-[#183c31] sm:text-xl">
                      {stage.name}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[#8a9890]">
                      {stage.started_at ? `Started ${formatDate(stage.started_at)}` : "Not started yet"}
                      {stage.completed_at ? ` · Finished ${formatDate(stage.completed_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Status for ${stage.name}`}
                      value={stage.status}
                      disabled={busyKey === `stage-${stage.id}`}
                      onChange={(event) =>
                        void handleStageStatusChange(stage.id, event.target.value as ConstructionStageStatus)
                      }
                      className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] outline-none transition focus:ring-2 focus:ring-[#e26d42]/40 ${STAGE_STATUS_STYLES[stage.status]}`}
                    >
                      {STAGE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {percent !== null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-bold text-[#607068]">
                      <span>Latest progress</span>
                      <span className="text-[#e26d42]">{percent}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f4f1eb]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#286047] to-[#e26d42] transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUpdate(null);
                      setMediaStageId(null);
                      setMediaUpdateId(null);
                      setAddForm(emptyForm());
                      setOpenAddStageId(isAddOpen ? null : stage.id);
                      setFormError(null);
                      setFormSuccess(null);
                    }}
                    className="rounded-lg bg-[#183c31] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#286047]"
                  >
                    {isAddOpen ? "Cancel" : "+ Add progress update"}
                  </button>
                </div>

                {isAddOpen && (
                  <UpdateForm
                    idPrefix={`add-${stage.id}`}
                    values={addForm}
                    busy={busyKey === `add-${stage.id}`}
                    onChange={setAddForm}
                    onSubmit={() => void handleAddUpdate(stage.id)}
                    submitLabel="Add update"
                  />
                )}

                {stage.progress_updates.length === 0 ? (
                  <p className="mt-4 text-sm text-[#8a9890]">No updates recorded for this stage yet.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {stage.progress_updates.map((update) => {
                      const media = mediaByUpdate[update.id];
                      const isEditing = editingUpdate?.id === update.id;
                      const isMediaOpen = mediaUpdateId === update.id && mediaStageId === stage.id;
                      const mediaBusy = busyKey === `media-${update.id}`;
                      return (
                        <li key={update.id} className="rounded-xl bg-[#f9f8f4] p-4">
                          {isEditing ? (
                            <UpdateForm
                              idPrefix={`edit-${update.id}`}
                              values={editForm}
                              busy={busyKey === `edit-${update.id}`}
                              onChange={setEditForm}
                              onSubmit={() => void handleSaveEdit(stage.id)}
                              submitLabel="Save changes"
                            />
                          ) : (
                            <>
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
                                <p className="mt-1.5 text-sm leading-6 text-[#607068]">{update.description}</p>
                              )}

                              {mediaErrors[update.id] ? (
                                <p className="mt-3 text-xs font-semibold text-[#a3482d]">
                                  Media could not be loaded for this update.
                                </p>
                              ) : media === undefined ? (
                                <p className="mt-3 text-xs font-semibold text-[#8a9890]">Loading media…</p>
                              ) : media.length === 0 ? (
                                <p className="mt-3 text-xs text-[#8a9890]">No media attached yet.</p>
                              ) : (
                                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {media.map((item) => (
                                    <figure key={item.id} className="overflow-hidden rounded-lg border border-[#e9e9e3] bg-white">
                                      <a href={item.url} target="_blank" rel="noreferrer" className="block">
                                        {item.media_type === "IMAGE" ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={item.thumbnail_url ?? item.url}
                                            alt={item.alt_text ?? item.caption ?? update.title}
                                            className="h-24 w-full object-cover transition duration-300 hover:scale-105 sm:h-28"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <span className="flex h-24 items-center justify-center gap-1 bg-[#183c31] text-[10px] font-black uppercase tracking-[0.12em] text-white sm:h-28">
                                            ▶ {item.media_type}
                                          </span>
                                        )}
                                      </a>
                                      <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                                        <span className="truncate text-[11px] font-semibold text-[#607068]">
                                          {item.caption ?? item.media_type}
                                        </span>
                                        <button
                                          type="button"
                                          disabled={busyKey === `media-del-${item.id}`}
                                          onClick={() => void handleDeleteMedia(stage.id, update.id, item.id)}
                                          className="shrink-0 text-[11px] font-bold text-[#a3482d] hover:underline disabled:opacity-50"
                                        >
                                          {busyKey === `media-del-${item.id}` ? "…" : "Remove"}
                                        </button>
                                      </figcaption>
                                    </figure>
                                  ))}
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenAddStageId(null);
                                    setMediaStageId(null);
                                    setMediaUpdateId(null);
                                    setEditingUpdate(isEditing ? null : update);
                                    setEditForm({
                                      title: update.title,
                                      description: update.description ?? "",
                                      progress_percentage: String(Math.round(update.progress_percentage)),
                                      update_date: update.update_date.slice(0, 10),
                                    });
                                    setFormError(null);
                                    setFormSuccess(null);
                                  }}
                                  className="text-[#286047] hover:underline"
                                >
                                  {isEditing ? "Close editor" : "Edit"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenAddStageId(null);
                                    setEditingUpdate(null);
                                    if (isMediaOpen) {
                                      setMediaStageId(null);
                                      setMediaUpdateId(null);
                                    } else {
                                      setMediaStageId(stage.id);
                                      setMediaUpdateId(update.id);
                                      setMediaForm({ media_type: "IMAGE", url: "", thumbnail_url: "", alt_text: "", caption: "" });
                                    }
                                    setFormError(null);
                                    setFormSuccess(null);
                                  }}
                                  className="text-[#e26d42] hover:underline"
                                >
                                  {isMediaOpen ? "Cancel media" : "+ Add media"}
                                </button>
                                <button
                                  type="button"
                                  disabled={busyKey === `delete-${update.id}`}
                                  onClick={() => void handleDeleteUpdate(stage.id, update.id)}
                                  className="text-[#a3482d] hover:underline disabled:opacity-50"
                                >
                                  {busyKey === `delete-${update.id}` ? "Deleting…" : "Delete"}
                                </button>
                              </div>

                              {isMediaOpen && (
                                <div className="mt-3 rounded-lg border border-[#e9e9e3] bg-white p-3">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="text-xs font-bold text-[#607068]">
                                      Media type
                                      <select
                                        value={mediaForm.media_type}
                                        onChange={(event) =>
                                          setMediaForm({ ...mediaForm, media_type: event.target.value as MediaType })
                                        }
                                        className="mt-1 w-full rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
                                      >
                                        <option value="IMAGE">Image</option>
                                        <option value="VIDEO">Video</option>
                                      </select>
                                    </label>
                                    <label className="text-xs font-bold text-[#607068]">
                                      Caption (optional)
                                      <input
                                        type="text"
                                        value={mediaForm.caption}
                                        maxLength={500}
                                        onChange={(event) => setMediaForm({ ...mediaForm, caption: event.target.value })}
                                        className="mt-1 w-full rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
                                      />
                                    </label>
                                    <label className="text-xs font-bold text-[#607068] sm:col-span-2">
                                      Media URL
                                      <input
                                        type="url"
                                        required
                                        placeholder="https://…"
                                        value={mediaForm.url}
                                        onChange={(event) => setMediaForm({ ...mediaForm, url: event.target.value })}
                                        className="mt-1 w-full rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
                                      />
                                    </label>
                                    <label className="text-xs font-bold text-[#607068]">
                                      Thumbnail URL (optional)
                                      <input
                                        type="url"
                                        placeholder="https://…"
                                        value={mediaForm.thumbnail_url}
                                        onChange={(event) => setMediaForm({ ...mediaForm, thumbnail_url: event.target.value })}
                                        className="mt-1 w-full rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
                                      />
                                    </label>
                                    <label className="text-xs font-bold text-[#607068]">
                                      Alt text (optional, accessibility)
                                      <input
                                        type="text"
                                        maxLength={500}
                                        value={mediaForm.alt_text}
                                        onChange={(event) => setMediaForm({ ...mediaForm, alt_text: event.target.value })}
                                        className="mt-1 w-full rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
                                      />
                                    </label>
                                    {mediaForm.url.trim() && /^https?:\/\/\S+$/i.test(mediaForm.url.trim()) && (
                                      <div className="sm:col-span-2">
                                        <p className="text-xs font-bold text-[#607068]">Preview</p>
                                        {mediaForm.media_type === "IMAGE" ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={mediaForm.url.trim()}
                                            alt={mediaForm.alt_text.trim() || "Media preview"}
                                            className="mt-1 h-36 w-full rounded-lg border border-[#e9e9e3] bg-[#f4f1eb] object-cover"
                                          />
                                        ) : (
                                          <a
                                            href={mediaForm.url.trim()}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-1 flex h-20 items-center justify-center gap-2 rounded-lg bg-[#183c31] text-[10px] font-black uppercase tracking-[0.12em] text-white"
                                          >
                                            ▶ Preview video in new tab
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={mediaBusy}
                                    onClick={() => void handleAddMedia(stage.id, update.id)}
                                    className="mt-3 rounded-lg bg-[#e26d42] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#a3482d] disabled:opacity-50"
                                  >
                                    {mediaBusy ? "Adding…" : "Attach media"}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function UpdateForm({
  idPrefix,
  values,
  busy,
  onChange,
  onSubmit,
  submitLabel,
}: {
  idPrefix: string;
  values: UpdateFormValues;
  busy: boolean;
  onChange: (values: UpdateFormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <form
      className="mt-3 rounded-lg border border-[#e9e9e3] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold text-[#607068] sm:col-span-2">
          Title
          <input
            id={`${idPrefix}-title`}
            type="text"
            required
            maxLength={200}
            value={values.title}
            onChange={(event) => onChange({ ...values, title: event.target.value })}
            className="mt-1 w-full rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
          />
        </label>
        <label className="text-xs font-bold text-[#607068]">
          Progress (%)
          <input
            id={`${idPrefix}-percent`}
            type="number"
            required
            min={0}
            max={100}
            step={1}
            value={values.progress_percentage}
            onChange={(event) => onChange({ ...values, progress_percentage: event.target.value })}
            className="mt-1 w-full rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
          />
        </label>
        <label className="text-xs font-bold text-[#607068]">
          Date
          <input
            id={`${idPrefix}-date`}
            type="date"
            required
            value={values.update_date}
            onChange={(event) => onChange({ ...values, update_date: event.target.value })}
            className="mt-1 w-full rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
          />
        </label>
        <label className="text-xs font-bold text-[#607068] sm:col-span-2">
          Description (optional)
          <textarea
            id={`${idPrefix}-description`}
            rows={3}
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
            className="mt-1 w-full resize-y rounded-lg border border-[#d7d8d1] bg-white px-3 py-2 text-sm font-semibold text-[#183c31] outline-none focus:border-[#e26d42]"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded-lg bg-[#e26d42] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#a3482d] disabled:opacity-50"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
