"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "../layout/PageHeader";
import type { TabItem } from "../ui/Tabs";

interface CaseHeaderProps {
  caseId: string;
  title: string;
  tabs: TabItem[];
  activeTab: string;
  action?: ReactNode;
}

/** Space header whose tab selection lives in `?tab=` so the server renders the right panel. */
export function CaseHeader({ caseId, title, tabs, activeTab, action }: CaseHeaderProps) {
  const router = useRouter();
  return (
    <PageHeader
      title={title}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => {
        const href = id === "home" ? `/cases/${caseId}` : `/cases/${caseId}?tab=${encodeURIComponent(id)}`;
        router.replace(href, { scroll: false });
      }}
      action={action}
    />
  );
}
