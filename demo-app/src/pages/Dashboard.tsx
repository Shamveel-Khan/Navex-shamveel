import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast";
import { useProjects } from "../state/projects";
import { useTasks } from "../state/tasks";
import { useInvoices } from "../state/invoices";
import { useMembers } from "../state/team";

export default function Dashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const projects = useProjects();
  const tasks = useTasks();
  const invoices = useInvoices();
  const members = useMembers();
  const [announcement, setAnnouncement] = useState(true);

  const activeProjects = projects.filter((p) => p.status === "Active").length;
  const highPriority = projects.filter((p) => p.priority === "High").length;
  const openTasks = tasks.filter((t) => !t.done).length;
  const pendingInvoices = invoices.filter(
    (i) => i.status === "Pending" || i.status === "Overdue",
  ).length;

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="subtitle">Overview of your workspace and activity.</p>

      {announcement && (
        <div className="announcement">
          <span>
            <strong>Announcement:</strong> The new Invoices module is live —
            send invoices straight from your workspace.
          </span>
          <button
            data-waid="dashboard_dismiss_announcement_button"
            onClick={() => setAnnouncement(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="stats">
        <div className="stat-card">
          <span className="stat-value">{projects.length}</span>
          <span className="stat-label">Total projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{activeProjects}</span>
          <span className="stat-label">Active projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{highPriority}</span>
          <span className="stat-label">High priority</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{openTasks}</span>
          <span className="stat-label">Open tasks</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{pendingInvoices}</span>
          <span className="stat-label">Pending invoices</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{members.length}</span>
          <span className="stat-label">Team members</span>
        </div>
      </div>

      <h2 className="section-title">Quick actions</h2>
      <div className="quick-actions">
        <button
          data-waid="go_to_projects_button"
          onClick={() => navigate("/projects")}
        >
          Go to Projects
        </button>
        <button data-waid="go_to_team_button" onClick={() => navigate("/team")}>
          Open Team
        </button>
        <button
          data-waid="go_to_tasks_button"
          onClick={() => navigate("/tasks")}
        >
          Open Tasks
        </button>
        <button
          data-waid="go_to_invoices_button"
          onClick={() => navigate("/invoices")}
        >
          Open Invoices
        </button>
        <button
          data-waid="go_to_reports_button"
          onClick={() => navigate("/reports")}
        >
          Open Reports
        </button>
        <button
          data-waid="go_to_activity_button"
          onClick={() => navigate("/activity")}
        >
          Open Activity
        </button>
        <button
          data-waid="go_to_settings_button"
          onClick={() => navigate("/settings")}
        >
          Open Settings
        </button>
        <button
          data-waid="dashboard_refresh_button"
          onClick={() => showToast("Dashboard refreshed — stats are up to date.")}
        >
          Refresh Stats
        </button>
      </div>
    </section>
  );
}