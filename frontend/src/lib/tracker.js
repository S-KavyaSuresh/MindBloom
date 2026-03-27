/**
 * Activity tracker — writes live stats to localStorage.
 * Import from here, NOT from Dashboard.jsx
 */

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getLast7DayKeys() {
  const keys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

export function getDayLabel(isoKey) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return days[new Date(isoKey + "T12:00:00").getDay()];
}

export function loadStats() {
  try {
    const raw = localStorage.getItem("mindbloom_stats");
    const base = {
      points: 0, streak: 0, quizzesCompleted: 0, sessionsCompleted: 0,
      simplifiesUsed: 0, gamesPlayed: 0, storiesRead: 0, totalDaysUsed: 0,
      totalMinutes: 0, subjectMinutes: {}, dailyPoints: {}, dailyMinutes: {},
      lastActive: null,
    };
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw) };
  } catch { return {}; }
}

export function saveStats(stats) {
  try { localStorage.setItem("mindbloom_stats", JSON.stringify(stats)); } catch {}
}

export function recordActivity(type, payload = {}) {
  const stats = loadStats();
  const today = getTodayKey();

  if (!stats.dailyPoints)  stats.dailyPoints  = {};
  if (!stats.dailyMinutes) stats.dailyMinutes = {};
  if (!stats.subjectMinutes) stats.subjectMinutes = {};

  if (stats.lastActive !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);
    stats.streak       = stats.lastActive === yKey ? (stats.streak || 0) + 1 : 1;
    stats.lastActive   = today;
    stats.totalDaysUsed = (stats.totalDaysUsed || 0) + 1;
  }

  if (type === "points") {
    const pts = payload.amount || 0;
    stats.points = (stats.points || 0) + pts;
    stats.dailyPoints[today] = (stats.dailyPoints[today] || 0) + pts;
  }
  if (type === "quiz") {
    stats.quizzesCompleted = (stats.quizzesCompleted || 0) + 1;
    stats.points = (stats.points || 0) + 10;
    stats.dailyPoints[today] = (stats.dailyPoints[today] || 0) + 10;
  }
  if (type === "session_complete") {
    stats.sessionsCompleted = (stats.sessionsCompleted || 0) + 1;
    const mins = payload.minutes || 25;
    stats.totalMinutes = (stats.totalMinutes || 0) + mins;
    stats.dailyMinutes[today] = (stats.dailyMinutes[today] || 0) + mins;
    const subj = payload.subject;
    if (subj) stats.subjectMinutes[subj] = (stats.subjectMinutes[subj] || 0) + mins;
  }
  if (type === "simplify") {
    stats.simplifiesUsed = (stats.simplifiesUsed || 0) + 1;
    stats.points = (stats.points || 0) + 5;
    stats.dailyPoints[today] = (stats.dailyPoints[today] || 0) + 5;
  }
  if (type === "game") {
    stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
    stats.points = (stats.points || 0) + 3;
    stats.dailyPoints[today] = (stats.dailyPoints[today] || 0) + 3;
  }
  if (type === "story") {
    stats.storiesRead = (stats.storiesRead || 0) + 1;
    stats.points = (stats.points || 0) + 2;
    stats.dailyPoints[today] = (stats.dailyPoints[today] || 0) + 2;
  }

  saveStats(stats);
}
