const SESSION_KEY = "ielts_auth_session";

function getToken() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return session?.access_token || null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
    throw new Error("Session expired");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `Request failed: ${res.status}`);
  }
  return data;
}

export async function loginUser(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(email, username, password) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
}

export async function generateSession(topic) {
  return request("/practice/generate", {
    method: "POST",
    body: JSON.stringify({ topic: topic || null }),
  });
}

export async function submitAnswers(sessionId, answers) {
  return request("/practice/submit", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, answers }),
  });
}

export async function fetchProgress() {
  return request("/progress");
}

export async function fetchResultDetail(resultId) {
  return request(`/results/${resultId}`);
}
