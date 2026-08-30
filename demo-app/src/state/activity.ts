import { useSyncExternalStore } from "react";

export type ActivityCategory = "Project" | "Task" | "Team" | "Invoice";

export interface ActivityEntry {
  id: string;
  category: ActivityCategory;
  detail: string;
  time: string;
}

let entries: ActivityEntry[] = [
  {
    id: "act_001",
    category: "Project",
    detail: 'Project "Pricing Experiments" was marked Completed.',
    time: "Today, 09:12",
  },
  {
    id: "act_002",
    category: "Task",
    detail: 'Task "Prepare release notes" was marked done by Sofia Novak.',
    time: "Today, 08:47",
  },
  {
    id: "act_003",
    category: "Invoice",
    detail: "Invoice for Initech ($21,000) was marked Paid.",
    time: "Yesterday, 16:20",
  },
  {
    id: "act_004",
    category: "Team",
    detail: "Diego Ramos joined the workspace as a Viewer.",
    time: "Yesterday, 11:05",
  },
  {
    id: "act_005",
    category: "Project",
    detail: 'Project "Security Audit" was created.',
    time: "2026-08-22",
  },
  {
    id: "act_006",
    category: "Task",
    detail: 'Task "Investigate slow dashboard queries" moved to In Progress.',
    time: "2026-08-21",
  },
  {
    id: "act_007",
    category: "Invoice",
    detail: "Invoice for Stark Industries ($6,000) was issued.",
    time: "2026-08-20",
  },
  {
    id: "act_008",
    category: "Team",
    detail: "Marcus Chen updated his display name.",
    time: "2026-08-19",
  },
];

let nextId = 9;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getEntries(): ActivityEntry[] {
  return entries;
}

export function useEntries(): ActivityEntry[] {
  return useSyncExternalStore(subscribe, getEntries);
}

export function recordActivity(
  category: ActivityCategory,
  detail: string,
  time = "Just now",
): void {
  const entry: ActivityEntry = {
    id: `act_${String(nextId++).padStart(3, "0")}`,
    category,
    detail,
    time,
  };
  entries = [entry, ...entries].slice(0, 40);
  emit();
}

export function clearActivity(): void {
  entries = [];
  emit();
}