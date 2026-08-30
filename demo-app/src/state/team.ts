import { useSyncExternalStore } from "react";
import { recordActivity } from "./activity";

export type MemberRole = "Admin" | "Member" | "Viewer";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
}

export interface NewMemberInput {
  name: string;
  email: string;
  role?: MemberRole;
}

let members: Member[] = [
  {
    id: "mem_001",
    name: "Priya Sharma",
    email: "priya@taskflow.dev",
    role: "Admin",
    joinedAt: "2026-01-12",
  },
  {
    id: "mem_002",
    name: "Marcus Chen",
    email: "marcus@taskflow.dev",
    role: "Member",
    joinedAt: "2026-02-03",
  },
  {
    id: "mem_003",
    name: "Aisha Patel",
    email: "aisha@taskflow.dev",
    role: "Member",
    joinedAt: "2026-03-17",
  },
  {
    id: "mem_004",
    name: "Diego Ramos",
    email: "diego@taskflow.dev",
    role: "Viewer",
    joinedAt: "2026-05-09",
  },
  {
    id: "mem_005",
    name: "Sofia Novak",
    email: "sofia@taskflow.dev",
    role: "Viewer",
    joinedAt: "2026-06-21",
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

export function getMembers(): Member[] {
  return members;
}

export function useMembers(): Member[] {
  return useSyncExternalStore(subscribe, getMembers);
}

export function addMember(input: NewMemberInput): Member {
  const member: Member = {
    id: `mem_${String(members.length + 1).padStart(3, "0")}`,
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role ?? "Member",
    joinedAt: new Date().toISOString().slice(0, 10),
  };
  members = [...members, member];
  recordActivity("Team", `${member.name} joined the workspace as a ${member.role}.`);
  emit();
  return member;
}

export function removeMemberByName(name: string): void {
  const removed = members.find((m) => m.name === name);
  members = members.filter((m) => m.name !== name);
  if (removed) {
    recordActivity("Team", `${removed.name} was removed from the workspace.`);
  }
  emit();
}