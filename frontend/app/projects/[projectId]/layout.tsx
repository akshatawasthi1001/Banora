import type { Metadata } from "next";
import type { ReactNode } from "react";

import { apiGet } from "@/lib/api/client";
import type { Project } from "@/lib/api/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  try {
    const project = await apiGet<Project>(`/projects/${projectId}`);
    const location = [project.city, project.state].filter(Boolean).join(", ");
    const description = [
      project.description?.trim() || `A ${project.project_type.toLowerCase()} project by a Banora contractor.`,
      location,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      title: `${project.title} | Banora`,
      description,
    };
  } catch {
    // Fall back to static metadata when the project cannot be loaded.
    return {
      title: "Project portfolio | Banora",
      description:
        "Project details, photo gallery, and the full construction journey behind this Banora build.",
    };
  }
}

export default function PublicProjectLayout({ children }: { children: ReactNode }) {
  return children;
}
