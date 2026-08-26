import { useSyncExternalStore } from "react";

export type Priority = "High" | "Medium" | "Low";

export interface Project {
  id: string;
  name: string;
  description: string;
  priority: Priority;
  createdAt: string;
}

export interface NewProjectInput {
  name: string;
  description?: string;
  priority?: Priority;
}

let projects: Project[] = [
  {
    id: "prj_001",
    name: "Website Redesign",
    description: "Refresh the marketing site visuals and copy.",
    priority: "Medium",
    createdAt: "2026-08-12",
  },
  {
    id: "prj_002",
    name: "Mobile App Beta",
    description: "Prepare the iOS beta build for external testers.",
    priority: "High",
    createdAt: "2026-08-18",
  },
];

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

export function addProject(input: NewProjectInput): Project {
  const project: Project = {
    id: `prj_${String(projects.length + 1).padStart(3, "0")}`,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    priority: input.priority ?? "Medium",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  projects = [...projects, project];
  emit();
  return project;
}

export function useProjects(): Project[] {
  return useSyncExternalStore(subscribe, getProjects);
}
