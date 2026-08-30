import { useState } from "react";
import { useToast } from "../components/Toast";
import { useInvoices } from "../state/invoices";
import { useProjects } from "../state/projects";
import { useTasks } from "../state/tasks";
import { useMembers } from "../state/team";

const REPORT_TYPES = [
  "Project Report",
  "Task Summary",
  "Invoice Summary",
  "Team Activity",
];
const PERIODS = ["Last 7 days", "Last 30 days", "Last quarter", "Year to date"];

export default function Reports() {
  const { showToast } = useToast();
  const projects = useProjects();
  const tasks = useTasks();
  const invoices = useInvoices();
  const members = useMembers();
  const [reportType, setReportType] = useState("Project Report");
  const [period, setPeriod] = useState("Last 30 days");
  const [preview, setPreview] = useState<string | null>(null);

  function buildReport(type: string): string {
    switch (type) {
      case "Project Report": {
        const active = projects.filter((p) => p.status === "Active").length;
        const high = projects.filter((p) => p.priority === "High").length;
        const budget = projects.reduce((sum, p) => sum + p.budget, 0);
        return [
          `${projects.length} projects total, ${active} active.`,
          `${high} are high priority.`,
          `Total budget: $${budget.toLocaleString()}.`,
        ].join("\n");
      }
      case "Task Summary": {
        const done = tasks.filter((t) => t.done).length;
        const highOpen = tasks.filter(
          (t) => !t.done && t.priority === "High",
        ).length;
        return [
          `${tasks.length} tasks, ${done} done, ${tasks.length - done} open.`,
          `${highOpen} high-priority tasks still open.`,
        ].join("\n");
      }
      case "Invoice Summary": {
        const pending = invoices.filter((i) => i.status === "Pending");
        const overdue = invoices.filter((i) => i.status === "Overdue");
        const paid = invoices.filter((i) => i.status === "Paid");
        const sum = (list: { amount: number }[]) =>
          list.reduce((s, i) => s + i.amount, 0);
        return [
          `${invoices.length} invoices total.`,
          `Pending: ${pending.length} ($${sum(pending).toLocaleString()}).`,
          `Overdue: ${overdue.length} ($${sum(overdue).toLocaleString()}).`,
          `Collected: $${sum(paid).toLocaleString()}.`,
        ].join("\n");
      }
      case "Team Activity": {
        const admins = members.filter((m) => m.role === "Admin").length;
        return [
          `${members.length} members, ${admins} admins.`,
          "Latest events are available on the Activity page.",
        ].join("\n");
      }
      default:
        return "Select a report type to generate a summary.";
    }
  }

  function handleGenerate() {
    setPreview(buildReport(reportType));
    showToast(`${reportType} generated.`);
  }

  function handleQuickGenerate(type: string) {
    setReportType(type);
    setPreview(buildReport(type));
    showToast(`${type} generated.`);
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="subtitle">
            Generate and export summaries of your workspace.
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="report-type">Report type</label>
          <select
            data-waid="report_type_select"
            id="report-type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            {REPORT_TYPES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="report-period">Period</label>
          <select
            data-waid="report_period_select"
            id="report-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-actions">
          <button
            data-waid="generate_report_button"
            className="primary"
            onClick={handleGenerate}
          >
            Generate Report
          </button>
          <button
            data-waid="export_report_button"
            onClick={() => showToast(`Report exported as CSV.`)}
          >
            Export Report
          </button>
        </div>
      </div>

      {preview ? (
        <div className="report-card" data-waid="report_preview_card">
          <span className="detail-label">PREVIEW — {reportType}</span>
          <span className="detail-value">
            {reportType} · {period}
          </span>
          <pre className="report-body">{preview}</pre>
        </div>
      ) : (
        <p className="empty">No report generated yet. Pick a type and click Generate.</p>
      )}

      <h2 className="section-title">One-click reports</h2>
      <div className="quick-actions">
        <button
          data-waid="generate_project_report_button"
          onClick={() => handleQuickGenerate("Project Report")}
        >
          Project Report
        </button>
        <button
          data-waid="generate_invoice_summary_button"
          onClick={() => handleQuickGenerate("Invoice Summary")}
        >
          Invoice Summary
        </button>
      </div>
    </section>
  );
}