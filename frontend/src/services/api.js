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
  const isCredentialsRequest = path === "/auth/login" || path === "/auth/register";
  const token = isCredentialsRequest ? null : getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
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
  if (
    isCredentialsRequest &&
    res.ok &&
    (typeof data?.access_token !== "string" || !data.access_token)
  ) {
    throw new Error(
      "Unexpected response from server (missing token). Is the API proxy pointing at the backend on port 8000?)",
    );
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

/**
 * @returns {Promise<{
 *   user_id: string, email: string, username: string, display_name?: string|null,
 *   target_band?: number|null, target_reading?: number|null, target_listening?: number|null, target_writing?: number|null, target_speaking?: number|null,
 *   past_exam_band?: number|null, past_reading?: number|null, past_listening?: number|null, past_writing?: number|null, past_speaking?: number|null,
 *   past_exam_notes?: string|null
 * }>}
 */
export async function fetchUserProfile() {
  return request("/auth/me", { method: "GET" });
}

/** @param {Record<string, unknown>} body */
export async function updateUserProfile(body) {
  return request("/auth/me", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function generateSession({
  skill = "reading",
  topic = null,
  writing_task_type = null,
  use_adaptive = false,
  focus_skill = null,
  target_band = null,
}) {
  const body = { skill, topic: topic || null, use_adaptive };
  if (writing_task_type) body.writing_task_type = writing_task_type;
  if (focus_skill) body.focus_skill = focus_skill;
  if (target_band != null && target_band !== "") body.target_band = target_band;
  return request("/practice/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchDiagnosticStatus() {
  return request("/diagnostic/status", { method: "GET" });
}

export async function generateDiagnosticStep({ step, topic = null }) {
  return request("/diagnostic/generate", {
    method: "POST",
    body: JSON.stringify({ step, topic: topic || null }),
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

export async function fetchSkillMap(module) {
  return request(`/learning/skill-map?module=${encodeURIComponent(module)}`, { method: "GET" });
}

export async function fetchNextStep(module = "reading") {
  return request(`/learning/next-step?module=${encodeURIComponent(module)}`, { method: "GET" });
}

export async function fetchWeeklyReport() {
  return request("/learning/weekly-report", { method: "GET" });
}

/** @param {string|null} [module] reading|listening|writing|speaking */
export async function fetchLessons(module = null) {
  const q = module ? `?module=${encodeURIComponent(module)}` : "";
  return request(`/lessons${q}`);
}

/** @param {{ module?: string, max_steps?: number }} [opts] */
export async function fetchLessonCompilePlan(opts = {}) {
  const p = new URLSearchParams();
  if (opts.module) p.set("module", opts.module);
  if (opts.max_steps != null) p.set("max_steps", String(opts.max_steps));
  const q = p.toString() ? `?${p.toString()}` : "";
  return request(`/lessons/compile-plan${q}`);
}

/** @param {{ skill_id?: string, module?: string, lesson_kind?: string }} [opts] */
export async function requestLessonGenerate(opts = {}) {
  const body = {};
  if (opts.skill_id) body.skill_id = opts.skill_id;
  if (opts.module) body.module = opts.module;
  if (opts.lesson_kind) body.lesson_kind = opts.lesson_kind;
  return request("/lessons/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchLessonDetail(lessonId) {
  return request(`/lessons/${encodeURIComponent(lessonId)}`);
}

async function fetchLessonVideoUrl(urlPath) {
  const token = getToken();
  const path = urlPath.startsWith("/api") ? urlPath : `/api${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 && token) {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(messageFromDetail(data, `Video failed: ${res.status}`));
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("video") && !ct.includes("octet-stream")) {
    const t = await res.text();
    throw new Error(t || "Unexpected video response");
  }
  return res.blob();
}

export async function fetchLessonVideoBlob(lessonId) {
  return fetchLessonVideoUrl(`/lessons/${encodeURIComponent(lessonId)}/video`);
}

/** @param {number} clipIndex */
export async function fetchLessonClipVideoBlob(lessonId, clipIndex) {
  return fetchLessonVideoUrl(`/lessons/${encodeURIComponent(lessonId)}/clips/${clipIndex}/video`);
}

/** @param {string} lessonId @param {Record<string, string>} answers */
export async function submitLessonComprehension(lessonId, answers) {
  return request(`/lessons/${encodeURIComponent(lessonId)}/comprehension`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

/** @param {string} lessonId @param {string} transcript */
export async function submitLessonRoleplay(lessonId, transcript) {
  return request(`/lessons/${encodeURIComponent(lessonId)}/roleplay-submit`, {
    method: "POST",
    body: JSON.stringify({ transcript }),
  });
}

export async function fetchResultDetail(resultId) {
  return request(`/results/${resultId}`);
}

// ── Vocabulary level test ─────────────────────────────────────────────────────

export async function generateVocabTest(topic = null) {
  const q = topic ? `?topic=${encodeURIComponent(topic)}` : "";
  return request(`/vocab/generate${q}`, { method: "POST" });
}

export async function submitVocabAnswers(sessionId, answers) {
  return request("/vocab/submit", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, answers }),
  });
}

export async function fetchVocabHistory() {
  return request("/vocab/history");
}

export async function fetchVocabResultDetail(resultId) {
  return request(`/vocab/result/${resultId}`);
}
