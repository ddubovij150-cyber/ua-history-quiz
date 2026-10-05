// ua-history-quiz — quiz engine: home → quiz → final, batches of 4, 5s auto-advance, 12-grade scale.
import { QUIZ_QUESTIONS } from './questions.js';

const BATCH_SIZE = 4;
const COUNTDOWN_MS = 5000;
const SHUFFLE_MAX_ATTEMPTS = 3;
const ORDER_KEY = 'quiz_order_prev';

const elements = {
  home: document.getElementById('screen-home'),
  quiz: document.getElementById('screen-quiz'),
  final: document.getElementById('screen-final'),
  start: document.getElementById('btn-start'),
  restart: document.getElementById('btn-restart'),
  back: document.getElementById('btn-back'),
  next: document.getElementById('btn-next'),
  grid: document.getElementById('quiz-grid'),
  hudScore: document.getElementById('hud-score'),
  hudGrade: document.getElementById('hud-grade'),
  countdown: document.getElementById('countdown'),
  finalResult: document.getElementById('final-result'),
};

const state = {
  screen: 'home',
  order: [],
  answers: new Map(), // question id → { chosen, isCorrect }
  batchIndex: 0,
  maxBatch: 0, // furthest batch reached (the frontier)
  countdownTimer: null,
  countdownTicker: null,
};

// --- Data validation (invalid QUIZ_QUESTIONS → visible error, no crash) ---

function validateQuestions(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return 'список питань порожній або не є масивом';
  }
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const ok =
      item &&
      typeof item.q === 'string' &&
      item.q.length > 0 &&
      Array.isArray(item.options) &&
      item.options.length === 4 &&
      item.options.every((o) => typeof o === 'string' && o.length > 0) &&
      Number.isInteger(item.correct) &&
      item.correct >= 0 &&
      item.correct <= 3;
    if (!ok) return `некоректне питання №${i + 1}`;
  }
  return null;
}

function showFatalError(message) {
  const existing = document.getElementById('data-error');
  if (existing) existing.remove();
  const el = document.createElement('p');
  el.id = 'data-error';
  el.setAttribute('role', 'alert');
  el.textContent = `Помилка даних тесту: ${message}. Оновіть сторінку.`;
  elements.home.appendChild(el);
  elements.start.disabled = true;
}

// --- Shuffle with sessionStorage signature guard ---

function fisherYates(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function orderSignature(order) {
  return order.map((q) => q.id).join(',');
}

function buildOrder() {
  let prev = null;
  try {
    prev = sessionStorage.getItem(ORDER_KEY);
  } catch {
    prev = null;
  }
  let order = fisherYates(QUIZ_QUESTIONS);
  // Guard: if the new order equals the previous session order → reshuffle, max 3 attempts total.
  for (let attempt = 1; attempt < SHUFFLE_MAX_ATTEMPTS; attempt++) {
    if (prev === null || orderSignature(order) !== prev) break;
    order = fisherYates(QUIZ_QUESTIONS);
  }
  try {
    sessionStorage.setItem(ORDER_KEY, orderSignature(order));
  } catch {
    /* sessionStorage unavailable — shuffle still applies for this load */
  }
  return order;
}

// --- 12-point scale from percent of total (correct/total) ---

function gradeFromPercent(pct) {
  if (pct >= 100) return 12;
  if (pct >= 90) return 11;
  if (pct >= 80) return 10;
  if (pct >= 75) return 9;
  if (pct >= 70) return 8;
  if (pct >= 65) return 7;
  if (pct >= 60) return 6;
  if (pct >= 55) return 5;
  if (pct >= 50) return 4;
  if (pct >= 40) return 3;
  if (pct >= 20) return 2;
  return 1;
}

// --- Batches ---

function batchCount() {
  return Math.ceil(state.order.length / BATCH_SIZE);
}

function batchQuestions(index) {
  const start = index * BATCH_SIZE;
  return state.order.slice(start, start + BATCH_SIZE);
}

function isBatchComplete(index) {
  return batchQuestions(index).every((q) => state.answers.has(q.id));
}

// --- Screens ---

function showScreen(name) {
  elements.home.hidden = name !== 'home';
  elements.quiz.hidden = name !== 'quiz';
  elements.final.hidden = name !== 'final';
  state.screen = name;
}

// --- HUD + nav buttons ---

function countCorrect() {
  let n = 0;
  for (const ans of state.answers.values()) if (ans.isCorrect) n++;
  return n;
}

function updateHud() {
  const total = state.order.length;
  const answered = state.answers.size;
  const correct = countCorrect();
  elements.hudScore.textContent = `Правильно: ${correct}/${total}`;
  if (answered < total) {
    elements.hudGrade.textContent = 'Поточна оцінка: —';
  } else {
    const pct = Math.round((correct / total) * 100);
    elements.hudGrade.textContent = `Поточна оцінка: ${gradeFromPercent(pct)}`;
  }
  const canGoForward =
    state.batchIndex < state.maxBatch ||
    (state.batchIndex === state.maxBatch && isBatchComplete(state.batchIndex));
  elements.next.disabled = !canGoForward;
  elements.back.disabled = state.batchIndex === 0;
}

// --- Render ---

function revealBatch() {
  // Idempotent: make sure every answered card in the current batch shows its reveal state.
  const cards = elements.grid.querySelectorAll('.question-card');
  cards.forEach((card, i) => {
    const q = batchQuestions(state.batchIndex)[i];
    const ans = state.answers.get(q.id);
    if (!ans) return;
    const buttons = card.querySelectorAll('.options button');
    buttons.forEach((btn, idx) => {
      if (idx === q.correct) {
        btn.classList.add('correct');
        if (!ans.isCorrect) btn.classList.add('reveal');
      }
    });
  });
}

function onAnswer(question, optionIndex, button) {
  if (state.answers.has(question.id)) return; // locked — no re-click
  const isCorrect = optionIndex === question.correct;
  state.answers.set(question.id, { chosen: optionIndex, isCorrect });

  const card = button.closest('.question-card');
  card.querySelectorAll('.options button').forEach((b) => {
    b.disabled = true;
  });
  if (isCorrect) {
    button.classList.add('correct');
  } else {
    button.classList.add('wrong');
    const correctButton = card.querySelectorAll('.options button')[question.correct];
    correctButton.classList.add('correct', 'reveal');
  }

  updateHud();

  if (isBatchComplete(state.batchIndex)) {
    revealBatch();
    if (state.batchIndex === state.maxBatch) {
      startCountdown();
    }
  }
}

function renderBatch() {
  const fragment = document.createDocumentFragment();
  for (const q of batchQuestions(state.batchIndex)) {
    const card = document.createElement('div');
    card.className = 'question-card';

    const text = document.createElement('p');
    text.className = 'q-text';
    text.textContent = q.q;

    const options = document.createElement('div');
    options.className = 'options';
    q.options.forEach((label, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${'ABCD'[idx]}. ${label}`;
      const ans = state.answers.get(q.id);
      if (ans) {
        btn.disabled = true;
        if (idx === q.correct) {
          btn.classList.add('correct');
          if (!ans.isCorrect) btn.classList.add('reveal');
        } else if (idx === ans.chosen) {
          btn.classList.add('wrong');
        }
      }
      btn.addEventListener('click', () => onAnswer(q, idx, btn));
      options.appendChild(btn);
    });

    card.append(text, options);
    fragment.appendChild(card);
  }
  elements.grid.replaceChildren(fragment);
  updateHud();
}

// --- Countdown 5…4…3…2…1 → auto-advance (COUNTDOWN_MS) ---

function cancelCountdown() {
  if (state.countdownTimer !== null) {
    clearTimeout(state.countdownTimer);
    state.countdownTimer = null;
  }
  if (state.countdownTicker !== null) {
    clearInterval(state.countdownTicker);
    state.countdownTicker = null;
  }
  elements.countdown.hidden = true;
  elements.countdown.textContent = '';
}

function startCountdown() {
  cancelCountdown();
  const startedAt = Date.now();
  elements.countdown.hidden = false;
  elements.countdown.textContent = '5';
  state.countdownTicker = setInterval(() => {
    const left = COUNTDOWN_MS - (Date.now() - startedAt);
    elements.countdown.textContent = String(Math.max(1, Math.ceil(left / 1000)));
  }, 200);
  state.countdownTimer = setTimeout(() => {
    cancelCountdown();
    advance();
  }, COUNTDOWN_MS);
}

function advance() {
  cancelCountdown();
  const next = state.batchIndex + 1;
  if (next >= batchCount()) {
    showFinal();
    return;
  }
  state.batchIndex = next;
  if (state.maxBatch < next) state.maxBatch = next;
  renderBatch();
  if (isBatchComplete(next) && state.batchIndex === state.maxBatch) {
    startCountdown();
  }
}

// --- Navigation ---

function goBack() {
  if (state.batchIndex === 0) return;
  cancelCountdown(); // countdown is cancelled on back
  state.batchIndex -= 1;
  renderBatch(); // review mode: reveals visible, score unchanged (answers map untouched)
}

function goNext() {
  if (state.batchIndex < state.maxBatch) {
    cancelCountdown();
    state.batchIndex += 1;
    renderBatch();
    // Returning forward to a fully-answered latest batch restarts the 5s countdown.
    if (state.batchIndex === state.maxBatch && isBatchComplete(state.batchIndex)) {
      startCountdown();
    }
  } else if (state.batchIndex === state.maxBatch && isBatchComplete(state.batchIndex)) {
    advance(); // «Далі» on the fully-answered frontier skips the waiting
  }
}

// --- Final screen ---

function showFinal() {
  cancelCountdown();
  const total = state.order.length;
  const correct = countCorrect();
  const pct = Math.round((correct / total) * 100);
  const grade = gradeFromPercent(pct);

  const heading = document.createElement('h2');
  heading.textContent = 'Тест завершено!';
  const scoreLine = document.createElement('p');
  scoreLine.textContent = `Правильних відповідей: ${correct}/${total} (${pct}%)`;
  const gradeLine = document.createElement('p');
  gradeLine.textContent = `Ваша оцінка: ${grade} з 12`;
  elements.finalResult.replaceChildren(heading, scoreLine, gradeLine);

  showScreen('final');
}

// --- Start / restart ---

function startQuiz() {
  cancelCountdown();
  state.answers.clear();
  state.batchIndex = 0;
  state.maxBatch = 0;
  showScreen('quiz');
  renderBatch();
}

function restartQuiz() {
  state.order = buildOrder(); // fresh shuffle for the next run
  startQuiz();
}

// --- Init ---

function init() {
  const error = validateQuestions(QUIZ_QUESTIONS);
  if (error) {
    showFatalError(error);
    return;
  }
  state.order = buildOrder(); // Fisher–Yates on every page load, guarded by sessionStorage
  elements.start.addEventListener('click', startQuiz);
  elements.restart.addEventListener('click', restartQuiz);
  elements.back.addEventListener('click', goBack);
  elements.next.addEventListener('click', goNext);
  showScreen('home');
}

try {
  init();
} catch (err) {
  showFatalError(err && err.message ? err.message : String(err));
}
