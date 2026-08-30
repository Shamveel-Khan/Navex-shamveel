import { useSyncExternalStore } from "react";

export type Priority = "High" | "Medium" | "Low";
export type ProjectStatus = "Active" | "On Hold" | "Completed" | "Archived";

export interface Project {
  id: string;
  name: string;
  description: string;
  priority: Priority;
  status: ProjectStatus;
  assignee: string;
  budget: number;
  createdAt: string;
}

export interface NewProjectInput {
  name: string;
  description?: string;
  priority?: Priority;
  status?: ProjectStatus;
  assignee?: string;
  budget?: number;
}

export type ProjectPatch = Partial<NewProjectInput>;

const ASSIGNEES = [
  "Unassigned",
  "Priya Sharma",
  "Marcus Chen",
  "Aisha Patel",
  "Diego Ramos",
  "Sofia Novak",
];

let projects: Project[] = [
  {
    id: "prj_001",
    name: "Website Redesign",
    description: "Refresh the marketing site visuals and copy.",
    priority: "Medium",
    status: "Active",
    assignee: "Priya Sharma",
    budget: 12000,
    createdAt: "2026-08-12",
  },
  {
    id: "prj_002",
    name: "Mobile App Beta",
    description: "Prepare the iOS beta build for external testers.",
    priority: "High",
    status: "On Hold",
    assignee: "Marcus Chen",
    budget: 25000,
    createdAt: "2026-08-18",
  },
  {
    id: "prj_003",
    name: "API Migration",
    description: "Move internal services to the new gateway.",
    priority: "High",
    status: "Active",
    assignee: "Aisha Patel",
    budget: 30000,
    createdAt: "2026-08-20",
  },
  {
    id: "prj_004",
    name: "Onboarding Flow",
    description: "Redesign the first-run experience for new users.",
    priority: "Low",
    status: "Completed",
    assignee: "Priya Sharma",
    budget: 8000,
    createdAt: "2026-07-30",
  },
  {
    id: "prj_005",
    name: "Security Audit",
    description: "External penetration testing and review.",
    priority: "High",
    status: "Active",
    assignee: "Unassigned",
    budget: 15000,
    createdAt: "2026-08-22",
  },
  {
    id: "prj_006",
    name: "Docs Overhaul",
    description: "Rewrite the developer documentation set.",
    priority: "Medium",
    status: "On Hold",
    assignee: "Marcus Chen",
    budget: 6000,
    createdAt: "2026-08-10",
  },
  {
    id: "prj_007",
    name: "Pricing Experiments",
    description: "A/B test pricing tiers and packaging.",
    priority: "Medium",
    status: "Completed",
    assignee: "Aisha Patel",
    budget: 5000,
    createdAt: "2026-07-25",
  },
  {
    id: "prj_008",
    name: "Dark Mode",
    description: "Ship dark mode across all surfaces.",
    priority: "Low",
    status: "Active",
    assignee: "Unassigned",
    budget: 4000,
    createdAt: "2026-08-24",
  },
];

let selectedProjectId: string | null = null;

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

export function getProjects(): Project[] {
  return projects;
}

export function getAssignees(): string[] {
  return ASSIGNEES;
}

export function useProjects(): Project[] {
  return useSyncExternalStore(subscribe, getProjects);
}

export function addProject(input: NewProjectInput): Project {
  const project: Project = {
    id: `prj_${String(projects.length + 1).padStart(3, "0")}`,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    priority: input.priority ?? "Medium",
    status: input.status ?? "Active",
    assignee: input.assignee ?? "Unassigned",
    budget: input.budget ?? 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  projects = [...projects, project];
  emit();
  return project;
}

export function updateProject(id: string, input: ProjectPatch): void {
  projects = projects.map((p) => {
    if (p.id !== id) return p;
    return {
      ...p,
      name: input.name?.trim() ?? p.name,
      description: input.description?.trim() ?? p.description,
      priority: input.priority ?? p.priority,
      status: input.status ?? p.status,
      assignee: input.assignee ?? p.assignee,
      budget: input.budget ?? p.budget,
    };
  });
  emit();
}

export function removeProject(id: string): void {
  projects = projects.filter((p) => p.id !== id);
  if (selectedProjectId === id) selectedProjectId = null;
  emit();
}

export function selectProject(id: string): void {
  selectedProjectId = id;
  emit();
}

export function getSelectedProject(): Project | null {
  return projects.find((p) => p.id === selectedProjectId) ?? null;
}

export function useSelectedProject(): Project | null {
  return useSyncExternalStore(subscribe, getSelectedProject);
}