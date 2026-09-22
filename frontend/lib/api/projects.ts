import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { Project, ProjectInput, ProjectList } from "./types";

export function createProject(input: ProjectInput): Promise<Project> {
  return apiPost<Project>("/projects", input);
}

export function getMyProjects(
  page = 1,
  pageSize = 100,
): Promise<ProjectList> {
  return apiGet<ProjectList>(`/projects/me?page=${page}&page_size=${pageSize}`);
}

export function getMyProject(projectId: string): Promise<Project> {
  return apiGet<Project>(`/projects/me/${projectId}`);
}

export function updateProject(
  projectId: string,
  input: ProjectInput,
): Promise<Project> {
  return apiPatch<Project>(`/projects/me/${projectId}`, input);
}

export function deleteProject(projectId: string): Promise<void> {
  return apiDelete<void>(`/projects/me/${projectId}`);
}
