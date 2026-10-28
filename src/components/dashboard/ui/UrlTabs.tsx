"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, type TabItem } from "./Tabs";

interface UrlTabsProps {
  items: TabItem[];
  value: string;
  label: string;
  /** Query parameter that stores the active tab. */
  param?: string;
  className?: string;
}

/** Tabs whose selection is reflected in the URL so the page can render on the server. */
export function UrlTabs({ items, value, label, param = "tab", className }: UrlTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs
      items={items}
      value={value}
      label={label}
      className={className}
      onValueChange={(id) => {
        const next = id === items[0]?.id ? pathname : `${pathname}?${param}=${encodeURIComponent(id)}`;
        router.replace(next, { scroll: false });
      }}
    />
  );
}
