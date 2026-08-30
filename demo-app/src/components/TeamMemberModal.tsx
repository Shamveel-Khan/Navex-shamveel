import { type FormEvent, useState } from "react";
import { addMember, type MemberRole } from "../state/team";
import { useToast } from "./Toast";

const ROLES: MemberRole[] = ["Admin", "Member", "Viewer"];

interface Props {
  onClose: () => void;
}

export default function TeamMemberModal({ onClose }: Props) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("Member");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    addMember({ name, email, role });
    showToast(`Invite sent to "${name.trim()}".`);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Invite Team Member"
      >
        <h2>Invite Team Member</h2>
        <form data-waid="team_member_form" onSubmit={handleSubmit}>
          <label htmlFor="member-name">Full Name</label>
          <input
            data-waid="member_name_input"
            id="member-name"
            type="text"
            placeholder="e.g. Jordan Lee"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <label htmlFor="member-email">Email</label>
          <input
            data-waid="member_email_input"
            id="member-email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className="field-error">{error}</p>}

          <label htmlFor="member-role">Role</label>
          <select
            data-waid="member_role_select"
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <div className="modal-actions">
            <button
              type="button"
              data-waid="cancel_invite_button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-waid="invite_member_button"
              className="primary"
            >
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}