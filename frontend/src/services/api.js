const SESSION_KEY = "ielts_auth_session";

function getToken() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return session?.access_token || null;
  } catch {
    return null;
  }
}

function messageFromDetail(data, fallback) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (d && typeof d.msg === "string" ? d.msg : JSON.stringify(d)))
      .join(", ");
  }
  return fallback;
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    const isCredentialsRequest = path === "/auth/login" || path === "/auth/register";
    if (isCredentialsRequest) {
      throw new Error(messageFromDetail(data, "Invalid email or password"));
    }
    if (token) {
      localStorage.removeItem(SESSION_KEY);
      window.location.reload();
      throw new Error("Session expired");
    }
    throw new Error(messageFromDetail(data, "Unauthorized"));
  }

  if (!res.ok) {
    throw new Error(messageFromDetail(data, `Request failed: ${res.status}`));
  }
  return data;
}

export async function loginUser(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(email, password) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function generateSession({ skill = "reading", topic = null, writing_task_type = null }) {
  const body = { skill, topic: topic || null };
  if (writing_task_type) body.writing_task_type = writing_task_type;
  return request("/practice/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function submitAnswers(sessionId, answers) {
  return request("/practice/submit", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, answers }),
  });
}

export async function submitWriting(sessionId, essayText) {
  return request("/practice/submit-writing", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, essay_text: essayText }),
  });
}

export async function submitSpeakingJson(sessionId, transcript) {
  return request("/practice/submit-speaking-json", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, transcript }),
  });
}

export async function submitSpeakingForm(sessionId, audioBlob, transcript) {
  const token = getToken();
  const form = new FormData();
  form.append("session_id", sessionId);
  if (transcript?.trim()) form.append("transcript", transcript.trim());
  if (audioBlob) form.append("audio", audioBlob, "recording.webm");
  const res = await fetch("/api/practice/submit-speaking", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
    throw new Error("Session expired");
  }
  if (!res.ok) {
    throw new Error(messageFromDetail(data, `Submit failed: ${res.status}`));
  }
  return data;
}

export async function fetchListeningTts(sessionId) {
  const token = getToken();
  const res = await fetch("/api/listening/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ session_id: sessionId }),
  });
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(messageFromDetail(data, `TTS failed: ${res.status}`));
  }
  if (!ct.includes("audio") && !ct.includes("octet-stream")) {
    const t = await res.text();
    throw new Error(t || "Unexpected TTS response");
  }
  return res.blob();
}

export async function fetchProgress(skill = null) {
  const q = skill ? `?skill=${encodeURIComponent(skill)}` : "";
  return request(`/progress${q}`);
}

export async function fetchResultDetail(resultId) {
  return request(`/results/${resultId}`);
}
