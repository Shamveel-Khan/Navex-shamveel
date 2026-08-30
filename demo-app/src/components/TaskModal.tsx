import { type FormEvent, useState } from "react";
import { getAssignees, type Priority } from "../state/projects";
import { addTask, type TaskStatus } from "../state/tasks";
import { useToast } from "./Toast";

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Done"];

interface Props {
  onClose: () => void;
}

export default function TaskModal({ onClose }: Props) {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [status, setStatus] = useState<TaskStatus>("To Do");
  const [assignee, setAssignee] = useState("Unassigned");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    addTask({ title, description, priority, status, assignee });
    showToast(`Task "${title.trim()}" was created.`);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create Task"
      >
        <h2>Create Task</h2>
        <form data-waid="create_task_form" onSubmit={handleSubmit}>
          <label htmlFor="task-title">Title</label>
          <input
            data-waid="task_title_input"
            id="task-title"
            type="text"
            placeholder="e.g. Reduce bundle size"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          {error && <p className="field-error">{error}</p>}

          <label htmlFor="task-description">Description</label>
          <textarea
            data-waid="task_description_textarea"
            id="task-description"
            rows={3}
            placeholder="What needs to happen?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="field-grid">
            <div className="field-cell">
              <label htmlFor="task-priority">Priority</label>
              <select
                data-waid="task_priority_select"
                id="task-priority"
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
              <label htmlFor="task-status">Status</label>
              <select
                data-waid="task_status_select"
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-cell">
              <label htmlFor="task-assignee">Assignee</label>
              <select
                data-waid="task_assignee_select"
                id="task-assignee"
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
          </div>

          <div className="modal-actions">
            <button
              type="button"
              data-waid="cancel_task_button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-waid="save_task_button"
              className="primary"
            >
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}