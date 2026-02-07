import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { clearToken } from "../lib/auth";
import "./study.css";

// Session policy
const CORE_SIZE = 6;
const MAX_TOTAL = 12;
const AUTO_NEXT_MS = 1100;

const NUM_CHOICES = 4;
const MIN_GAP = 2;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqNonEmpty(arr) {
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

  const pool = uniqNonEmpty(
    allCards.map((c) => (isT2M ? c.meaning : c.term)),
  ).filter((x) => x !== correct);

  const wrongs = shuffle(pool).slice(0, NUM_CHOICES - 1);
  while (wrongs.length < NUM_CHOICES - 1) wrongs.push("—");

  return {
    cardId: card.id,
    prompt,
    correct,
    choices: shuffle([correct, ...wrongs]),
    meaning: card.meaning || "",
    note: card.note || "",
    mode,
  };
}

export default function Study() {
  const { id } = useParams();
  const deckId = Number(id);
  const nav = useNavigate();

  function logout() {
    clearToken();
    nav("/login");
  }

  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState("");
  const [deckTitle, setDeckTitle] = useState("");

  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);

  const [isComplete, setIsComplete] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [carryOverIds, setCarryOverIds] = useState([]);

  const [autoLeftMs, setAutoLeftMs] = useState(0);

  const [answeredCount, setAnsweredCount] = useState(0);

  const sessionIdRef = useRef(null);
  const cardsRef = useRef([]);
  const cardByIdRef = useRef(new Map());

  const queueRef = useRef([]);
  const recentRef = useRef([]);

  const answeredCountRef = useRef(0);

  const correctCountRef = useRef(new Map());
  const wrongCountRef = useRef(new Map());

  const nextTimerRef = useRef(null);
  const tickTimerRef = useRef(null);

  function clearTimers() {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    nextTimerRef.current = null;
    tickTimerRef.current = null;
    setAutoLeftMs(0);
  }

  function pushRecent(cid) {
    const r = recentRef.current;
    r.push(cid);
    while (r.length > MIN_GAP) r.shift();
  }
  function isRecent(cid) {
    return recentRef.current.includes(cid);
  }

  function incMap(m, k) {
    m.set(k, (m.get(k) || 0) + 1);
  }

  function endSessionFallbackSummary() {
    const keySet = new Set([
      ...correctCountRef.current.keys(),
      ...wrongCountRef.current.keys(),
    ]);

    const rows = Array.from(keySet)
      .map((cid) => {
        const c = cardByIdRef.current.get(cid);
        if (!c) return null;
        const correct = correctCountRef.current.get(cid) || 0;
        const wrong = wrongCountRef.current.get(cid) || 0;
        return {
          cardId: cid,
          term: c.term,
          meaning: c.meaning,
          note: c.note || "",
          correct,
          wrong,
          hard: wrong > 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.wrong - a.wrong);

    setSummaryRows(rows);
    setCarryOverIds(
      rows
        .filter((r) => r.wrong > 0)
        .slice(0, 4)
        .map((r) => r.cardId),
    );
  }

  function setComplete() {
    clearTimers();
    setQuestion(null);
    setSelected(null);
    setIsCorrect(null);
    setIsComplete(true);
    endSessionFallbackSummary();
  }

  function startAutoNext() {
    clearTimers();
    setAutoLeftMs(AUTO_NEXT_MS);

    const startAt = Date.now();
    tickTimerRef.current = setInterval(() => {
      const left = Math.max(0, AUTO_NEXT_MS - (Date.now() - startAt));
      setAutoLeftMs(left);
    }, 50);

    nextTimerRef.current = setTimeout(() => {
      clearTimers();
      nextQuestion();
    }, AUTO_NEXT_MS);
  }

  function pickNextCardIdFromQueue() {
    const q = queueRef.current;

    for (let i = 0; i < q.length; i++) {
      const cid = q[i];
      if (!isRecent(cid)) {
        q.splice(i, 1);
        return cid;
      }
    }
    return q.shift() ?? null;
  }

  function buildNextQuestion() {
    const cid = pickNextCardIdFromQueue();
    if (cid == null) return null;

    const card = cardByIdRef.current.get(cid);
    if (!card) return null;

    pushRecent(cid);

    const mode = Math.random() < 0.5 ? "TERM_TO_MEANING" : "MEANING_TO_TERM";
    return buildMCQ({ card, allCards: cardsRef.current, mode });
  }

  function nextQuestion() {
    clearTimers();
    setSelected(null);
    setIsCorrect(null);

    if (answeredCountRef.current >= MAX_TOTAL) {
      setComplete();
      return;
    }

    const q = buildNextQuestion();
    if (!q) {
      setComplete();
      return;
    }
    setQuestion(q);
  }

  async function submitAnswerToBackend(cardId, ok) {
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

  async function fetchSummaryFromBackend() {
    const sid = sessionIdRef.current;
    if (!sid) return;

    setSummaryLoading(true);
    try {
      const res = await api.get(`/api/study/summary/?session_id=${sid}`);
      const rows = (res.data?.rows || []).map((r) => ({
        cardId: r.cardId,
        term: r.term,
        meaning: r.meaning,
        note: r.note || "",
        correct: r.correct ?? 0,
        wrong: r.wrong ?? 0,
        hard: !!r.hard,
      }));
      setSummaryRows(rows);
      setCarryOverIds(res.data?.recommended_carry_over_card_ids || []);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) logout();
    } finally {
      setSummaryLoading(false);
    }
  }

  async function boot(carryOverCardIds = []) {
    setLoading(true);
    setBootError("");
    setIsComplete(false);
    setSummaryRows([]);
    setCarryOverIds([]);
    setSummaryLoading(false);

    sessionIdRef.current = null;
    cardsRef.current = [];
    cardByIdRef.current = new Map();
    queueRef.current = [];
    recentRef.current = [];

    answeredCountRef.current = 0;
    setAnsweredCount(0);

    correctCountRef.current = new Map();
    wrongCountRef.current = new Map();

    clearTimers();
    setQuestion(null);
    setSelected(null);
    setIsCorrect(null);

    try {
      const res = await api.post(`/api/decks/${deckId}/study/start/`, {
        core_size: CORE_SIZE,
        max_total_questions: MAX_TOTAL,
        carry_over_card_ids: carryOverCardIds,
      });

      const data = res.data;

      sessionIdRef.current = data.session?.id ?? null;
      setDeckTitle(data.deck?.title || "");

      const cards = data.cards || [];
      cardsRef.current = cards;
      cardByIdRef.current = new Map(cards.map((c) => [c.id, c]));

      const coreIds = data.core_ids || [];
      queueRef.current = shuffle(coreIds);

      setLoading(false);
      nextQuestion();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401) {
        logout();
        return;
      }
      setBootError("Please add vocabulary first!");
      setLoading(false);
    }
  }

  useEffect(() => {
    boot();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  useEffect(() => {
    if (!isComplete) return;
    fetchSummaryFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  async function answer(choiceOrNull) {
    if (!question) return;
    if (selected !== null) return;

    const chosen = choiceOrNull ?? "__IDK__";
    setSelected(chosen);

    const ok = choiceOrNull !== null && choiceOrNull === question.correct;
    setIsCorrect(ok);

    answeredCountRef.current += 1;
    setAnsweredCount(answeredCountRef.current);

    if (ok) incMap(correctCountRef.current, question.cardId);
    else incMap(wrongCountRef.current, question.cardId);

    await submitAnswerToBackend(question.cardId, ok);

    if (!ok && answeredCountRef.current < MAX_TOTAL) {
      queueRef.current.push(question.cardId);
    }

    if (answeredCountRef.current >= MAX_TOTAL) {
      setComplete();
      return;
    }

    if (ok) startAutoNext();
  }

  const progressRatio = useMemo(() => {
    return (Math.min(answeredCount, MAX_TOTAL) / MAX_TOTAL) * 100;
  }, [answeredCount]);

  const autoPct =
    autoLeftMs > 0
      ? Math.max(0, Math.min(100, (autoLeftMs / AUTO_NEXT_MS) * 100))
      : 0;

  const titleLine = deckTitle ? `${deckTitle} • New level` : "New level";

  return (
    <div className="m-study">
      <header className="m-topbar">
        <div className="m-topbarLeft">
          <Link className="m-brand" to="/">
            NHỚ HOÀI
          </Link>
          <div className="m-levelTitle">{titleLine}</div>
        </div>

        <div className="m-topbarRight">
          <Link className="m-pill" to="/">
            Home
          </Link>
          <button className="m-pill" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="m-main">
        <div className="m-progressRow">
          <div className="m-progressBar">
            <div
              className="m-progressFill"
              style={{ width: `${progressRatio}%` }}
            />
          </div>
          <div className="m-progressCount">{answeredCount}</div>
        </div>

        {loading && <div className="m-card">Starting session…</div>}
        {!!bootError && <div className="m-card m-error">{bootError}</div>}

        {!loading && !bootError && isComplete && (
          <div className="m-card">
            <div className="m-completeTitle">
              Session complete ✅{" "}
              {summaryLoading ? (
                <span className="m-muted">• loading…</span>
              ) : null}
            </div>

            <div className="m-summary">
              <div className="m-summaryHead">
                <div>Word</div>
                <div>Meaning</div>
                <div>Note</div>
                <div className="m-right">Correct</div>
                <div className="m-right">Wrong</div>
              </div>

              {summaryRows.map((r) => (
                <div
                  key={r.cardId}
                  className={`m-summaryRow ${r.hard ? "m-hard" : ""}`}
                >
                  <div className="m-strong">{r.term}</div>
                  <div>{r.meaning}</div>
                  <div className="m-muted">{r.note || "—"}</div>
                  <div className="m-right">{r.correct}</div>
                  <div className="m-right">{r.wrong}</div>
                </div>
              ))}
            </div>

            <div className="m-footer">
              <button className="m-primary" onClick={() => boot(carryOverIds)}>
                Study next session →
              </button>
            </div>
          </div>
        )}

        {!loading && !bootError && !isComplete && question && (
          <div className="m-stage">
            {/* ✅ Memrise-like header row: left instruction, right IDK */}
            <div className="m-headRow">
              <div className="m-instruction">Pick the correct answer</div>

              <button
                className="m-idkCard"
                onClick={() => answer(null)}
                disabled={selected !== null}
                title="Mark as wrong and show answer"
              >
                <div className="m-idkBig">?</div>
                <div className="m-idkSmall">I don’t know</div>
              </button>
            </div>

            {/* ✅ Reduce spacing */}
            <div className="m-promptWrap tight">
              <div className="m-prompt">{question.prompt}</div>
            </div>

            <div className="m-choicesFull">
              {question.choices.map((c, idx) => {
                const isChosen = selected === c;
                const showRight = selected !== null && c === question.correct;
                const showWrong =
                  selected !== null && isChosen && c !== question.correct;

                return (
                  <button
                    key={`${c}-${idx}`}
                    className={[
                      "m-choice",
                      isChosen ? "isChosen" : "",
                      showRight ? "isRight" : "",
                      showWrong ? "isWrong" : "",
                    ].join(" ")}
                    onClick={() => answer(c)}
                    disabled={selected !== null}
                  >
                    <span className="m-choiceNum">{idx + 1}</span>
                    <span className="m-choiceText">{c}</span>
                  </button>
                );
              })}
            </div>

            {/* ✅ Note/Meaning replaces old IDK position: shown below */}
            {selected !== null && isCorrect === true && (
              <div className="m-revealRow ok">
                <div className="m-revealTitle">✅ Correct</div>

                <div className="m-revealLine">
                  <span className="m-revealLabel">Meaning:</span>{" "}
                  <b>{question.meaning || question.correct}</b>
                </div>

                <div className="m-revealLine">
                  <span className="m-revealLabel">Note:</span>{" "}
                  <span className="m-muted">{question.note || "—"}</span>
                </div>

                <div className="m-autoBar">
                  <div
                    className="m-autoFill"
                    style={{ width: `${autoPct}%` }}
                  />
                </div>
              </div>
            )}

            {selected !== null && isCorrect === false && (
              <div className="m-revealRow bad">
                <div className="m-revealTitle">
                  ❌ Wrong — Answer: <b>{question.correct}</b>
                </div>

                <div className="m-revealLine">
                  <span className="m-revealLabel">Meaning:</span>{" "}
                  <b>{question.meaning || question.correct}</b>
                </div>

                <div className="m-revealLine">
                  <span className="m-revealLabel">Note:</span>{" "}
                  <span className="m-muted">{question.note || "—"}</span>
                </div>

                <button
                  className="m-primary m-next"
                  onClick={() => nextQuestion()}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
