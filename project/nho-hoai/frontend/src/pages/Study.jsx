import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { clearToken } from "../lib/auth";
import "./study.css";

const AUTO_NEXT_MS = 1200; // ✅ chỉnh nhanh/chậm ở đây (ms). ví dụ 800, 1200, 1500
const TICK_MS = 50;

// session tuning
const QUESTION_LIMIT = 10; // ✅ luôn 10 câu / session
const NEW_LIMIT = 6; // ✅ 6 từ mới
const OLD_TARGET = 4; // ✅ tối thiểu 4 từ cũ
const MAX_APPEAR_PER_CARD = 12; // ✅ max 12 lần xuất hiện / card / session
const MIN_GAP = 2; // ✅ tránh gặp lại ngay

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqueNonEmpty(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const v = (x ?? "").toString().trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function buildMCQ({ card, allCards, mode }) {
  const isT2M = mode === "TERM_TO_MEANING";
  const prompt = isT2M ? card.term : card.meaning;
  const correct = isT2M ? card.meaning : card.term;

  const pool = uniqueNonEmpty(
    allCards.map((c) => (isT2M ? c.meaning : c.term)),
  ).filter((x) => x !== correct);

  const wrongs = shuffle(pool).slice(0, 3);
  while (wrongs.length < 3) wrongs.push("—");

  return {
    cardId: card.id,
    prompt,
    correct,
    choices: shuffle([correct, ...wrongs]),
    note: card.note || "",
    mode,
  };
}

function uniqKeepOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

export default function Study() {
  const { id } = useParams();
  const deckId = Number(id);
  const nav = useNavigate();

  function logout() {
    clearToken();
    nav("/login");
  }

  // boot state
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [totalCards, setTotalCards] = useState(0);

  // session info
  const sessionIdRef = useRef(null);

  // cards pool
  const cardsRef = useRef([]);
  const cardByIdRef = useRef(new Map());

  // queues
  const dueRef = useRef([]);
  const learningRef = useRef([]);
  const newRef = useRef([]);
  const retryRef = useRef([]);

  // ✅ fallback pool for ensuring 10 questions
  // sessionPool = các card ids “được đưa vào session” (new + old target + carryover + due/learning)
  const sessionPoolRef = useRef([]);
  const oldPoolRef = useRef([]); // remaining old candidates (not new)

  // session tracking
  const answeredCountRef = useRef(0);
  const counterRef = useRef(0);

  const wrongInSessionRef = useRef(new Map());
  const correctInSessionRef = useRef(new Map());
  const seenCountRef = useRef(new Map());
  const lastSeenAtRef = useRef(new Map());

  // summary
  const [isComplete, setIsComplete] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);

  // current question UI
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [showHard, setShowHard] = useState(false);

  // auto-next countdown
  const [autoLeftMs, setAutoLeftMs] = useState(0);
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(0);

  function clearTimers() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startedAtRef.current = 0;
    setAutoLeftMs(0);
  }

  function startAutoNext(nextFn) {
    clearTimers();
    startedAtRef.current = Date.now();
    setAutoLeftMs(AUTO_NEXT_MS);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const left = Math.max(0, AUTO_NEXT_MS - elapsed);
      setAutoLeftMs(left);
      if (left <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, TICK_MS);

    timeoutRef.current = setTimeout(() => nextFn(), AUTO_NEXT_MS);
  }

  function canShowCardNow(cardId) {
    const last = lastSeenAtRef.current.get(cardId);
    if (!last) return true;
    return counterRef.current - last >= MIN_GAP;
  }

  function bumpSeen(cardId) {
    const prev = seenCountRef.current.get(cardId) || 0;
    const next = prev + 1;
    seenCountRef.current.set(cardId, next);
    lastSeenAtRef.current.set(cardId, counterRef.current);
    return next;
  }

  function pickFromQueue(q) {
    const tries = 60;
    for (let t = 0; t < tries; t++) {
      if (q.length === 0) return null;
      const id = q.shift();

      const seen = seenCountRef.current.get(id) || 0;
      if (seen >= MAX_APPEAR_PER_CARD) continue;

      if (!canShowCardNow(id)) {
        q.push(id);
        continue;
      }
      return id;
    }
    return null;
  }

  // ✅ Fallback pick to guarantee 10 questions
  function pickFromSessionPool() {
    const pool = sessionPoolRef.current;
    if (!pool.length) return null;

    // try a few random candidates
    for (let i = 0; i < 40; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      const seen = seenCountRef.current.get(id) || 0;
      if (seen >= MAX_APPEAR_PER_CARD) continue;
      if (!canShowCardNow(id)) continue;
      return id;
    }
    return null;
  }

  function pickNextCardId() {
    counterRef.current += 1;

    // every 3rd question: prefer retry
    if (retryRef.current.length > 0 && counterRef.current % 3 === 0) {
      const id = pickFromQueue(retryRef.current);
      if (id) return id;
    }

    let id = pickFromQueue(dueRef.current);
    if (id) return id;

    id = pickFromQueue(learningRef.current);
    if (id) return id;

    id = pickFromQueue(newRef.current);
    if (id) return id;

    id = pickFromQueue(retryRef.current);
    if (id) return id;

    // ✅ important: if queues are empty but session hasn't reached 10 questions,
    // pick again from sessionPool (review repeats)
    return pickFromSessionPool();
  }

  function buildNextQuestion() {
    if (answeredCountRef.current >= QUESTION_LIMIT) return null;

    const nextId = pickNextCardId();
    if (!nextId) return null;

    const card = cardByIdRef.current.get(nextId);
    if (!card) return null;

    bumpSeen(nextId);

    const mode = Math.random() < 0.5 ? "TERM_TO_MEANING" : "MEANING_TO_TERM";
    return buildMCQ({ card, allCards: cardsRef.current, mode });
  }

  function makeSummary() {
    const rows = [];
    const ids = Array.from(seenCountRef.current.keys());

    for (const cardId of ids) {
      const card = cardByIdRef.current.get(cardId);
      if (!card) continue;

      const correct = correctInSessionRef.current.get(cardId) || 0;
      const wrong = wrongInSessionRef.current.get(cardId) || 0;
      const hard = wrong >= 2;

      rows.push({
        cardId,
        term: card.term,
        meaning: card.meaning,
        correct,
        wrong,
        hard,
      });
    }

    rows.sort((a, b) => {
      if (a.hard !== b.hard) return a.hard ? -1 : 1;
      if (a.wrong !== b.wrong) return b.wrong - a.wrong;
      return a.term.localeCompare(b.term);
    });

    setSummaryRows(rows);
  }

  function endSessionUI() {
    clearTimers();
    setQuestion(null);
    setSelected(null);
    setIsCorrect(null);
    setShowHard(false);
    setIsComplete(true);
    makeSummary();
  }

  function nextQuestion() {
    clearTimers();
    setSelected(null);
    setIsCorrect(null);
    setShowHard(false);

    const q = buildNextQuestion();
    if (!q) {
      endSessionUI();
      return;
    }
    setQuestion(q);
  }

  async function boot(carryOverCardIds = []) {
    setLoading(true);
    setBootError("");
    setIsComplete(false);
    setSummaryRows([]);

    try {
      const res = await api.post(`/api/decks/${deckId}/study/start/`, {
        carry_over_card_ids: carryOverCardIds,
        new_limit: NEW_LIMIT,
        question_limit: QUESTION_LIMIT,
      });

      const data = res.data;

      sessionIdRef.current = data.session?.id ?? null;
      setDeckTitle(data.deck?.title || "");

      const cards = data.cards || [];
      setTotalCards(cards.length);

      cardsRef.current = cards;
      cardByIdRef.current = new Map(cards.map((c) => [c.id, c]));

      const queues = data.queues || {};
      const due = [...(queues.due || [])];
      const learning = [...(queues.learning || [])];
      const newIds = [...(queues.new || [])];

      // ✅ Build oldPool (old candidates not in new)
      const allIds = cards.map((c) => c.id);
      const newSet = new Set(newIds);
      const oldCandidates = allIds.filter((cid) => !newSet.has(cid));
      oldPoolRef.current = shuffle(oldCandidates);

      // ✅ Ensure at least OLD_TARGET old cards in session seed
      // priority: carryOver (already inside learning), then due/learning, then top from oldPool
      const currentOld = uniqKeepOrder([...learning, ...due]).filter(
        (cid) => !newSet.has(cid),
      );
      const need = Math.max(0, OLD_TARGET - currentOld.length);

      if (need > 0) {
        const extra = [];
        while (extra.length < need && oldPoolRef.current.length > 0) {
          const pick = oldPoolRef.current.shift();
          if (!pick) break;
          if (newSet.has(pick)) continue;
          if (currentOld.includes(pick)) continue;
          extra.push(pick);
        }
        // add extras to learning queue so they appear this session
        learning.push(...extra);
      }

      // set queues
      dueRef.current = due;
      learningRef.current = learning;
      newRef.current = newIds;
      retryRef.current = [];

      // ✅ build sessionPool = union(new + due + learning)
      sessionPoolRef.current = uniqKeepOrder([...newIds, ...due, ...learning]);

      // reset counters
      answeredCountRef.current = 0;
      counterRef.current = 0;
      wrongInSessionRef.current = new Map();
      correctInSessionRef.current = new Map();
      seenCountRef.current = new Map();
      lastSeenAtRef.current = new Map();

      const first = buildNextQuestion();
      if (!first) {
        endSessionUI();
        return;
      }

      setQuestion(first);
      setSelected(null);
      setIsCorrect(null);
      setShowHard(false);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        logout();
        return;
      }
      setBootError("Failed to start study session.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    boot();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  async function submitAnswer(cardId, ok) {
    const sid = sessionIdRef.current;
    if (!sid) return;

    try {
      await api.post("/api/study/answer/", {
        session_id: sid,
        card_id: cardId,
        is_correct: ok,
      });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) logout();
    }
  }

  function reinsertOnWrong(cardId) {
    const m = wrongInSessionRef.current;
    const prev = m.get(cardId) || 0;
    const nextWrong = prev + 1;
    m.set(cardId, nextWrong);

    if (nextWrong >= 2) setShowHard(true);

    // cap spam
    const seen = seenCountRef.current.get(cardId) || 0;
    if (seen >= MAX_APPEAR_PER_CARD) return;

    const weight = Math.min(1 + nextWrong, 3);
    retryRef.current.unshift(cardId);
    for (let i = 1; i < weight; i++) retryRef.current.push(cardId);
  }

  function recordCorrect(cardId) {
    const m = correctInSessionRef.current;
    m.set(cardId, (m.get(cardId) || 0) + 1);
  }

  async function pick(choice) {
    if (!question) return;
    if (selected !== null) return;

    setSelected(choice);

    const ok = choice === question.correct;
    setIsCorrect(ok);

    await submitAnswer(question.cardId, ok);

    // ✅ count towards the 10-question session regardless correct/wrong
    answeredCountRef.current += 1;

    if (ok) {
      recordCorrect(question.cardId);
      startAutoNext(nextQuestion);
    } else {
      reinsertOnWrong(question.cardId);
    }
  }

  const autoPct =
    autoLeftMs > 0
      ? Math.max(0, Math.min(100, (autoLeftMs / AUTO_NEXT_MS) * 100))
      : 0;

  const progressText = useMemo(() => {
    // show current step (1..10)
    const step = Math.min(
      answeredCountRef.current + (question ? 1 : 0),
      QUESTION_LIMIT,
    );
    return `${step} / ${QUESTION_LIMIT}`;
  }, [question, loading, isComplete]);

  function getCarryOverHardIds() {
    // top 4 wrongest from summary
    const rows = [...summaryRows];
    rows.sort((a, b) => b.wrong - a.wrong);
    return rows
      .filter((r) => r.wrong > 0)
      .slice(0, 4)
      .map((r) => r.cardId);
  }

  return (
    <div className="study-shell">
      <header className="study-topbar">
        <Link className="study-brand" to="/">
          NHỚ HOÀI
        </Link>

        <div className="study-actions">
          <Link className="study-btn" to="/">
            Home
          </Link>
          <button className="study-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="study-main">
        <div className="study-head">
          <h1 className="study-title">Study</h1>
          <div className="study-sub">
            {deckTitle ? `${deckTitle} • ` : ""}
            Deck #{deckId} • {totalCards} cards
          </div>
        </div>

        {loading && <p>Starting session...</p>}
        {!!bootError && <p style={{ color: "crimson" }}>{bootError}</p>}

        {!loading && !bootError && isComplete && (
          <div className="study-card">
            <div className="study-progress">Session complete ✅</div>

            <h2 style={{ marginTop: 12, marginBottom: 10 }}>Summary</h2>

            <div className="summaryTable">
              <div className="summaryHead">
                <div>Word</div>
                <div>Meaning</div>
                <div className="right">Correct</div>
                <div className="right">Wrong</div>
              </div>

              {summaryRows.map((r) => (
                <div
                  key={r.cardId}
                  className={`summaryRow ${r.hard ? "hardRow" : ""}`}
                >
                  <div className="strong">{r.term}</div>
                  <div>{r.meaning}</div>
                  <div className="right">{r.correct}</div>
                  <div className="right">{r.wrong}</div>
                </div>
              ))}
            </div>

            <div className="study-footer" style={{ marginTop: 14 }}>
              <button
                className="study-next"
                onClick={() => boot(getCarryOverHardIds())}
              >
                Study next session →
              </button>
            </div>
          </div>
        )}

        {!loading && !bootError && !isComplete && question && (
          <div className="study-card">
            <div className="study-progress">
              {progressText}
              <span style={{ marginLeft: 10, opacity: 0.7 }}>
                •{" "}
                {question.mode === "TERM_TO_MEANING"
                  ? "term→meaning"
                  : "meaning→term"}
              </span>
              {showHard && <span className="hardPill">Hard</span>}
            </div>

            <div className="study-prompt">{question.prompt}</div>

            <div className="study-choices">
              {question.choices.map((c) => {
                const picked = selected === c;
                const correctChoice =
                  selected !== null && c === question.correct;
                const wrongPicked =
                  picked && selected !== null && c !== question.correct;

                let cls = "choice";
                if (picked) cls += " choice-picked";
                if (correctChoice) cls += " choice-correct";
                if (wrongPicked) cls += " choice-wrong";

                return (
                  <button
                    key={`${question.cardId}-${c}`}
                    className={cls}
                    onClick={() => pick(c)}
                    disabled={selected !== null}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            {selected !== null && (
              <div
                className={isCorrect ? "study-result ok" : "study-result bad"}
              >
                {isCorrect
                  ? "Correct ✅"
                  : `Wrong ❌  Answer: ${question.correct}`}

                <div className="study-noteRow">
                  <span className="study-noteLabel">Note:</span>
                  <span className="study-noteText">
                    {question.note?.trim() ? question.note : "—"}
                  </span>
                </div>

                {isCorrect === true && (
                  <div className="autoNextBar" aria-label="Auto next progress">
                    <div
                      className="autoNextFill"
                      style={{ width: `${autoPct}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {selected !== null && isCorrect === false && (
              <div className="study-footer">
                <button className="study-next" onClick={nextQuestion}>
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
