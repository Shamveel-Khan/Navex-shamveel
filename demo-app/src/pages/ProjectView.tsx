import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EditProjectModal from "../components/EditProjectModal";
import { useToast } from "../components/Toast";
import {
  updateProject,
  useSelectedProject,
  type Project,
} from "../state/projects";

export default function ProjectView() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const project = useSelectedProject();
  const [editOpen, setEditOpen] = useState(false);

  if (!project) {
    return (
      <section>
        <h1>Project details</h1>
        <p className="subtitle">
          No project is selected. Pick a project from the list first.
        </p>
        <div className="quick-actions">
          <button
            data-waid="back_to_projects_button"
            onClick={() => navigate("/projects")}
          >
            ← Back to Projects
          </button>
        </div>
      </section>
    );
  }

  function handleArchive(p: Project) {
    updateProject(p.id, { status: "Archived" });
    showToast(`Project "${p.name}" was archived.`);
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{project.name}</h1>
          <p className="subtitle">{project.description}</p>
        </div>
        <div className="badges">
          <span className={`badge badge-${project.priority.toLowerCase()}`}>
            {project.priority}
          </span>
          <span
            className={`badge badge-${project.status
              .toLowerCase()
              .replace(" ", "-")}`}
          >
            {project.status}
          </span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <span className="detail-label">Status</span>
          <span className="detail-value">{project.status}</span>
        </div>
        <div className="detail-card">
          <span className="detail-label">Assignee</span>
          <span className="detail-value">{project.assignee}</span>
        </div>
        <div className="detail-card">
          <span className="detail-label">Budget</span>
          <span className="detail-value">
            ${project.budget.toLocaleString()}
          </span>
        </div>
        <div className="detail-card">
          <span className="detail-label">Created</span>
          <span className="detail-value">{project.createdAt}</span>
        </div>
      </div>

      <div className="quick-actions">
        <button
          data-waid="back_to_projects_button"
          onClick={() => navigate("/projects")}
        >
          ← Back to Projects
        </button>
        <button
          data-waid="edit_project_button"
          className="primary"
          onClick={() => setEditOpen(true)}
        >
          Edit Project
        </button>
        {project.status !== "Archived" && (
          <button
            data-waid="archive_project_button"
            className="danger"
            onClick={() => handleArchive(project)}
          >
            Archive Project
          </button>
        )}
      </div>

      {editOpen && (
        <EditProjectModal
          project={project}
          onClose={() => setEditOpen(false)}
        />
      )}
    </section>
  );
}