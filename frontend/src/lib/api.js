const DEFAULT_BASE = "http://localhost:8000";

export function getApiBase() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE;
}

export async function apiFetch(path, options) {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.error ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

