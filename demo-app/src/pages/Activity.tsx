import { useMemo, useState } from "react";
import { useToast } from "../components/Toast";
import {
  clearActivity,
  useEntries,
  type ActivityCategory,
} from "../state/activity";

const FILTER_OPTIONS = [
  "All",
  "Project",
  "Task",
  "Team",
  "Invoice",
];

export default function Activity() {
  const { showToast } = useToast();
  const entries = useEntries();
  const [filter, setFilter] = useState("All");

  const visible = useMemo(
    () =>
      entries.filter(
        (e) => filter === "All" || e.category === (filter as ActivityCategory),
      ),
    [entries, filter],
  );

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Activity</h1>
          <p className="subtitle">
            A chronological log of everything that happens in your workspace.
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="activity-filter">Category</label>
          <select
            data-waid="activity_filter_select"
            id="activity-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {FILTER_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-actions">
          <button
            data-waid="export_activity_button"
            onClick={() =>
              showToast(`Exported ${visible.length} activity event(s) as CSV.`)
            }
          >
            Export
          </button>
          <button
            data-waid="clear_activity_button"
            className="danger"
            onClick={() => {
              clearActivity();
              showToast("Activity log cleared.");
            }}
          >
            Clear Log
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">No activity recorded yet.</p>
      ) : (
        <ul className="project-list">
          {visible.map((e) => (
            <li
              key={e.id}
              className="activity-row"
              data-waid={`activity_entry_${e.id}`}
            >
              <span className="badge badge-neutral">{e.category}</span>
              <div className="task-body">
                <div className="task-title">{e.detail}</div>
                <div className="row-meta">{e.time}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}