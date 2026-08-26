import { useEffect, useRef } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { WebAgent } from "@navex/sdk";
import { ToastProvider } from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Settings from "./pages/Settings";

function AgentHost() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const agent = WebAgent.init({
      apiKey: "ox-alpha-testing",
      navigate: (path) => navigateRef.current(path),
    });
    return () => agent.destroy();
  }, []);

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <AgentHost />
      <div className="app">
        <header className="topbar">
          <span className="brand">TaskFlow</span>
          <nav className="nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/projects">Projects</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
