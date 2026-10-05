const { QUIZ_QUESTIONS } = await import(new URL("../questions.js", import.meta.url));

function fail(reason) {
  console.log(`FAIL: ${reason}`);
  process.exit(1);
}

const norm = (s) => String(s).trim().replace(/\s+/g, " ").toLowerCase();

if (!Array.isArray(QUIZ_QUESTIONS)) fail("QUIZ_QUESTIONS is not an array");
if (QUIZ_QUESTIONS.length !== 50) fail(`expected 50 questions, got ${QUIZ_QUESTIONS.length}`);

const seenStems = new Set();
const seenIds = new Set();
const blockCounts = { 1: 0, 2: 0 };
const typeCounts = {};
const posCounts = [0, 0, 0, 0];
const ALLOWED_TYPES = ["date", "person", "event", "term"];

QUIZ_QUESTIONS.forEach((item, i) => {
  const n = i + 1;
  if (typeof item !== "object" || item === null) fail(`question #${n} is not an object`);
  if (typeof item.id !== "number" || seenIds.has(item.id)) fail(`duplicate or invalid id at question #${n}`);
  seenIds.add(item.id);
  if (typeof item.q !== "string" || item.q.trim() === "") fail(`empty stem at question #${n}`);
  if (!item.q.trim().endsWith("?")) fail(`stem does not end with '?' at question #${n}`);
  const key = norm(item.q);
  if (seenStems.has(key)) fail(`duplicate question #${n}`);
  seenStems.add(key);
  if (!Array.isArray(item.options) || item.options.length !== 4) fail(`options.length !== 4 at question #${n}`);
  const optKeys = new Set();
  for (const o of item.options) {
    if (typeof o !== "string" || o.trim() === "") fail(`empty option at question #${n}`);
    const k = norm(o);
    if (optKeys.has(k)) fail(`duplicate options at question #${n}`);
    optKeys.add(k);
  }
  if (!Number.isInteger(item.correct) || item.correct < 0 || item.correct > 3) fail(`invalid correct at question #${n}`);
  if (item.block !== 1 && item.block !== 2) fail(`invalid block at question #${n}`);
  blockCounts[item.block]++;
  if (!ALLOWED_TYPES.includes(item.type)) fail(`invalid type at question #${n}`);
  typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
  posCounts[item.correct]++;
});

if (blockCounts[1] < 15) fail(`block 1 has ${blockCounts[1]} questions, need >= 15`);
if (blockCounts[2] < 15) fail(`block 2 has ${blockCounts[2]} questions, need >= 15`);
if (Object.keys(typeCounts).length < 4) fail(`only ${Object.keys(typeCounts).length} distinct types, need >= 4`);
posCounts.forEach((c, p) => {
  if (c < 8 || c > 17) fail(`correct position ${p} appears ${c} times, need 8-17`);
});

function templateOf(q) {
  const s = norm(q);
  if (s.startsWith("коли")) return "коли";
  if (s.startsWith("хто")) return "хто";
  if (s.startsWith("що сталося в")) return "що сталося в";
  if (s.startsWith("що")) return "що";
  if (s.startsWith("яка подія")) return "яка подія";
  if (s.startsWith("оберіть правильне твердження")) return "оберіть правильне твердження";
  if (s.startsWith("ким був") || s.startsWith("ким була") || s.startsWith("ким були")) return "ким був/була";
  if (s.startsWith("правильне твердження про")) return "правильне твердження про";
  return null;
}
const templates = new Set();
QUIZ_QUESTIONS.forEach((item) => {
  const t = templateOf(item.q);
  if (t) templates.add(t);
});
if (templates.size < 8) fail(`only ${templates.size} distinct templates, need >= 8`);

const ANCHORS = [
  "королеве", "киїк-коба", "мізин", "межиріч", "трипіль",
  "кіммері", "скіф", "сармат", "ольвія", "херсонес",
  "олег", "ольга", "святослав", "володимир", "ярослав",
  "руська правда", "софійськ", "любець", "мономах", "1187",
  "1240", "батий", "пантікапей", "тіра", "десятин",
  "печеніг", "златник", "ігор", "882", "988",
  "християн", "погост", "урок", "неандерталь", "кроманьйон",
  "мезоліт", "неоліт", "енеоліт", "мстислав", "пектораль",
  "товста могила", "велика скіфія", "гомер"
];
let anchored = 0;
QUIZ_QUESTIONS.forEach((item) => {
  const text = norm(item.q + " " + item.options.join(" "));
  if (ANCHORS.some((a) => text.includes(a))) anchored++;
});
if (anchored < 45) fail(`only ${anchored}/50 questions contain anchor keywords, need >= 45`);

console.log("OK: 50 questions valid");
