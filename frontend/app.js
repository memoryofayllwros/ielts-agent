'use strict';

// ===== Auth State =====
let authToken = localStorage.getItem('ielts_token') || null;
let authUser = JSON.parse(localStorage.getItem('ielts_user') || 'null');

function saveAuth(data) {
  authToken = data.access_token;
  authUser = { id: data.user_id, username: data.username, email: data.email };
  localStorage.setItem('ielts_token', authToken);
  localStorage.setItem('ielts_user', JSON.stringify(authUser));
}

function clearAuth() {
  authToken = null;
  authUser = null;
  localStorage.removeItem('ielts_token');
  localStorage.removeItem('ielts_user');
}

// Fetch wrapper that adds Authorization header
async function authFetch(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearAuth();
    showAuthOverlay();
    throw new Error('Session expired — please sign in again');
  }
  return res;
}

// ===== Auth Overlay =====
function showAuthOverlay() {
  document.getElementById('auth-overlay').classList.remove('hidden');
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').classList.add('hidden');
}

function switchAuthTab(tab) {
  const isSignIn = tab === 'signin';
  document.getElementById('form-signin').classList.toggle('hidden', !isSignIn);
  document.getElementById('form-signup').classList.toggle('hidden', isSignIn);
  document.getElementById('tab-signin-btn').classList.toggle('active', isSignIn);
  document.getElementById('tab-signup-btn').classList.toggle('active', !isSignIn);
  document.getElementById('signin-error').classList.add('hidden');
  document.getElementById('signup-error').classList.add('hidden');
}

async function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value;
  const errEl = document.getElementById('signin-error');
  const btn = document.getElementById('btn-signin');

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Sign in failed');
    saveAuth(data);
    onAuthSuccess();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function handleSignUp(e) {
  e.preventDefault();
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl = document.getElementById('signup-error');
  const btn = document.getElementById('btn-signup');

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Registration failed');
    saveAuth(data);
    onAuthSuccess();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

function onAuthSuccess() {
  hideAuthOverlay();
  document.getElementById('user-name').textContent = authUser.username;
}

function logout() {
  clearAuth();
  currentSession = null;
  showPanel('generate');
  showAuthOverlay();
}

// ===== Init =====
(function init() {
  if (authToken && authUser) {
    hideAuthOverlay();
    document.getElementById('user-name').textContent = authUser.username;
  } else {
    showAuthOverlay();
  }
})();

// ===== Practice State =====
let currentSession = null;

// ===== Tab Navigation =====
function showTab(tab) {
  document.getElementById('tab-practice').classList.toggle('hidden', tab !== 'practice');
  document.getElementById('tab-progress').classList.toggle('hidden', tab !== 'progress');
  document.getElementById('nav-practice').classList.toggle('active', tab === 'practice');
  document.getElementById('nav-progress').classList.toggle('active', tab === 'progress');
  if (tab === 'progress') { showProgressView('list'); loadProgress(); }
}

// ===== Generate Session =====
async function generateSession() {
  const topic = document.getElementById('topic-input').value.trim();
  const errorEl = document.getElementById('generate-error');

  showPanel('loading');
  errorEl.classList.add('hidden');

  try {
    const res = await authFetch('/api/practice/generate', {
      method: 'POST',
      body: JSON.stringify({ topic: topic || null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }
    currentSession = await res.json();
    renderSession(currentSession);
    showPanel('questions');
  } catch (err) {
    showPanel('generate');
    errorEl.textContent = `Error: ${err.message}`;
    errorEl.classList.remove('hidden');
  }
}

// ===== Render Practice Session =====
function renderSession(session) {
  document.getElementById('session-topic').textContent = session.topic;
  document.getElementById('passage-text').textContent = session.passage;

  const container = document.getElementById('questions-container');
  container.innerHTML = '';
  session.questions.forEach((q, idx) => container.appendChild(renderQuestion(q, idx + 1)));
  updateSubmitButton();
}

function renderQuestion(q, num) {
  const el = document.createElement('div');
  el.className = 'question-card';
  el.id = `question-card-${q.id}`;

  const typeLabel = {
    fill_in_blanks: 'Fill in the Blanks',
    mc_single: 'Multiple Choice · Single Answer',
    mc_multiple: 'Multiple Choice · Multiple Answers',
  }[q.type] || q.type;

  const typeBadgeClass = {
    fill_in_blanks: 'badge-fib',
    mc_single: 'badge-mc-single',
    mc_multiple: 'badge-mc-multiple',
  }[q.type] || '';

  el.innerHTML = `
    <div class="question-number">Question ${num}</div>
    <span class="question-type-badge ${typeBadgeClass}">${typeLabel}</span>
    ${renderQuestionBody(q)}
  `;

  if (q.type === 'fill_in_blanks') {
    el.querySelectorAll('.blank-select').forEach(s => s.addEventListener('change', updateSubmitButton));
  } else {
    const options = el.querySelectorAll('.option-item');
    options.forEach(opt => opt.addEventListener('click', () => handleOptionClick(q, opt, options)));
  }

  return el;
}

function renderQuestionBody(q) {
  if (q.type === 'fill_in_blanks') return renderFIB(q);
  return renderMC(q, q.type === 'mc_multiple');
}

function renderFIB(q) {
  const bank = q.word_bank || [];
  let html = q.passage_with_blanks || '';

  html = html.replace(/\[(\d+)\]/g, (match, num) => {
    const options = bank.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join('');
    return `<select class="blank-select" data-blank="${num}" data-qid="${q.id}">
              <option value="">— select —</option>${options}
            </select>`;
  });

  const wordChips = bank.map(w => `<span class="word-chip">${escapeHtml(w)}</span>`).join('');

  return `
    <div class="question-instructions">Fill in each blank by selecting the correct word from the dropdown.</div>
    <div class="fib-passage">${html}</div>
    <div class="word-bank">
      <div class="word-bank-label">Word Bank</div>
      <div class="word-bank-words">${wordChips}</div>
    </div>
  `;
}

function renderMC(q, isMultiple) {
  const instruction = isMultiple ? 'Select TWO correct answers.' : 'Select the correct answer.';

  const items = (q.options || []).map(opt => {
    const match = opt.match(/^([A-E])\.\s*(.*)/s);
    const key = match ? match[1] : opt;
    const text = match ? match[2] : opt;
    return `
      <div class="option-item${isMultiple ? ' mc-multiple' : ''}" data-key="${key}" data-qid="${q.id}">
        <input type="${isMultiple ? 'checkbox' : 'radio'}" />
        <div class="option-marker">${key}</div>
        <div class="option-text">${escapeHtml(text)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="question-instructions">${instruction}</div>
    <div class="question-text">${escapeHtml(q.question || '')}</div>
    <div class="options-list">${items}</div>
  `;
}

function handleOptionClick(q, clicked, allOptions) {
  const isMultiple = q.type === 'mc_multiple';
  if (!isMultiple) {
    allOptions.forEach(o => o.classList.remove('selected'));
    clicked.classList.add('selected');
  } else {
    const isSelected = clicked.classList.contains('selected');
    if (!isSelected && Array.from(allOptions).filter(o => o.classList.contains('selected')).length >= 2) return;
    clicked.classList.toggle('selected');
  }
  updateSubmitButton();
}

// ===== Submit State =====
function getAnswers() {
  if (!currentSession) return {};
  const answers = {};
  for (const q of currentSession.questions) {
    if (q.type === 'fill_in_blanks') {
      const card = document.getElementById(`question-card-${q.id}`);
      answers[q.id] = card ? Array.from(card.querySelectorAll('.blank-select')).map(s => s.value) : [];
    } else {
      const card = document.getElementById(`question-card-${q.id}`);
      answers[q.id] = card ? Array.from(card.querySelectorAll('.option-item.selected')).map(o => o.dataset.key) : [];
    }
  }
  return answers;
}

function isAnswerComplete(q, answers) {
  const ans = answers[q.id] || [];
  if (q.type === 'fill_in_blanks') {
    const blanks = (q.passage_with_blanks || '').match(/\[\d+\]/g) || [];
    return ans.length === blanks.length && ans.every(a => a !== '');
  }
  if (q.type === 'mc_single') return ans.length === 1;
  if (q.type === 'mc_multiple') return ans.length === 2;
  return false;
}

function updateSubmitButton() {
  if (!currentSession) return;
  const answers = getAnswers();
  const allDone = currentSession.questions.every(q => isAnswerComplete(q, answers));
  const btn = document.getElementById('btn-submit');
  document.getElementById('submit-hint').textContent = allDone
    ? 'All questions answered. Ready to submit!'
    : 'Answer all questions before submitting.';
  btn.disabled = !allDone;
}

// ===== Submit Answers =====
async function submitAnswers() {
  const answers = getAnswers();
  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  btn.textContent = 'Grading…';

  try {
    const res = await authFetch('/api/practice/submit', {
      method: 'POST',
      body: JSON.stringify({ session_id: currentSession.session_id, answers }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }
    renderResults(await res.json());
    showPanel('results');
  } catch (err) {
    alert(`Submission failed: ${err.message}`);
    btn.disabled = false;
    btn.textContent = 'Submit Answers';
  }
}

// ===== Render Results =====
function renderResults(result) {
  const pct = Math.round(result.percentage);
  document.getElementById('score-pct').textContent = `${pct}%`;
  document.getElementById('score-circle').className = 'score-circle ' + scoreClass(pct);
  document.getElementById('result-topic').textContent = result.topic;
  document.getElementById('score-breakdown').textContent = `${result.total_score} / ${result.max_score} points`;

  const container = document.getElementById('results-container');
  container.innerHTML = '';
  result.question_results.forEach((qr, idx) => container.appendChild(renderResultCard(qr, idx + 1)));
}

function renderResultCard(qr, num) {
  const isCorrect = qr.earned === qr.max;
  const isPartial = qr.earned > 0 && qr.earned < qr.max;
  const statusClass = isCorrect ? 'correct' : (isPartial ? 'partial' : 'incorrect');
  const icon = isCorrect ? '✓' : (isPartial ? '◑' : '✗');
  const statusText = isCorrect ? 'Correct' : (isPartial ? 'Partially Correct' : 'Incorrect');

  const correctChips = qr.correct_answers.map(a =>
    `<span class="answer-chip correct-answer">${escapeHtml(a)}</span>`
  ).join('');

  const userChips = qr.user_answers.length
    ? qr.user_answers.map(a => {
        const isRight = qr.correct_answers.some(c => c.trim().toLowerCase() === a.trim().toLowerCase());
        return `<span class="answer-chip ${isRight ? 'user-correct' : 'user-wrong'}">${escapeHtml(a)}</span>`;
      }).join('')
    : '<span class="answer-chip user-wrong">(no answer)</span>';

  let questionDisplay = '';
  if (qr.type === 'fill_in_blanks' && qr.passage_with_blanks) {
    questionDisplay = `<div class="result-section">
      <div class="result-section-label">Fill in the Blanks</div>
      <div style="font-size:14px;color:#374151;line-height:1.8">${escapeHtml(qr.passage_with_blanks)}</div>
    </div>`;
  } else if (qr.question_text) {
    questionDisplay = `<div class="result-section">
      <div class="result-section-label">Question ${num}</div>
      <div style="font-size:15px;font-weight:600;color:#111827">${escapeHtml(qr.question_text)}</div>
    </div>`;
  }

  const el = document.createElement('div');
  el.className = 'result-card';
  el.innerHTML = `
    <div class="result-card-header ${statusClass}">
      <div class="result-status"><span class="status-icon">${icon}</span>${statusText}</div>
      <div class="result-score">${qr.earned} / ${qr.max} pts</div>
    </div>
    <div class="result-card-body">
      ${questionDisplay}
      <div class="result-section">
        <div class="result-section-label">Your Answer</div>
        <div class="result-answers">${userChips}</div>
      </div>
      <div class="result-section">
        <div class="result-section-label">Correct Answer</div>
        <div class="result-answers">${correctChips}</div>
      </div>
      <div class="result-section">
        <div class="result-section-label">Explanation</div>
        <div class="result-explanation">${escapeHtml(qr.explanation)}</div>
      </div>
    </div>
  `;
  return el;
}

// ===== Progress =====
async function loadProgress() {
  try {
    const res = await authFetch('/api/progress');
    if (!res.ok) throw new Error('Failed to load progress');
    renderProgress(await res.json());
  } catch (err) {
    console.error('Progress load error:', err);
  }
}

function renderProgress(data) {
  const isEmpty = data.entries.length === 0;
  document.getElementById('progress-empty').classList.toggle('hidden', !isEmpty);
  document.getElementById('progress-table-wrap').classList.toggle('hidden', isEmpty);
  document.getElementById('progress-stats').classList.toggle('hidden', isEmpty);
  if (isEmpty) return;

  document.getElementById('stat-sessions').textContent = data.total_sessions;
  document.getElementById('stat-average').textContent = `${Math.round(data.average_percentage)}%`;

  const tbody = document.getElementById('progress-tbody');
  tbody.innerHTML = '';
  data.entries.forEach(entry => {
    const pct = Math.round(entry.percentage);
    const date = new Date(entry.completed_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#6b7280;font-size:13px">${date}</td>
      <td style="font-weight:500">${escapeHtml(entry.topic)}</td>
      <td>${entry.total_score} / ${entry.max_score}</td>
      <td>
        <span class="pct-badge ${pctClass(pct)}">${pct}%</span>
        <div class="bar-wrap" style="margin-top:6px">
          <div class="bar-fill" style="width:${pct}%;background:${barColor(pct)}"></div>
        </div>
      </td>
      <td><button class="btn-outline btn-sm" onclick="openReview('${entry.id}')">Review</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== Review =====
function showProgressView(view) {
  document.getElementById('progress-list-view').classList.toggle('hidden', view !== 'list');
  document.getElementById('progress-review-view').classList.toggle('hidden', view !== 'review');
}

async function openReview(resultId) {
  showProgressView('review');
  document.getElementById('review-loading').classList.remove('hidden');
  document.getElementById('review-passage-card').classList.add('hidden');
  document.getElementById('review-questions-container').innerHTML = '';
  document.getElementById('review-topic').textContent = '';
  document.getElementById('review-meta').textContent = '';
  document.getElementById('review-score-pill').textContent = '';

  try {
    const res = await authFetch(`/api/results/${resultId}`);
    if (!res.ok) throw new Error('Failed to load result');
    renderReview(await res.json());
  } catch (err) {
    document.getElementById('review-questions-container').innerHTML =
      `<div class="card"><p style="color:var(--red)">Error: ${escapeHtml(err.message)}</p></div>`;
  } finally {
    document.getElementById('review-loading').classList.add('hidden');
  }
}

function renderReview(data) {
  const pct = Math.round(data.percentage);
  const date = new Date(data.completed_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  document.getElementById('review-topic').textContent = data.topic;
  document.getElementById('review-meta').textContent = `${date} · ${data.total_score} / ${data.max_score} pts`;

  const pill = document.getElementById('review-score-pill');
  pill.textContent = `${pct}%`;
  pill.className = `score-pill pct-badge ${pctClass(pct)}`;

  if (data.passage) {
    document.getElementById('review-passage-text').textContent = data.passage;
    document.getElementById('review-passage-card').classList.remove('hidden');
  }

  const container = document.getElementById('review-questions-container');
  container.innerHTML = '';
  data.question_results.forEach((qr, idx) => container.appendChild(renderResultCard(qr, idx + 1)));
}

// ===== Helpers =====
function showPanel(name) {
  ['generate', 'loading', 'questions', 'results'].forEach(p => {
    const el = document.getElementById(`panel-${p}`);
    if (el) el.classList.toggle('hidden', p !== name);
  });
}

function resetSession() {
  currentSession = null;
  document.getElementById('topic-input').value = '';
  document.getElementById('generate-error').classList.add('hidden');
  showPanel('generate');
}

function scoreClass(pct) {
  if (pct >= 80) return 'score-excellent';
  if (pct >= 60) return 'score-good';
  if (pct >= 40) return 'score-ok';
  return 'score-poor';
}

function pctClass(pct) {
  if (pct >= 80) return 'pct-excellent';
  if (pct >= 60) return 'pct-good';
  if (pct >= 40) return 'pct-ok';
  return 'pct-poor';
}

function barColor(pct) {
  if (pct >= 80) return '#16a34a';
  if (pct >= 60) return '#2563eb';
  if (pct >= 40) return '#ea580c';
  return '#dc2626';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
