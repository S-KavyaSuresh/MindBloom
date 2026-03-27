import React, { useState, useEffect, useCallback } from "react";
import FeatureTabs        from "./components/FeatureTabs.jsx";
import SettingsBanner     from "./components/SettingsBanner.jsx";
import FloatingSupport    from "./components/FloatingSupport.jsx";
import UserAccountPanel   from "./components/UserAccountPanel.jsx";

import SimplifyText       from "./pages/SimplifyText.jsx";
import GamifiedLearning   from "./pages/GamifiedLearning.jsx";
import Breaktime          from "./pages/Breaktime.jsx";
import Dashboard          from "./pages/Dashboard.jsx";
import Planner            from "./pages/Planner.jsx";

import { getApiBase } from "./lib/api.js";

export default function App() {
  const [activeTab,     setActiveTab]     = useState("simplify");
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [aiOpen,        setAiOpen]        = useState(false);
  const [userInitials,  setUserInitials]  = useState("U");
  const [backendStatus, setBackendStatus] = useState("checking"); // "checking" | "ok" | "down"
  const [toasts,        setToasts]        = useState([]);

  // ── Backend health check ──────────────────────────────────────────────────
  const checkBackend = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBase()}/health`, { signal: AbortSignal.timeout(4000) });
      setBackendStatus(res.ok ? "ok" : "down");
    } catch {
      setBackendStatus("down");
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const id = setInterval(checkBackend, 15000);
    return () => clearInterval(id);
  }, [checkBackend]);

  // ── Global toast system ───────────────────────────────────────────────────
  // Pages can fire a custom event: dispatchEvent(new CustomEvent("mb:toast", { detail: { msg, type } }))
  useEffect(() => {
    const handler = (e) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, msg: e.detail.msg, type: e.detail.type || "error" }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    };
    window.addEventListener("mb:toast", handler);
    return () => window.removeEventListener("mb:toast", handler);
  }, []);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("mindbloom_user"));
      if (u?.initials) setUserInitials(u.initials);
    } catch {}
  }, [userPanelOpen]);

  return (
    <div className={`app-root ${aiOpen ? "ai-open" : ""}`}>
      <header className="app-header">
        <div className="app-logo">
          <img src="/favicon.png" alt="MindBloom icon" className="logo-icon" />
          <span className="logo-mark">Mind</span>
          <span className="logo-mark-alt">Bloom</span>
          <span className="logo-tagline">Learning made easy ✨</span>
        </div>
        <div className="app-header-right">
          <button
            className="user-avatar"
            type="button"
            aria-label="User account"
            onClick={() => setUserPanelOpen(v => !v)}
          >
            <span className="user-avatar-initials">{userInitials}</span>
          </button>
        </div>
      </header>

      {/* ── Backend status banner ── */}
      {backendStatus === "down" && (
        <div className="backend-banner">
          <span className="backend-banner-icon">⚠️</span>
          <span className="backend-banner-text">
            <strong>Backend server is not running.</strong>{" "}
            Open a terminal, go to the <code>backend/</code> folder and run:{" "}
            <code>uvicorn app.main:app --reload</code>
          </span>
          <button className="backend-banner-retry" onClick={checkBackend}>Retry</button>
        </div>
      )}
      {backendStatus === "checking" && (
        <div className="backend-banner backend-banner-checking">
          <span>⏳ Connecting to backend…</span>
        </div>
      )}

      {/* ── Global toasts ── */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            <span>{t.type === "error" ? "❌" : "✅"}</span>
            <span>{t.msg}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
          </div>
        ))}
      </div>

      <main className="app-main">
        <section className="main-content">
          <FeatureTabs active={activeTab} onChange={setActiveTab} />

          {/*
            All pages are always mounted — just hidden with display:none.
            This preserves all state (schedules, quiz progress, etc.)
            when the user switches tabs.
          */}
          <section className="card main-panel">
            <div style={{ display: activeTab === "simplify"  ? "flex" : "none", flexDirection: "column", flex: 1 }}>
              <SimplifyText />
            </div>
            <div style={{ display: activeTab === "planner"   ? "flex" : "none", flexDirection: "column", flex: 1 }}>
              <Planner />
            </div>
            <div style={{ display: activeTab === "gamified"  ? "flex" : "none", flexDirection: "column", flex: 1 }}>
              <GamifiedLearning />
            </div>
            <div style={{ display: activeTab === "breaktime" ? "flex" : "none", flexDirection: "column", flex: 1 }}>
              <Breaktime />
            </div>
            <div style={{ display: activeTab === "dashboard" ? "flex" : "none", flexDirection: "column", flex: 1 }}>
              <Dashboard />
            </div>
          </section>
        </section>
      </main>

      <SettingsBanner />
      <FloatingSupport aiOpen={aiOpen} onAiOpenChange={setAiOpen} />
      <UserAccountPanel open={userPanelOpen} onClose={() => setUserPanelOpen(false)} />
    </div>
  );
}
