import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  ConstructionStage,
  ConstructionStagePatchInput,
  MediaAsset,
  MediaCreateInput,
  ProgressUpdate,
  ProgressUpdateInput,
  ProgressUpdatePatchInput,
  ProjectJourney,
} from "./types";

export function getProjectJourney(projectId: string): Promise<ProjectJourney> {
  return apiGet<ProjectJourney>(`/projects/${projectId}/journey`);
}

export function updateConstructionStage(
  projectId: string,
  stageId: string,
  input: ConstructionStagePatchInput,
): Promise<ConstructionStage> {
  return apiPatch<ConstructionStage>(
    `/projects/me/${projectId}/stages/${stageId}`,
    input,
  );
}

export function createProgressUpdate(
  projectId: string,
  stageId: string,
  input: ProgressUpdateInput,
): Promise<ProgressUpdate> {
  return apiPost<ProgressUpdate>(
    `/projects/me/${projectId}/stages/${stageId}/updates`,
    input,
  );
}

export function updateProgressUpdate(
  projectId: string,
  stageId: string,
  updateId: string,
  input: ProgressUpdatePatchInput,
): Promise<ProgressUpdate> {
  return apiPatch<ProgressUpdate>(
    `/projects/me/${projectId}/stages/${stageId}/updates/${updateId}`,
    input,
  );
}

export function deleteProgressUpdate(
  projectId: string,
  stageId: string,
  updateId: string,
): Promise<void> {
  return apiDelete<void>(
    `/projects/me/${projectId}/stages/${stageId}/updates/${updateId}`,
  );
}

export function listUpdateMedia(
  projectId: string,
  stageId: string,
  updateId: string,
): Promise<MediaAsset[]> {
  return apiGet<MediaAsset[]>(
    `/projects/me/${projectId}/stages/${stageId}/updates/${updateId}/media`,
  );
}

export function createUpdateMedia(
  projectId: string,
  stageId: string,
  updateId: string,
  input: MediaCreateInput,
): Promise<MediaAsset> {
  return apiPost<MediaAsset>(
    `/projects/me/${projectId}/stages/${stageId}/updates/${updateId}/media`,
    input,
  );
}

export function deleteUpdateMedia(
  projectId: string,
  stageId: string,
  updateId: string,
  mediaId: string,
): Promise<void> {
  return apiDelete<void>(
    `/projects/me/${projectId}/stages/${stageId}/updates/${updateId}/media/${mediaId}`,
  );
}
