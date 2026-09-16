import { createClient } from "npm:@supabase/supabase-js@2";

type AnyRow = Record<string, any>;
type Climate = { id: string; name: string; icon: string; guidance: string };

const CLIMATES: Climate[] = [
  { id: "tropical", name: "열대", icon: "🌴", guidance: "열대 우림의 기후 특징과 고상 가옥 등 생활 모습을 함께 설명해 보세요." },
  { id: "dry", name: "건조", icon: "🏜️", guidance: "오아시스와 점적 관개처럼 물을 이용하는 방법을 다시 설명해 보세요." },
  { id: "temperate", name: "온대", icon: "🌳", guidance: "계절 변화가 농업과 옷차림에 주는 영향을 연결해 보세요." },
  { id: "continental", name: "냉대", icon: "🌲", guidance: "침엽수림과 목재·펄프 산업의 관계를 다시 설명해 보세요." },
  { id: "polar", name: "한대", icon: "❄️", guidance: "매우 추운 환경에 적응한 의식주 생활을 다시 살펴보세요." },
  { id: "alpine", name: "고산", icon: "🏔️", guidance: "높이에 따른 기온 변화와 고산 지역 생활을 연결해 보세요." },
];

const DEFAULT_SETTINGS = {
  rankingEnabled: true, rankingLimit: 10, rankingMode: "best", nameMode: "nickname",
  questionCount: 11, regionCount: 4, bossCount: 3,
};

class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "ERROR", status = 400) { super(message); this.code = code; this.status = status; }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const secretKeys = parseKeyMap(Deno.env.get("SUPABASE_SECRET_KEYS"));
const publishableKeys = parseKeyMap(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
const serviceKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map((x) => x.trim());
  const allowOrigin = allowed.includes("*") || allowed.includes(origin) ? origin : allowed[0] || "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function respond(req: Request, payload: AnyRow, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return respond(req, { success: false, message: "POST 요청만 지원합니다." }, 405);
  try {
    if (!supabaseUrl || !serviceKey) throw new ApiError("Supabase 서버 환경 변수가 없습니다.", "SERVER_CONFIG", 500);
    if (!(await validClientKey(req.headers.get("apikey") || ""))) throw new ApiError("유효한 Supabase publishable key가 필요합니다.", "INVALID_API_KEY", 401);
    const body = await req.json();
    const action = String(body.action || "");
    let data: unknown;
    switch (action) {
      case "saveResult": data = await saveResult(body.result, body.responses || body.result?.responses || []); break;
      case "getRanking": data = await getRanking(body.className, body.gameSessionId); break;
      case "getPublicSettings": data = await getSettings(); break;
      case "verifyTeacherPin": data = await verifyTeacherPin(body.pin); break;
      case "getDashboard": await requireTeacher(body.token); data = await getDashboard(body.className); break;
      case "getStudentResult": await requireTeacher(body.token); data = await getStudentResult(body.gameSessionId); break;
      case "getClimateStats": await requireTeacher(body.token); data = await getClimateStats(body.className); break;
      case "getQuestionStats": await requireTeacher(body.token); data = await getQuestionStats(body.className); break;
      case "updateSettings": await requireTeacher(body.token); data = await updateSettings(body.settings); break;
      case "resetClassData": await requireTeacher(body.token); data = await resetClassData(body.className, body.confirmation); break;
      default: throw new ApiError("지원하지 않는 요청입니다.");
    }
    return respond(req, { success: true, data });
  } catch (error) {
    const e = error instanceof ApiError ? error : new ApiError(error instanceof Error ? error.message : String(error), "ERROR", 500);
    console.error(e.code, e.message);
    return respond(req, { success: false, message: e.message, code: e.code }, e.status);
  }
});

async function saveResult(input: AnyRow, responseInput: AnyRow[]) {
  if (!input?.gameSessionId) throw new ApiError("게임 세션 정보가 없습니다.");
  const responses = Array.isArray(responseInput) ? responseInput.slice(0, 100) : [];
  if (!responses.length) throw new ApiError("문제 응답 정보가 없습니다.");
  const settings = await getSettings();
  const result = normalizeResult(input, responses, settings);
  validateResult(result);

  const dbRow = toDbResult(result);
  const { error: insertError } = await supabase.from("results").insert(dbRow);
  if (insertError?.code === "23505") return { duplicate: true, gameSessionId: result.gameSessionId };
  if (insertError) throw new ApiError(`결과 저장 실패: ${insertError.message}`, "DB_ERROR", 500);

  const responseRows = responses.map((r) => ({
    game_session_id: result.gameSessionId,
    class_name: result.className,
    student_number: result.studentNumber,
    nickname: result.nickname,
    question_id: text(r.questionId, 50),
    climate: text(r.climate, 20),
    first_choice: text(r.firstChoice, 300),
    correct_answer: text(r.correctAnswer, 300),
    first_try: bool(r.firstTry),
    wrong_count: Math.max(0, num(r.wrongCount)),
  }));
  const { error: responseError } = await supabase.from("responses").insert(responseRows);
  if (responseError) {
    await supabase.from("results").delete().eq("game_session_id", result.gameSessionId);
    throw new ApiError(`응답 저장 실패: ${responseError.message}`, "DB_ERROR", 500);
  }
  return { duplicate: false, gameSessionId: result.gameSessionId };
}

function normalizeResult(input: AnyRow, responses: AnyRow[], settings: AnyRow) {
  const total = responses.length;
  const first = responses.filter((r) => bool(r.firstTry)).length;
  const wrong = responses.reduce((sum, r) => sum + Math.max(0, num(r.wrongCount)), 0);
  const climateNames = CLIMATES.map((c) => c.name);
  const visited = [...new Set(responses.map((r) => String(r.climate)).filter((x) => climateNames.includes(x)))];
  const climateScores: AnyRow = {};
  CLIMATES.forEach((c) => {
    const rows = responses.filter((r) => String(r.climate) === c.name);
    climateScores[c.id] = rows.length ? Math.round(rows.filter((r) => bool(r.firstTry)).length / rows.length * 100) : null;
  });
  const accuracy = Math.round(first / total * 1000) / 10;
  const bossComplete = responses.filter((r) => String(r.climate) === "종합").length >= Number(settings.bossCount || 3);
  const achievements = ["기후 코어 수호자", "세계 탐험가"];
  if (first >= 9) achievements.push("한 번에 척척");
  if (accuracy >= 80) achievements.push("기후 박사");
  if (num(input.remainingHp) >= 4) achievements.push("튼튼한 탐험가");
  if (wrong === 0) achievements.push("완벽한 관찰자");
  const result = {
    gameSessionId: text(input.gameSessionId, 100), className: text(input.className, 20),
    studentNumber: num(input.studentNumber), nickname: text(input.nickname, 30), character: text(input.character, 20),
    level: num(input.level), exp: num(input.exp), gold: num(input.gold), totalQuestions: total,
    firstTryCorrect: first, totalWrong: wrong, accuracy, playTime: Math.max(0, num(input.playTime)),
    visitedClimates: visited, climateScores, achievements, remainingHp: Math.max(0, Math.min(5, num(input.remainingHp))),
    bossComplete, completedAt: validDate(input.completedAt), explorationScore: 0,
  };
  result.explorationScore = calculateScore(result);
  return result;
}

function calculateScore(r: AnyRow) {
  const total = Math.max(1, num(r.totalQuestions));
  return Math.min(1000, Math.round(
    Math.max(0, Math.min(100, num(r.accuracy))) * 4 +
    Math.max(0, Math.min(total, num(r.firstTryCorrect))) / total * 200 +
    Math.max(0, Math.min(4, r.visitedClimates.length)) / 4 * 150 +
    (r.bossComplete ? 100 : 0) + Math.max(0, Math.min(5, r.achievements.length)) / 5 * 100 +
    Math.max(0, Math.min(5, num(r.remainingHp))) / 5 * 50
  ));
}

function validateResult(r: AnyRow) {
  if (!r.className) throw new ApiError("학급 정보가 없습니다.");
  if (!(r.studentNumber > 0 && r.studentNumber < 1000)) throw new ApiError("학생 번호가 올바르지 않습니다.");
  if (!r.nickname) throw new ApiError("별명이 없습니다.");
  if (!r.bossComplete || r.visitedClimates.length < 4) throw new ApiError("완료되지 않은 탐험 결과는 저장할 수 없습니다.");
}

function toDbResult(r: AnyRow) {
  return {
    game_session_id: r.gameSessionId, class_name: r.className, student_number: r.studentNumber,
    nickname: r.nickname, character_name: r.character, level: r.level, exp: r.exp, gold: r.gold,
    total_questions: r.totalQuestions, first_try_correct: r.firstTryCorrect, total_wrong: r.totalWrong,
    accuracy: r.accuracy, play_time: r.playTime, visited_climates: r.visitedClimates,
    climate_scores: r.climateScores, achievements: r.achievements, exploration_score: r.explorationScore,
    remaining_hp: r.remainingHp, boss_complete: r.bossComplete, completed_at: r.completedAt,
  };
}

function fromDbResult(r: AnyRow) {
  return {
    submittedAt: r.submitted_at, gameSessionId: r.game_session_id, className: r.class_name,
    studentNumber: Number(r.student_number), nickname: r.nickname, character: r.character_name,
    level: Number(r.level), exp: Number(r.exp), gold: Number(r.gold), totalQuestions: Number(r.total_questions),
    firstTryCorrect: Number(r.first_try_correct), totalWrong: Number(r.total_wrong), accuracy: Number(r.accuracy),
    playTime: Number(r.play_time), visitedClimates: r.visited_climates || [], climateScores: r.climate_scores || {},
    achievements: r.achievements || [], explorationScore: Number(r.exploration_score), remainingHp: Number(r.remaining_hp),
    bossComplete: Boolean(r.boss_complete), completedAt: r.completed_at, rank: 0,
  };
}

async function readResults(className = "") {
  let query = supabase.from("results").select("*").order("submitted_at", { ascending: true });
  if (className) query = query.eq("class_name", text(className, 20));
  const { data, error } = await query;
  if (error) throw new ApiError(`결과 조회 실패: ${error.message}`, "DB_ERROR", 500);
  return (data || []).map(fromDbResult);
}

async function getRanking(className: string, gameSessionId: string) {
  const settings = await getSettings();
  if (!settings.rankingEnabled) throw new ApiError("선생님이 현재 학급 랭킹을 꺼 두었습니다.");
  const all = await readResults(text(className, 20));
  const mine = all.find((r) => r.gameSessionId === String(gameSessionId || ""));
  const rows = rankRows(selectAttempts(all, settings.rankingMode));
  return { rows: rows.map((r) => ({ rank: r.rank, nickname: r.nickname, explorationScore: r.explorationScore, isMe: mine ? studentKey(r) === studentKey(mine) : false })), total: rows.length, settings };
}

async function getDashboard(className: string) {
  const all = await readResults();
  const classes = [...new Set(all.map((r) => r.className).filter(Boolean))].sort();
  const filtered = className ? all.filter((r) => r.className === String(className)) : all;
  const settings = await getSettings();
  const rows = rankRows(selectAttempts(filtered, settings.rankingMode));
  const summary = {
    participants: new Set(filtered.map(studentKey)).size, completed: rows.length,
    averageScore: average(rows.map((r) => r.explorationScore)), averageAccuracy: average(rows.map((r) => r.accuracy)),
    averagePlayTime: average(rows.map((r) => r.playTime)),
  };
  return { summary, rows, climateStats: climateStatsFrom(rows), classes, settings };
}

async function getStudentResult(gameSessionId: string) {
  const { data, error } = await supabase.from("results").select("*").eq("game_session_id", text(gameSessionId, 100)).maybeSingle();
  if (error) throw new ApiError(`학생 결과 조회 실패: ${error.message}`, "DB_ERROR", 500);
  if (!data) throw new ApiError("학생 결과를 찾을 수 없습니다.", "NOT_FOUND", 404);
  return fromDbResult(data);
}

async function getClimateStats(className: string) {
  const rows = selectAttempts(await readResults(className || ""), (await getSettings()).rankingMode);
  return climateStatsFrom(rows);
}

async function getQuestionStats(className: string) {
  let query = supabase.from("responses").select("question_id,climate,first_choice,first_try");
  if (className) query = query.eq("class_name", text(className, 20));
  const { data, error } = await query;
  if (error) throw new ApiError(`문제 분석 조회 실패: ${error.message}`, "DB_ERROR", 500);
  const groups: AnyRow = {};
  (data || []).forEach((r) => {
    const id = String(r.question_id);
    if (!groups[id]) groups[id] = { questionId: id, climate: String(r.climate), total: 0, correct: 0, wrong: {} };
    const g = groups[id]; g.total++;
    if (r.first_try) g.correct++; else g.wrong[String(r.first_choice || "응답 없음")] = (g.wrong[String(r.first_choice || "응답 없음")] || 0) + 1;
  });
  return Object.values(groups).map((g: any) => {
    const top = Object.entries(g.wrong).sort((a: any, b: any) => b[1] - a[1])[0] || ["", 0];
    return { questionId: g.questionId, climate: g.climate, total: g.total, accuracy: g.total ? g.correct / g.total * 100 : 0, topWrong: top[0], topWrongCount: top[1] };
  }).sort((a: any, b: any) => a.accuracy - b.accuracy);
}

async function getSettings() {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new ApiError(`설정 조회 실패: ${error.message}`, "DB_ERROR", 500);
  if (!data) return { ...DEFAULT_SETTINGS };
  return { rankingEnabled: data.ranking_enabled, rankingLimit: data.ranking_limit, rankingMode: data.ranking_mode, nameMode: data.name_mode, questionCount: data.question_count, regionCount: data.region_count, bossCount: data.boss_count };
}

async function updateSettings(input: AnyRow) {
  const current = await getSettings();
  const next = { ...current, ...(input || {}) };
  if (!["best", "latest", "first"].includes(String(next.rankingMode))) throw new ApiError("재도전 반영 방식이 올바르지 않습니다.");
  if (![5, 10, 999].includes(Number(next.rankingLimit))) throw new ApiError("랭킹 표시 범위가 올바르지 않습니다.");
  const row = {
    id: 1, ranking_enabled: Boolean(next.rankingEnabled), ranking_limit: Number(next.rankingLimit), ranking_mode: next.rankingMode,
    name_mode: next.nameMode === "name" ? "name" : "nickname", question_count: clamp(next.questionCount, 1, 50),
    region_count: clamp(next.regionCount, 1, 6), boss_count: clamp(next.bossCount, 1, 3), updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("settings").upsert(row);
  if (error) throw new ApiError(`설정 저장 실패: ${error.message}`, "DB_ERROR", 500);
  return getSettings();
}

async function resetClassData(className: string, confirmation: string) {
  if (confirmation !== "RESET") throw new ApiError("RESET 확인 문구가 필요합니다.");
  let countQuery = supabase.from("results").select("id", { count: "exact", head: true });
  if (className) countQuery = countQuery.eq("class_name", text(className, 20));
  const { count, error: countError } = await countQuery;
  if (countError) throw new ApiError(`초기화 대상 확인 실패: ${countError.message}`, "DB_ERROR", 500);
  let deleteQuery = supabase.from("results").delete();
  deleteQuery = className ? deleteQuery.eq("class_name", text(className, 20)) : deleteQuery.gte("id", 0);
  const { error } = await deleteQuery;
  if (error) throw new ApiError(`결과 초기화 실패: ${error.message}`, "DB_ERROR", 500);
  return { removedResults: count || 0, className: className || "전체" };
}

function selectAttempts(rows: AnyRow[], mode: string) {
  const map = new Map<string, AnyRow>();
  rows.forEach((r) => {
    const key = studentKey(r), old = map.get(key);
    if (!old || mode === "latest" && new Date(r.submittedAt) > new Date(old.submittedAt) || mode === "first" && new Date(r.submittedAt) < new Date(old.submittedAt) || mode === "best" && compareRank(r, old) < 0) map.set(key, r);
  });
  return [...map.values()];
}

function rankRows(rows: AnyRow[]) {
  rows.sort(compareRank); let rank = 0, last = "";
  rows.forEach((r, i) => { const key = `${r.explorationScore}|${r.firstTryCorrect}|${r.accuracy}`; if (key !== last) rank = i + 1; r.rank = rank; last = key; });
  return rows;
}

function compareRank(a: AnyRow, b: AnyRow) { return b.explorationScore - a.explorationScore || b.firstTryCorrect - a.firstTryCorrect || b.accuracy - a.accuracy; }
function studentKey(r: AnyRow) { return `${r.className}#${r.studentNumber}`; }
function climateStatsFrom(rows: AnyRow[]) { return CLIMATES.map((c) => { const values = rows.map((r) => r.climateScores?.[c.id]).filter((v) => v !== null && v !== undefined).map(Number); return { id: c.id, name: c.name, icon: c.icon, average: average(values), count: values.length, guidance: c.guidance }; }); }

async function verifyTeacherPin(pin: unknown) {
  const expected = Deno.env.get("TEACHER_PIN") || "";
  if (!expected) throw new ApiError("TEACHER_PIN 비밀값이 설정되지 않았습니다.", "SERVER_CONFIG", 500);
  if (!(await safeEqual(String(pin || ""), expected))) throw new ApiError("PIN이 올바르지 않습니다.", "INVALID_PIN", 401);
  return { token: await issueTeacherToken(), expiresIn: 21600 };
}

async function issueTeacherToken() {
  const secret = Deno.env.get("ADMIN_TOKEN_SECRET") || "";
  if (secret.length < 32) throw new ApiError("ADMIN_TOKEN_SECRET은 32자 이상이어야 합니다.", "SERVER_CONFIG", 500);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ purpose: "teacher", exp: Math.floor(Date.now() / 1000) + 21600 })));
  const message = `${header}.${payload}`;
  return `${message}.${await hmac(message, secret)}`;
}

async function requireTeacher(token: unknown) {
  try {
    const secret = Deno.env.get("ADMIN_TOKEN_SECRET") || "";
    const parts = String(token || "").split(".");
    if (parts.length !== 3 || !await safeEqual(parts[2], await hmac(`${parts[0]}.${parts[1]}`, secret))) throw new Error();
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1])));
    if (payload.purpose !== "teacher" || Number(payload.exp) < Math.floor(Date.now() / 1000)) throw new Error();
  } catch (_) { throw new ApiError("교사용 인증이 만료되었습니다. 다시 로그인하세요.", "AUTH_REQUIRED", 401); }
}

async function hmac(message: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}

async function safeEqual(a: string, b: string) {
  const [aa, bb] = await Promise.all([crypto.subtle.digest("SHA-256", new TextEncoder().encode(a)), crypto.subtle.digest("SHA-256", new TextEncoder().encode(b))]);
  const x = new Uint8Array(aa), y = new Uint8Array(bb); let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function base64Url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromBase64Url(value: string) { const base = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4); return Uint8Array.from(atob(base), (c) => c.charCodeAt(0)); }
function parseKeyMap(value: string | undefined) { try { return JSON.parse(value || "{}") as Record<string, string>; } catch (_) { return {}; } }
async function validClientKey(value: string) { const allowed = [...Object.values(publishableKeys), Deno.env.get("SUPABASE_ANON_KEY") || ""].filter(Boolean); for (const key of allowed) if (await safeEqual(value, key)) return true; return false; }
function text(v: unknown, max: number) { return String(v ?? "").trim().slice(0, max); }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function bool(v: unknown) { return v === true || String(v).toLowerCase() === "true"; }
function clamp(v: unknown, min: number, max: number) { return Math.max(min, Math.min(max, Math.round(num(v)))); }
function average(values: number[]) { return values.length ? values.reduce((a, b) => a + Number(b || 0), 0) / values.length : 0; }
function validDate(v: unknown) { const d = new Date(String(v || "")); return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); }
