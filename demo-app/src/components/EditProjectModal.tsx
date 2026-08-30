import { type FormEvent, useState } from "react";
import {
  getAssignees,
  type Priority,
  type Project,
  type ProjectStatus,
  updateProject,
} from "../state/projects";
import { useToast } from "./Toast";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const STATUSES: ProjectStatus[] = [
  "Active",
  "On Hold",
  "Completed",
  "Archived",
];

interface Props {
  project: Project;
  onClose: () => void;
}

export default function EditProjectModal({ project, onClose }: Props) {
  const { showToast } = useToast();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [priority, setPriority] = useState<Priority>(project.priority);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [assignee, setAssignee] = useState(project.assignee);
  const [budget, setBudget] = useState(String(project.budget));
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    updateProject(project.id, {
      name,
      description,
      priority,
      status,
      assignee,
      budget: budget ? Number(budget) : 0,
    });
    showToast(`Project "${name.trim()}" was updated.`);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit Project"
      >
        <h2>Edit {project.name}</h2>
        <form data-waid="edit_project_form" onSubmit={handleSubmit}>
          <label htmlFor="edit-project-name">Project Name</label>
          <input
            data-waid="edit_project_name_input"
            id="edit-project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {error && <p className="field-error">{error}</p>}

          <label htmlFor="edit-project-description">Description</label>
          <textarea
            data-waid="edit_project_description_textarea"
            id="edit-project-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="field-grid">
            <div className="field-cell">
              <label htmlFor="edit-project-priority">Priority</label>
              <select
                data-waid="edit_project_priority_select"
                id="edit-project-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-cell">
              <label htmlFor="edit-project-status">Status</label>
              <select
                data-waid="edit_project_status_select"
                id="edit-project-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-cell">
              <label htmlFor="edit-project-assignee">Assignee</label>
              <select
                data-waid="edit_project_assignee_select"
                id="edit-project-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              >
                {getAssignees().map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-cell">
              <label htmlFor="edit-project-budget">Budget (USD)</label>
              <input
                data-waid="edit_project_budget_input"
                id="edit-project-budget"
                type="number"
                min={0}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" data-waid="cancel_edit_project_button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              data-waid="save_edit_project_button"
              className="primary"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}