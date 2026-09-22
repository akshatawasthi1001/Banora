import type { Metadata } from "next";
import type { ReactNode } from "react";

import { apiGet } from "@/lib/api/client";
import type { ContractorProfile } from "@/lib/api/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ contractorId: string }>;
}): Promise<Metadata> {
  const { contractorId } = await params;
  try {
    const contractor = await apiGet<ContractorProfile>(
      `/contractors/${contractorId}`,
    );
    const summary = [
      contractor.company_name ?? "Independent contractor",
      `${contractor.experience_years} years experience`,
      `${contractor.city}, ${contractor.state}, ${contractor.country}`,
    ].join(" · ");
    return {
      title: `${contractor.name} | Banora`,
      description: summary,
    };
  } catch {
    // Fall back to static metadata when the profile cannot be loaded.
    return {
      title: "Contractor profile | Banora",
      description:
        "Portfolio, experience, construction journey, and verified client reviews for this Banora contractor.",
    };
  }
}

export default function ContractorProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
