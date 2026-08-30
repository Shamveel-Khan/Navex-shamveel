import { type FormEvent, useState } from "react";
import { addInvoice, getClients } from "../state/invoices";
import { useToast } from "./Toast";

interface Props {
  onClose: () => void;
}

export default function InvoiceModal({ onClose }: Props) {
  const { showToast } = useToast();
  const [client, setClient] = useState(getClients()[0]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !amount) {
      setError("Invoice name and amount are required.");
      return;
    }
    addInvoice({ client, name, amount: Number(amount) });
    showToast(`Invoice for ${client} was created.`);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create Invoice"
      >
        <h2>Create Invoice</h2>
        <form data-waid="create_invoice_form" onSubmit={handleSubmit}>
          <label htmlFor="invoice-client">Client</label>
          <select
            data-waid="invoice_client_select"
            id="invoice-client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          >
            {getClients().map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label htmlFor="invoice-name">Invoice Name</label>
          <input
            data-waid="invoice_name_input"
            id="invoice-name"
            type="text"
            placeholder="e.g. Q3 Retainer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <label htmlFor="invoice-amount">Amount (USD)</label>
          <input
            data-waid="invoice_amount_input"
            id="invoice-amount"
            type="number"
            min={0}
            placeholder="e.g. 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {error && <p className="field-error">{error}</p>}

          <div className="modal-actions">
            <button
              type="button"
              data-waid="cancel_invoice_button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-waid="save_invoice_button"
              className="primary"
            >
              Save Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}