import { useMemo, useState } from "react";
import TeamMemberModal from "../components/TeamMemberModal";
import { useToast } from "../components/Toast";
import {
  removeMemberByName,
  useMembers,
  type MemberRole,
} from "../state/team";

const ROLE_OPTIONS = ["All", "Admin", "Member", "Viewer"];

export default function Team() {
  const { showToast } = useToast();
  const members = useMembers();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [toRemove, setToRemove] = useState(members[0]?.name ?? "");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        (roleFilter === "All" || m.role === (roleFilter as MemberRole)) &&
        (!q ||
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)),
    );
  }, [members, query, roleFilter]);

  function handleRemove() {
    if (!toRemove) return;
    removeMemberByName(toRemove);
    showToast(`${toRemove} was removed from the workspace.`);
    const remaining = members.filter((m) => m.name !== toRemove);
    setToRemove(remaining[0]?.name ?? "");
  }

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Team</h1>
          <p className="subtitle">Manage who has access to this workspace.</p>
        </div>
        <button
          data-waid="add_member_button"
          className="primary"
          onClick={() => setModalOpen(true)}
        >
          + Invite Member
        </button>
      </div>

      <input
        data-waid="team_search_input"
        type="search"
        placeholder="Search members..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="search"
      />

      <div className="filter-bar">
        <div className="filter-field">
          <label htmlFor="member-role-filter">Role</label>
          <select
            data-waid="member_role_filter"
            id="member-role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">No members match your filters.</p>
      ) : (
        <ul className="project-list">
          {visible.map((m) => (
            <li key={m.id} className="project-card">
              <div className="project-head">
                <strong>{m.name}</strong>
                <span className={`badge badge-role-${m.role.toLowerCase()}`}>
                  {m.role}
                </span>
              </div>
              <p className="project-desc">{m.email}</p>
              <span className="project-date">Joined {m.joinedAt}</span>
            </li>
          ))}
        </ul>
      )}

      {members.length > 0 && (
        <div className="remove-bar">
          <label htmlFor="member-remove">Member to remove</label>
          <select
            data-waid="member_to_remove_select"
            id="member-remove"
            value={toRemove}
            onChange={(e) => setToRemove(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            data-waid="remove_member_button"
            className="danger"
            onClick={handleRemove}
          >
            Remove Member
          </button>
        </div>
      )}

      {modalOpen && <TeamMemberModal onClose={() => setModalOpen(false)} />}
    </section>
  );
}