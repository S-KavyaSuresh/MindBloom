import React, { useEffect, useState } from "react";

const STORAGE_KEY = "mindbloom_user";

function loadUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
}
function saveUser(u) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
}

export default function UserAccountPanel({ open, onClose }) {
  const [screen, setScreen] = useState("profile"); // profile | edit
  const [user, setUser] = useState(loadUser);
  const [form, setForm] = useState({ name: "", age: "", role: "student", goal: "", grade: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setForm({ name: user.name || "", age: user.age || "", role: user.role || "student", goal: user.goal || "", grade: user.grade || "" });
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      const panel = document.getElementById("userAccountPanel");
      if (panel && !panel.contains(e.target)) onClose?.();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  const handleSave = () => {
    const newUser = { ...form, initials: form.name ? form.name.slice(0, 2).toUpperCase() : "U", joinDate: user?.joinDate || new Date().toLocaleDateString() };
    setUser(newUser);
    saveUser(newUser);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setScreen("profile");
  };

  if (!open) return null;

  return (
    <section className="user-account-panel user-account-panel-open" id="userAccountPanel">
      {screen === "profile" && (
        <div>
          <div className="user-profile-header">
            <div className="user-big-avatar">{user?.initials || "👤"}</div>
            <div>
              <div className="user-profile-name">{user?.name || "Welcome!"}</div>
              <div className="user-profile-role">{user?.role === "student" ? "🎓 Student" : user?.role === "parent" ? "👪 Parent" : user?.role === "teacher" ? "📚 Teacher" : "👤 User"}</div>
              {user?.joinDate && <div className="user-profile-meta">Member since {user.joinDate}</div>}
            </div>
          </div>
          {user && (
            <div className="user-profile-details">
              {user.age && <div className="profile-row"><span>Age</span><span>{user.age}</span></div>}
              {user.grade && <div className="profile-row"><span>Grade</span><span>{user.grade}</span></div>}
              {user.goal && <div className="profile-row"><span>Goal</span><span>{user.goal}</span></div>}
            </div>
          )}
          <div className="user-account-actions">
            <button className="btn-primary" onClick={() => setScreen("edit")}>
              {user ? "✏️ Edit Profile" : "👤 Set Up Profile"}
            </button>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      )}

      {screen === "edit" && (
        <div>
          <div className="user-account-title">✏️ {user ? "Edit Profile" : "Create Profile"}</div>

          {[
            { id: "name", label: "Your Name", placeholder: "e.g. Alex", type: "text" },
            { id: "age", label: "Age", placeholder: "e.g. 10", type: "number" },
            { id: "grade", label: "Grade / Class", placeholder: "e.g. Grade 5", type: "text" },
            { id: "goal", label: "Learning Goal", placeholder: "e.g. Improve reading", type: "text" },
          ].map(({ id, label, placeholder, type }) => (
            <div key={id} className="user-account-field">
              <label htmlFor={`ua-${id}`}>{label}</label>
              <input id={`ua-${id}`} type={type} placeholder={placeholder}
                value={form[id]} onChange={(e) => setForm(f => ({ ...f, [id]: e.target.value }))} />
            </div>
          ))}

          <div className="user-account-field">
            <label>I am a...</label>
            <div className="role-options">
              {[["student","🎓 Student"],["parent","👪 Parent"],["teacher","📚 Teacher"]].map(([v, l]) => (
                <button key={v} type="button" className={`role-btn ${form.role === v ? "role-btn-active" : ""}`}
                  onClick={() => setForm(f => ({ ...f, role: v }))}>{l}</button>
              ))}
            </div>
          </div>

          <div className="user-account-actions">
            <button className="btn-primary" onClick={handleSave}>{saved ? "✅ Saved!" : "💾 Save"}</button>
            <button className="btn-ghost" onClick={() => setScreen("profile")}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
