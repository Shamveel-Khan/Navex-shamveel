import { useMemo, useState } from "react";
import InvoiceModal from "../components/InvoiceModal";
import { useToast } from "../components/Toast";
import {
  payInvoice,
  useInvoices,
  type InvoiceStatus,
} from "../state/invoices";

const STATUS_OPTIONS = ["All", "Pending", "Paid", "Overdue"];

export default function Invoices() {
  const { showToast } = useToast();
  const invoices = useInvoices();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter(
      (i) =>
        (statusFilter === "All" ||
          i.status === (statusFilter as InvoiceStatus)) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.client.toLowerCase().includes(q)),
    );
  }, [invoices, query, statusFilter]);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Invoices</h1>
          <p className="subtitle">Create, track, and collect payments.</p>
        </div>
        <button
          data-waid="create_invoice_button"
          className="primary"
          onClick={() => setModalOpen(true)}
        >
          + Create Invoice
        </button>
      </div>

      <input
        data-waid="invoices_search_input"
        type="search"
        placeholder="Search invoices..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search"
      />

      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="invoice-status-filter">Status</label>
          <select
            data-waid="invoice_status_filter"
            id="invoice-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-actions">
          <button
            data-waid="export_invoices_button"
            onClick={() => showToast("Invoice list exported as CSV.")}
          >
            Export
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">No invoices match your filters.</p>
      ) : (
        <ul className="project-list">
          {visible.map((i) => (
            <li key={i.id} className="project-card">
              <div className="project-head">
                <strong>{i.name}</strong>
                <span className={`badge badge-${i.status.toLowerCase()}`}>
                  {i.status}
                </span>
              </div>
              <p className="project-desc">
                {i.client} · ${i.amount.toLocaleString()}
              </p>
              <span className="project-date">Issued {i.issuedAt}</span>
              <div className="row-actions">
                {i.status !== "Paid" && (
                  <button
                    data-waid={`pay_invoice_${i.id}`}
                    className="card-link primary"
                    onClick={() => {
                      payInvoice(i.id);
                      showToast(
                        `Invoice for ${i.client} ($${i.amount.toLocaleString()}) was marked as paid.`,
                      );
                    }}
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && <InvoiceModal onClose={() => setModalOpen(false)} />}
    </section>
  );
}