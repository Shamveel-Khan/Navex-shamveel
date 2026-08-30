import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProjectModal from "../components/ProjectModal";
import {
  selectProject,
  useProjects,
  type Priority,
  type Project,
  type ProjectStatus,
} from "../state/projects";

const STATUS_OPTIONS = ["All", "Active", "On Hold", "Completed", "Archived"];
const PRIORITY_OPTIONS = ["All", "High", "Medium", "Low"];
const SORT_OPTIONS = ["Newest First", "Oldest First", "Name A-Z", "Name Z-A"];

export default function Projects() {
  const navigate = useNavigate();
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Newest First");
  const [modalOpen, setModalOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter(
      (p) =>
        (statusFilter === "All" || p.status === (statusFilter as ProjectStatus)) &&
        (priorityFilter === "All" ||
          p.priority === (priorityFilter as Priority)) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)),
    );
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "Oldest First":
          return a.createdAt.localeCompare(b.createdAt);
        case "Name A-Z":
          return a.name.localeCompare(b.name);
        case "Name Z-A":
          return b.name.localeCompare(a.name);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return list;
  }, [projects, query, statusFilter, priorityFilter, sortBy]);

  function openProject(project: Project) {
    selectProject(project.id);
    navigate("/projects/view");
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="subtitle">
            Create, view, and manage your projects.
          </p>
        </div>
        <button
          data-waid="create_project_button"
          className="primary"
          onClick={() => setModalOpen(true)}
        >
          + Create Project
        </button>
      </div>

      <input
        data-waid="search_projects_input"
        type="search"
        placeholder="Search projects..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search"
      />

      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="project-status-filter">Status</label>
          <select
            data-waid="project_status_filter"
            id="project-status-filter"
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
        <div className="filter-field">
          <label htmlFor="project-priority-filter">Priority</label>
          <select
            data-waid="project_priority_filter"
            id="project-priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="project-sort">Sort</label>
          <select
            data-waid="project_sort_select"
            id="project-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">No projects match your filters.</p>
      ) : (
        <ul className="project-list">
          {visible.map((p) => (
            <li
              key={p.id}
              className={`project-card priority-${p.priority.toLowerCase()}`}
            >
              <div className="project-head">
                <strong>{p.name}</strong>
                <span className="badges">
                  <span
                    className={`badge badge-${p.priority.toLowerCase()}`}
                  >
                    {p.priority}
                  </span>
                  <span
                    className={`badge badge-${p.status
                      .toLowerCase()
                      .replace(" ", "-")}`}
                  >
                    {p.status}
                  </span>
                </span>
              </div>
              {p.description && (
                <p className="project-desc">{p.description}</p>
              )}
              <span className="project-date">
                {p.assignee} · ${p.budget.toLocaleString()} · Created{" "}
                {p.createdAt}
              </span>
              <div className="row-actions">
                <button
                  data-waid={`project_card_${p.id}`}
                  aria-label={`Open ${p.name}`}
                  className="card-link"
                  onClick={() => openProject(p)}
                >
                  View details →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && <ProjectModal onClose={() => setModalOpen(false)} />}
    </section>
  );
}