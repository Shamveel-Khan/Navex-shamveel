import { useNavigate } from "react-router-dom";
import { useProjects } from "../state/projects";

export default function Dashboard() {
  const navigate = useNavigate();
  const projects = useProjects();
  const highPriority = projects.filter((p) => p.priority === "High").length;

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="subtitle">Overview of your workspace and activity.</p>

      <div className="stats">
        <div className="stat-card">
          <span className="stat-value">{projects.length}</span>
          <span className="stat-label">Active projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{highPriority}</span>
          <span className="stat-label">High priority</span>
        </div>
      </div>

      <div className="quick-actions">
        <button
          data-waid="go_to_projects_button"
          onClick={() => navigate("/projects")}
        >
          Go to Projects
        </button>
        <button
          data-waid="go_to_settings_button"
          onClick={() => navigate("/settings")}
        >
          Open Settings
        </button>
      </div>
    </section>
  );
}
