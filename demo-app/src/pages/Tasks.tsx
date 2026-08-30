import { useMemo, useState } from "react";
import TaskModal from "../components/TaskModal";
import { useToast } from "../components/Toast";
import { useProjects, type Priority } from "../state/projects";
import {
  clearCompletedTasks,
  toggleTask,
  useTasks,
  type TaskStatus,
} from "../state/tasks";

const STATUS_OPTIONS = ["All", "To Do", "In Progress", "Done"];
const PRIORITY_OPTIONS = ["All", "High", "Medium", "Low"];

export default function Tasks() {
  const { showToast } = useToast();
  const tasks = useTasks();
  useProjects();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (statusFilter === "All" ||
          t.status === (statusFilter as TaskStatus)) &&
        (priorityFilter === "All" ||
          t.priority === (priorityFilter as Priority)) &&
        (!q || t.title.toLowerCase().includes(q)),
    );
  }, [tasks, query, statusFilter, priorityFilter]);

  const doneCount = tasks.filter((t) => t.done).length;

  function handleClearCompleted() {
    const removed = clearCompletedTasks();
    showToast(`Removed ${removed} completed task(s).`);
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="subtitle">Track work across your projects.</p>
        </div>
        <button
          data-waid="create_task_button"
          className="primary"
          onClick={() => setModalOpen(true)}
        >
          + Create Task
        </button>
      </div>

      <input
        data-waid="tasks_search_input"
        type="search"
        placeholder="Search tasks..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search"
      />

      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="task-status-filter">Status</label>
          <select
            data-waid="task_status_filter"
            id="task-status-filter"
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
          <label htmlFor="task-priority-filter">Priority</label>
          <select
            data-waid="task_priority_filter"
            id="task-priority-filter"
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
        <div className="filter-actions">
          <button
            data-waid="export_tasks_button"
            onClick={() => showToast("Task list exported as CSV.")}
          >
            Export
          </button>
          <button
            data-waid="clear_completed_tasks_button"
            className="danger"
            disabled={doneCount === 0}
            onClick={handleClearCompleted}
          >
            Clear Completed ({doneCount})
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">No tasks match your filters.</p>
      ) : (
        <ul className="project-list">
          {visible.map((t) => (
            <li key={t.id} className={`task-row${t.done ? " done" : ""}`}>
              <input
                data-waid={`task_done_${t.id}`}
                type="checkbox"
                checked={t.done}
                aria-label={`Mark task "${t.title}" as ${t.done ? "not done" : "done"}`}
                onChange={() => toggleTask(t.id)}
              />
              <div className="task-body">
                <div className="task-title">{t.title}</div>
                <div className="row-meta">
                  {t.assignee} · Due {t.dueDate} · {t.description}
                </div>
              </div>
              <span className={`badge badge-${t.priority.toLowerCase()}`}>
                {t.priority}
              </span>
              <span className="badge badge-neutral">{t.status}</span>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && <TaskModal onClose={() => setModalOpen(false)} />}
    </section>
  );
}