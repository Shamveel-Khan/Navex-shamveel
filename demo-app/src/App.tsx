import { NavLink, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import Activity from "./pages/Activity";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import Projects from "./pages/Projects";
import ProjectView from "./pages/ProjectView";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Tasks from "./pages/Tasks";
import Team from "./pages/Team";

export default function App() {
  return (
    <ToastProvider>
      <div className="app">
        <header className="topbar">
          <span className="brand">TaskFlow</span>
          <nav className="nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/projects">Projects</NavLink>
            <NavLink to="/team">Team</NavLink>
            <NavLink to="/tasks">Tasks</NavLink>
            <NavLink to="/invoices">Invoices</NavLink>
            <NavLink to="/reports">Reports</NavLink>
            <NavLink to="/activity">Activity</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/view" element={<ProjectView />} />
            <Route path="/team" element={<Team />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}