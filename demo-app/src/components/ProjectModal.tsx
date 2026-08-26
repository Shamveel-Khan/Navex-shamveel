import { type FormEvent, useState } from "react";
import { addProject, type Priority } from "../state/projects";
import { useToast } from "./Toast";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

interface Props {
  onClose: () => void;
}

export default function ProjectModal({ onClose }: Props) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    addProject({ name, description, priority });
    showToast(`Project "${name.trim()}" was created.`);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create Project"
      >
        <h2>Create Project</h2>
        <form data-waid="new_project_form" onSubmit={handleSubmit}>
          <label htmlFor="project-name">Project Name</label>
          <input
            data-waid="project_name_input"
            id="project-name"
            type="text"
            placeholder="e.g. Alpha"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {error && <p className="field-error">{error}</p>}

          <label htmlFor="project-description">Description</label>
          <textarea
            data-waid="project_description_input"
            id="project-description"
            rows={3}
            placeholder="What is this project about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label htmlFor="project-priority">Priority</label>
          <select
            data-waid="priority_select"
            id="project-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <div className="modal-actions">
            <button
              type="button"
              data-waid="cancel_project_button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-waid="save_project_button"
              className="primary"
            >
              Save Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
