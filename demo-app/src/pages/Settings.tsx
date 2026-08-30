import { useState, type FormEvent } from "react";
import DeleteAccountModal from "../components/DeleteAccountModal";
import { useToast } from "../components/Toast";

const LANGUAGES = ["English", "Spanish", "French", "German", "Japanese"];
const TIMEZONES = [
  "UTC",
  "UTC-5 (Eastern)",
  "UTC-8 (Pacific)",
  "UTC+1 (CET)",
  "UTC+5:30 (IST)",
];

export default function Settings() {
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState("Shamveel Khan");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [language, setLanguage] = useState("English");
  const [timezone, setTimezone] = useState("UTC+5:30 (IST)");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    showToast("Settings saved.");
  }

  return (
    <section>
      <h1>Settings</h1>
      <p className="subtitle">
        Manage your profile and notification preferences.
      </p>

      <form
        data-waid="settings_form"
        className="settings-form"
        onSubmit={handleSubmit}
      >
        <label htmlFor="display-name">Display Name</label>
        <input
          data-waid="display_name_input"
          id="display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <label htmlFor="avatar-url">Avatar URL</label>
        <input
          data-waid="avatar_url_input"
          id="avatar-url"
          type="text"
          placeholder="https://example.com/avatar.png"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
        />

        <label className="checkbox-row">
          <input
            data-waid="email_notifications_checkbox"
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
          />
          Email me about important updates
        </label>

        <label className="checkbox-row">
          <input
            data-waid="dark_mode_checkbox"
            type="checkbox"
            checked={darkMode}
            onChange={(e) => setDarkMode(e.target.checked)}
          />
          Enable dark mode preview
        </label>

        <label className="checkbox-row">
          <input
            data-waid="weekly_summary_checkbox"
            type="checkbox"
            checked={weeklySummary}
            onChange={(e) => setWeeklySummary(e.target.checked)}
          />
          Send me a weekly summary
        </label>

        <div className="field-grid">
          <div className="field-cell">
            <label htmlFor="settings-language">Language</label>
            <select
              data-waid="language_select"
              id="settings-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field-cell">
            <label htmlFor="settings-timezone">Timezone</label>
            <select
              data-waid="timezone_select"
              id="settings-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="settings-actions">
          <button
            type="submit"
            data-waid="save_settings_button"
            className="primary"
          >
            Save Settings
          </button>
          <button
            type="button"
            data-waid="export_data_button"
            onClick={() => showToast("Your data export has been emailed to you.")}
          >
            Export My Data
          </button>
        </div>
      </form>

      <div className="danger-zone">
        <h3>Danger zone</h3>
        <button
          data-waid="delete_account_button"
          className="danger"
          onClick={() => setDeleteOpen(true)}
        >
          Delete Account
        </button>
      </div>

      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} />}
    </section>
  );
}