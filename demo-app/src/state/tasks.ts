import { useSyncExternalStore } from "react";
import type { Priority } from "./projects";
import { recordActivity } from "./activity";

export type TaskStatus = "To Do" | "In Progress" | "Done";

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  assignee: string;
  dueDate: string;
  done: boolean;
}

export interface NewTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  assignee?: string;
}

let tasks: Task[] = [
  {
    id: "t1",
    title: "Fix login redirect bug",
    description: "Users on /dashboard get a blank screen after sign-in.",
    priority: "High",
    status: "In Progress",
    assignee: "Marcus Chen",
    dueDate: "2026-09-02",
    done: false,
  },
  {
    id: "t2",
    title: "Write API integration tests",
    description: "Cover the new gateway endpoints with pytest.",
    priority: "Medium",
    status: "To Do",
    assignee: "Priya Sharma",
    dueDate: "2026-09-05",
    done: false,
  },
  {
    id: "t3",
    title: "Update onboarding copy",
    description: "Refresh welcome emails and empty states.",
    priority: "Low",
    status: "Done",
    assignee: "Aisha Patel",
    dueDate: "2026-08-27",
    done: true,
  },
  {
    id: "t4",
    title: "Investigate slow dashboard queries",
    description: "Projects page reports 4s+ loads on large workspaces.",
    priority: "High",
    status: "In Progress",
    assignee: "Unassigned",
    dueDate: "2026-09-01",
    done: false,
  },
  {
    id: "t5",
    title: "Migrate CI to GitHub Actions",
    description: "Replace the legacy Jenkins pipeline.",
    priority: "Medium",
    status: "To Do",
    assignee: "Diego Ramos",
    dueDate: "2026-09-10",
    done: false,
  },
  {
    id: "t6",
    title: "Prepare release notes",
    description: "Draft the 0.4.0 changelog.",
    priority: "Low",
    status: "Done",
    assignee: "Sofia Novak",
    dueDate: "2026-08-26",
    done: true,
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

export function getTasks(): Task[] {
  return tasks;
}

export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, getTasks);
}

export function toggleTask(id: string): void {
  tasks = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  emit();
}

export function addTask(input: NewTaskInput): Task {
  const task: Task = {
    id: `t${tasks.length + 1}`,
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    priority: input.priority ?? "Medium",
    status: input.status ?? "To Do",
    assignee: input.assignee ?? "Unassigned",
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    done: false,
  };
  tasks = [...tasks, task];
  recordActivity("Task", `Task "${task.title}" was created.`);
  emit();
  return task;
}

export function clearCompletedTasks(): number {
  const removed = tasks.filter((t) => t.done).length;
  if (removed > 0) {
    recordActivity("Task", `${removed} completed task(s) were cleared.`);
  }
  tasks = tasks.filter((t) => !t.done);
  emit();
  return removed;
}