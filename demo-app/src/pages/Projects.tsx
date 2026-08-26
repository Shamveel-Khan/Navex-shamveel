import { useMemo, useState } from "react";
import ProjectModal from "../components/ProjectModal";
import { useProjects } from "../state/projects";

export default function Projects() {
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [projects, query]);

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

      {visible.length === 0 ? (
        <p className="empty">No projects match "{query}".</p>
      ) : (
        <ul className="project-list">
          {visible.map((p) => (
            <li
              key={p.id}
              className={`project-card priority-${p.priority.toLowerCase()}`}
            >
              <div className="project-head">
                <strong>{p.name}</strong>
                <span
                  className={`badge badge-${p.priority.toLowerCase()}`}
                >
                  {p.priority}
                </span>
              </div>
              {p.description && (
                <p className="project-desc">{p.description}</p>
              )}
              <span className="project-date">Created {p.createdAt}</span>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && <ProjectModal onClose={() => setModalOpen(false)} />}
    </section>
  );
}
