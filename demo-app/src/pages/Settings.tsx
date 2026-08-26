import { useState } from "react";
import { useToast } from "../components/Toast";

export default function Settings() {
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState("Shamveel Khan");
  const [emailNotifications, setEmailNotifications] = useState(true);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    showToast("Settings saved.");
  }

  return (
    <section>
      <h1>Settings</h1>
      <p className="subtitle">
        Manage your profile and notification preferences.
      </p>

      <form data-waid="settings_form" className="settings-form" onSubmit={handleSubmit}>
        <label htmlFor="display-name">Display Name</label>
        <input
          data-waid="display_name_input"
          id="display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
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

        <button type="submit" data-waid="save_settings_button" className="primary">
          Save Settings
        </button>
      </form>
    </section>
  );
}
