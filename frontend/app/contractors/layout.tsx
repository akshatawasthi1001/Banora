import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Find trusted contractors | Banora",
  description:
    "Search the Banora network by name, company, city, state, or experience and explore real project portfolios.",
};

export default function ContractorsLayout({ children }: { children: ReactNode }) {
  return children;
}
