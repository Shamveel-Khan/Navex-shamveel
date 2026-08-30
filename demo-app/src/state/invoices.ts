import { useSyncExternalStore } from "react";
import { recordActivity } from "./activity";

export type InvoiceStatus = "Pending" | "Paid" | "Overdue";

export interface Invoice {
  id: string;
  client: string;
  name: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt: string;
}

export interface NewInvoiceInput {
  client: string;
  name: string;
  amount: number;
}

export const CLIENTS = [
  "Acme Corp",
  "Globex",
  "Initech",
  "Umbrella Labs",
  "Stark Industries",
];

let invoices: Invoice[] = [
  {
    id: "inv_001",
    client: "Acme Corp",
    name: "Website Redesign — Q3",
    amount: 12500,
    status: "Pending",
    issuedAt: "2026-08-01",
  },
  {
    id: "inv_002",
    client: "Globex",
    name: "Mobile App Beta — Sprint 12",
    amount: 9400,
    status: "Overdue",
    issuedAt: "2026-07-15",
  },
  {
    id: "inv_003",
    client: "Initech",
    name: "API Migration — Phase 1",
    amount: 21000,
    status: "Paid",
    issuedAt: "2026-06-28",
  },
  {
    id: "inv_004",
    client: "Umbrella Labs",
    name: "Security Audit",
    amount: 15000,
    status: "Pending",
    issuedAt: "2026-08-19",
  },
  {
    id: "inv_005",
    client: "Stark Industries",
    name: "Docs Overhaul — Retainer",
    amount: 6000,
    status: "Overdue",
    issuedAt: "2026-07-05",
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

export function getInvoices(): Invoice[] {
  return invoices;
}

export function getClients(): string[] {
  return CLIENTS;
}

export function useInvoices(): Invoice[] {
  return useSyncExternalStore(subscribe, getInvoices);
}

export function addInvoice(input: NewInvoiceInput): Invoice {
  const invoice: Invoice = {
    id: `inv_${String(invoices.length + 1).padStart(3, "0")}`,
    client: input.client,
    name: input.name.trim(),
    amount: input.amount,
    status: "Pending",
    issuedAt: new Date().toISOString().slice(0, 10),
  };
  invoices = [...invoices, invoice];
  recordActivity(
    "Invoice",
    `Invoice for ${invoice.client} ($${invoice.amount.toLocaleString()}) was issued.`,
  );
  emit();
  return invoice;
}

export function payInvoice(id: string): void {
  const invoice = invoices.find((i) => i.id === id);
  invoices = invoices.map((i) =>
    i.id === id ? { ...i, status: "Paid" as const } : i,
  );
  if (invoice) {
    recordActivity(
      "Invoice",
      `Invoice for ${invoice.client} ($${invoice.amount.toLocaleString()}) was marked Paid.`,
    );
  }
  emit();
}