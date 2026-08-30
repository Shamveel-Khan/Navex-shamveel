import { type FormEvent } from "react";
import { useToast } from "./Toast";

interface Props {
  onClose: () => void;
}

export default function DeleteAccountModal({ onClose }: Props) {
  const { showToast } = useToast();

  function handleConfirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    showToast("Account deletion requested. Check your email to confirm.");
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Delete Account"
      >
        <h2>Delete Account</h2>
        <p className="modal-warning">
          This will permanently delete your workspace data, projects, tasks,
          and invoices. This action cannot be undone.
        </p>
        <form data-waid="delete_account_form" onSubmit={handleConfirm}>
          <div className="modal-actions">
            <button
              type="button"
              data-waid="cancel_delete_button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-waid="confirm_delete_account_button"
              className="danger"
            >
              Delete Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}