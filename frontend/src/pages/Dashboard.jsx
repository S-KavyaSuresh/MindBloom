import React, { useState, useEffect } from "react";
import { loadStats, saveStats, recordActivity, getLast7DayKeys, getDayLabel } from "../lib/tracker.js";

const BADGE_DEFS = [
  { id: "first_quiz",   icon: "🧠", label: "First Quiz",        desc: "Completed your first quiz",           check: (s) => s.quizzesCompleted >= 1 },
  { id: "quiz_master",  icon: "🏆", label: "Quiz Master",       desc: "Answered 20 questions correctly",     check: (s) => s.quizzesCompleted >= 20 },
  { id: "streak3",      icon: "🔥", label: "3-Day Streak",      desc: "Studied 3 days in a row",             check: (s) => s.streak >= 3 },
  { id: "streak7",      icon: "⚡", label: "7-Day Streak",      desc: "Studied 7 days in a row",             check: (s) => s.streak >= 7 },
  { id: "century",      icon: "💯", label: "100 Points Club",   desc: "Earned 100+ total points",            check: (s) => s.points >= 100 },
  { id: "planner",      icon: "📅", label: "Plan Champion",     desc: "Completed 5 scheduled sessions",      check: (s) => s.sessionsCompleted >= 5 },
  { id: "simplifier",   icon: "📚", label: "Text Simplifier",   desc: "Used Simplify Text 5 times",          check: (s) => s.simplifiesUsed >= 5 },
  { id: "gamer",        icon: "🎮", label: "Break Champion",    desc: "Played 10 break-time games",          check: (s) => s.gamesPlayed >= 10 },
  { id: "storyteller",  icon: "📖", label: "Story Lover",       desc: "Read 5 stories in Break Time",        check: (s) => s.storiesRead >= 5 },
  { id: "consistent",   icon: "🌟", label: "Consistent Learner",desc: "Used MindBloom on 10 different days",  check: (s) => s.totalDaysUsed >= 10 },
];


// Public helper — call this from other pages to record activity

function formatMinutes(mins) {
  if (!mins || mins === 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Dashboard() {
  const [view, setView] = useState("student");
  const [stats, setStats] = useState(loadStats());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Refresh from localStorage every 3 seconds while tab is open
  useEffect(() => {
    const t = setInterval(() => setStats(loadStats()), 3000);
    return () => clearInterval(t);
  }, []);

  // Mark today as visited
  useEffect(() => { recordActivity("points", { amount: 0 }); }, []);

  const dayKeys = getLast7DayKeys();
  const dailyPts = dayKeys.map(k => stats.dailyPoints?.[k] || 0);
  const dailyMins = dayKeys.map(k => stats.dailyMinutes?.[k] || 0);
  const maxPts = Math.max(...dailyPts, 1);
  const maxMins = Math.max(...dailyMins, 1);

  // Subject breakdown
  const subjectData = Object.entries(stats.subjectMinutes || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Badges — computed live
  const badges = BADGE_DEFS.map(b => ({ ...b, earned: b.check(stats) }));
  const earnedCount = badges.filter(b => b.earned).length;

  const totalStudyTime = formatMinutes(stats.totalMinutes || 0);
  const accuracy = stats.quizzesCompleted > 0
    ? Math.min(99, 70 + Math.floor(stats.quizzesCompleted * 1.2)) + "%"
    : "—";

  const generateReport = () => {
    const report = `MindBloom Weekly Progress Report
=====================================
Date: ${new Date().toLocaleDateString()}

OVERVIEW
• Total Points:          ${stats.points || 0}
• Current Streak:        ${stats.streak || 0} days
• Total Study Time:      ${totalStudyTime}
• Quizzes Completed:     ${stats.quizzesCompleted || 0}
• Sessions Completed:    ${stats.sessionsCompleted || 0}
• Games Played:          ${stats.gamesPlayed || 0}
• Stories Read:          ${stats.storiesRead || 0}
• Simplify Used:         ${stats.simplifiesUsed || 0} times
• Total Days Used:       ${stats.totalDaysUsed || 0} days

SUBJECT STUDY TIME
${subjectData.length > 0 ? subjectData.map(([s, m]) => `• ${s}: ${formatMinutes(m)}`).join("\n") : "• No subject data yet — start your schedule!"}

BADGES EARNED (${earnedCount}/${BADGE_DEFS.length})
${badges.filter(b => b.earned).map(b => `• ${b.icon} ${b.label}: ${b.desc}`).join("\n") || "• Keep going to earn badges!"}

DAILY PROGRESS (Last 7 Days)
${dayKeys.map((k, i) => `• ${getDayLabel(k)} ${k}: ${dailyPts[i]} pts, ${formatMinutes(dailyMins[i])} studied`).join("\n")}

Keep up the fantastic work! 🌟
=====================================`;
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "MindBloom_Progress_Report.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const resetStats = () => {
    localStorage.removeItem("mindbloom_stats");
    setStats(loadStats());
    setShowResetConfirm(false);
  };

  const sendMessage = () => {
    const msg = `Hello Teacher,\n\nProgress report from MindBloom:\n\n• Points Earned: ${stats.points || 0}\n• Streak: ${stats.streak || 0} days\n• Study Time: ${totalStudyTime}\n• Quizzes Completed: ${stats.quizzesCompleted || 0}\n• Sessions Done: ${stats.sessionsCompleted || 0}\n\nSubjects studied:\n${subjectData.map(([s,m]) => `• ${s}: ${formatMinutes(m)}`).join("\n") || "• Starting soon!"}\n\nKind regards,\nMindBloom Platform`;
    window.location.href = `mailto:teacher@school.com?subject=Student Progress - MindBloom&body=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h2 className="card-title">📊 Learning Dashboard</h2>
        <div className="dashboard-view-tabs">
          <button className={`view-tab ${view === "student" ? "view-tab-active" : ""}`} onClick={() => setView("student")}>👤 Student</button>
          <button className={`view-tab ${view === "parent"  ? "view-tab-active" : ""}`} onClick={() => setView("parent")}>👪 Parent</button>
          <button className={`view-tab ${view === "teacher" ? "view-tab-active" : ""}`} onClick={() => setView("teacher")}>🎓 Teacher</button>
        </div>
      </div>

      {/* ── Student View ── */}
      {view === "student" && (
        <div>
          <div className="stats-grid">
            <div className="stat-card stat-points"><div className="stat-icon">⭐</div><div className="stat-value">{stats.points || 0}</div><div className="stat-label">Total Points</div></div>
            <div className="stat-card stat-streak"><div className="stat-icon">🔥</div><div className="stat-value">{stats.streak || 0}</div><div className="stat-label">Day Streak</div></div>
            <div className="stat-card stat-time"><div className="stat-icon">⏰</div><div className="stat-value">{totalStudyTime}</div><div className="stat-label">Study Time</div></div>
            <div className="stat-card stat-accuracy"><div className="stat-icon">🎯</div><div className="stat-value">{stats.quizzesCompleted || 0}</div><div className="stat-label">Quizzes Done</div></div>
          </div>

          {/* 7-Day Points Chart */}
          <div className="card-subsection">
            <h3 className="card-subheading">📈 Points Earned — Last 7 Days</h3>
            {dailyPts.every(p => p === 0) ? (
              <div className="empty-chart-msg">📭 No data yet — start studying to see your progress here!</div>
            ) : (
              <div className="chart-container">
                <svg viewBox="0 0 700 160" className="progress-chart">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35"/>
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  {dayKeys.map((k, i) => (
                    <text key={k} x={i * 100 + 50} y={155} fontSize="11" fill="var(--color-text-muted)" textAnchor="middle">{getDayLabel(k)}</text>
                  ))}
                  <polyline fill="url(#chartGrad)"
                    points={[...dailyPts.map((p, i) => `${i*100+50},${130 - (p/maxPts)*110}`), "650,130","50,130"].join(" ")} />
                  <polyline fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    points={dailyPts.map((p, i) => `${i*100+50},${130 - (p/maxPts)*110}`).join(" ")} />
                  {dailyPts.map((p, i) => (
                    <g key={i}>
                      <circle cx={i*100+50} cy={130-(p/maxPts)*110} r="5" fill="var(--color-accent)" />
                      {p > 0 && <text x={i*100+50} y={130-(p/maxPts)*110-10} fontSize="10" fill="var(--color-accent)" textAnchor="middle">{p}</text>}
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* 7-Day Minutes Chart */}
          <div className="card-subsection">
            <h3 className="card-subheading">⏱️ Study Time — Last 7 Days</h3>
            {dailyMins.every(m => m === 0) ? (
              <div className="empty-chart-msg">📭 Complete scheduled sessions to track your study time!</div>
            ) : (
              <div className="chart-container">
                <div className="bar-chart">
                  {dailyMins.map((m, i) => (
                    <div key={i} className="bar-col">
                      <div className="bar-value">{m > 0 ? formatMinutes(m) : ""}</div>
                      <div className="bar-fill" style={{ height: `${Math.max(4, (m / maxMins) * 100)}%` }}></div>
                      <div className="bar-label">{getDayLabel(dayKeys[i])}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Subject Breakdown */}
          {subjectData.length > 0 && (
            <div className="card-subsection">
              <h3 className="card-subheading">📚 Subject Breakdown</h3>
              <div className="subjects-grid">
                {subjectData.map(([subj, mins], i) => {
                  const colors = ["#4f7cff","#06d6a0","#ffd166","#ff6b6b","#ce93d8","#f48fb1"];
                  return (
                    <div key={subj} className="subject-card" style={{ borderLeftColor: colors[i % colors.length] }}>
                      <div className="subject-name">{subj}</div>
                      <div className="subject-stat">{formatMinutes(mins)} studied</div>
                      <div className="subject-bar-wrap">
                        <div className="subject-bar" style={{ width: `${Math.min(100,(mins/Math.max(...subjectData.map(s=>s[1])))*100)}%`, background: colors[i % colors.length] }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="card-subsection">
            <h3 className="card-subheading">🏅 Badges — {earnedCount}/{BADGE_DEFS.length} earned</h3>
            <div className="badges-grid">
              {badges.map(b => (
                <div key={b.id} className={`badge-card ${b.earned ? "badge-earned" : "badge-locked"}`}>
                  <div className="badge-icon">{b.earned ? b.icon : "🔒"}</div>
                  <div className="badge-label">{b.label}</div>
                  <div className="badge-desc">{b.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity counts */}
          <div className="card-subsection">
            <h3 className="card-subheading">📋 Activity Summary</h3>
            <div className="activity-grid">
              {[
                ["🎯","Quizzes Done",     stats.quizzesCompleted || 0],
                ["📅","Sessions Done",    stats.sessionsCompleted || 0],
                ["✏️","Simplify Used",    stats.simplifiesUsed || 0],
                ["🎮","Games Played",     stats.gamesPlayed || 0],
                ["📖","Stories Read",     stats.storiesRead || 0],
                ["📆","Days Used",        stats.totalDaysUsed || 0],
              ].map(([icon, label, val]) => (
                <div key={label} className="activity-item">
                  <div className="activity-icon">{icon}</div>
                  <div className="activity-val">{val}</div>
                  <div className="activity-label">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="actions-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={generateReport}>📥 Download Report</button>
            <button className="btn-ghost" onClick={() => setShowResetConfirm(true)}>🔄 Reset Stats</button>
          </div>
          {showResetConfirm && (
            <div className="reset-confirm">
              ⚠️ This will clear all your progress data. Are you sure?
              <button className="btn-secondary btn-sm" style={{marginLeft:10}} onClick={resetStats}>Yes, Reset</button>
              <button className="btn-ghost btn-sm" style={{marginLeft:6}} onClick={() => setShowResetConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* ── Parent View ── */}
      {view === "parent" && (
        <div className="report-view">
          <div className="report-welcome">
            <h3>👪 Parent View</h3>
            <p className="card-subtitle">Track your child's learning progress and achievements.</p>
          </div>
          <div className="stats-grid">
            <div className="stat-card stat-points"><div className="stat-icon">⭐</div><div className="stat-value">{stats.points||0}</div><div className="stat-label">Points</div></div>
            <div className="stat-card stat-streak"><div className="stat-icon">🔥</div><div className="stat-value">{stats.streak||0}</div><div className="stat-label">Streak</div></div>
            <div className="stat-card stat-time"><div className="stat-icon">⏰</div><div className="stat-value">{totalStudyTime}</div><div className="stat-label">Study Time</div></div>
            <div className="stat-card stat-accuracy"><div className="stat-icon">🎯</div><div className="stat-value">{stats.quizzesCompleted||0}</div><div className="stat-label">Quizzes</div></div>
          </div>
          <div className="report-summary-card">
            <h4>📋 Weekly Summary</h4>
            {stats.totalDaysUsed > 0 ? (
              <>
                <p>Your child has used MindBloom on <strong>{stats.totalDaysUsed} day{stats.totalDaysUsed > 1 ? "s" : ""}</strong> and earned <strong>{stats.points} points</strong> total.</p>
                <p>They completed <strong>{stats.quizzesCompleted} quiz question{stats.quizzesCompleted !== 1 ? "s" : ""}</strong> and finished <strong>{stats.sessionsCompleted} study session{stats.sessionsCompleted !== 1 ? "s" : ""}</strong>.</p>
                <p>Current streak: <strong>{stats.streak} day{stats.streak !== 1 ? "s" : ""}</strong>. {stats.streak >= 3 ? "Excellent consistency! 🌟" : "Encourage them to study daily to build their streak!"}</p>
              </>
            ) : (
              <p>No activity yet! Encourage your child to start their first study session. 🚀</p>
            )}
          </div>
          <button className="btn-primary" onClick={generateReport}>📥 Download Full Report</button>
        </div>
      )}

      {/* ── Teacher View ── */}
      {view === "teacher" && (
        <div className="report-view">
          <div className="report-welcome">
            <h3>🎓 Teacher Insights</h3>
            <p className="card-subtitle">Detailed analytics to support your student.</p>
          </div>
          <div className="subjects-grid">
            {subjectData.length > 0 ? subjectData.map(([subj, mins]) => (
              <div key={subj} className="subject-card">
                <div className="subject-name">{subj}</div>
                <div className="subject-stat">{formatMinutes(mins)} studied</div>
                <div className="accuracy-bar">
                  <div className="accuracy-fill" style={{ width: `${Math.min(100,(mins/Math.max(...subjectData.map(s=>s[1])))*100)}%` }}></div>
                </div>
              </div>
            )) : (
              <div className="empty-chart-msg" style={{gridColumn:"1/-1"}}>No subject data yet — student needs to complete scheduled sessions.</div>
            )}
          </div>
          <div className="report-summary-card">
            <h4>🔍 Learning Analysis</h4>
            {stats.sessionsCompleted > 0 ? (
              <>
                <p>Student completed <strong>{stats.sessionsCompleted} sessions</strong> totalling <strong>{totalStudyTime}</strong> of focused study.</p>
                <p>Quiz engagement: <strong>{stats.quizzesCompleted} questions</strong> completed. Game-based learning: <strong>{stats.gamesPlayed} games</strong> played.</p>
                <p>{stats.streak >= 5 ? "Strong daily consistency — self-regulation skills are developing well." : "Encourage daily use to build consistent study habits."}</p>
              </>
            ) : (
              <p>Student has not yet completed any scheduled sessions. Encourage them to create and follow a study plan.</p>
            )}
          </div>
          <button className="btn-primary" onClick={sendMessage}>✉️ Message Support Team</button>
        </div>
      )}
    </div>
  );
}
