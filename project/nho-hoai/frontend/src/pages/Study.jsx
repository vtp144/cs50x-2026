import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { clearToken } from "../lib/auth";
import "./study.css";

function fetchCards(deckId) {
  return api.get(`/api/decks/${deckId}/cards/`).then((r) => r.data);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(cards, index) {
  const card = cards[index];
  const correct = card.meaning;

  const pool = cards.map((c) => c.meaning).filter((m) => m && m !== correct);

  const wrongs = shuffle(pool).slice(0, 3);
  while (wrongs.length < 3) wrongs.push("—");

  const choices = shuffle([correct, ...wrongs]);

  return {
    cardId: card.id,
    prompt: card.term,
    correct,
    choices,
  };
}

const AUTO_NEXT_MS = 3000;
const TICK_MS = 50;

export default function Study() {
  const { id } = useParams();
  const deckId = Number(id);
  const nav = useNavigate();

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);

  // ✅ countdown bar state
  const [autoLeftMs, setAutoLeftMs] = useState(0);

  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(0);

  const {
    data: cards = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["cards", deckId],
    queryFn: () => fetchCards(deckId),
    refetchOnMount: "always",
    retry: 1,
  });

  function logout() {
    clearToken();
    nav("/login");
  }

  const status = error?.response?.status;
  if (isError && status === 401) {
    logout();
    return null;
  }

  const total = cards.length;

  const question = useMemo(() => {
    if (!cards.length) return null;
    const safeIndex = Math.min(idx, cards.length - 1);
    return buildQuestion(cards, safeIndex);
  }, [cards, idx]);

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

  function next() {
    clearTimers();
    setSelected(null);
    setIsCorrect(null);

    if (idx + 1 < total) setIdx(idx + 1);
    else setIdx(0); // loop MVP
  }

  function startAutoNext() {
    clearTimers();
    startedAtRef.current = Date.now();
    setAutoLeftMs(AUTO_NEXT_MS);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const left = Math.max(0, AUTO_NEXT_MS - elapsed);
      setAutoLeftMs(left);

      if (left <= 0) {
        // cleanup interval here to be safe
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, TICK_MS);

    timeoutRef.current = setTimeout(() => {
      next();
    }, AUTO_NEXT_MS);
  }

  function pick(choice) {
    if (!question) return;
    if (selected !== null) return;

    setSelected(choice);
    const ok = choice === question.correct;
    setIsCorrect(ok);

    if (ok) startAutoNext();
  }

  // cleanup when unmount
  useEffect(() => {
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoPct =
    autoLeftMs > 0
      ? Math.max(0, Math.min(100, (autoLeftMs / AUTO_NEXT_MS) * 100))
      : 0;

  return (
    <div className="study-shell">
      <header className="study-topbar">
        <Link className="study-brand" to="/">
          NHO-HOAI
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
            Deck #{deckId} • {total} cards
          </div>
        </div>

        {isLoading && <p>Loading cards...</p>}

        {!isLoading && !isError && total < 4 && total > 0 && (
          <div className="study-warn">
            Deck này đang có ít hơn 4 cards, đáp án nhiễu sẽ bị thiếu. Thêm
            cards để quiz ngon hơn.
          </div>
        )}

        {!isLoading && !isError && total === 0 && (
          <div className="study-empty">
            <p>Deck này chưa có cards.</p>
            <p>Hãy về Home → Edit course → thêm words trước nhé.</p>
            <Link className="study-link" to="/">
              Go Home
            </Link>
          </div>
        )}

        {isError && status !== 401 && (
          <p style={{ color: "crimson" }}>
            Failed to load cards: {String(error?.message || "")}
          </p>
        )}

        {!isLoading && !isError && question && (
          <div className="study-card">
            <div className="study-progress">
              Question {Math.min(idx + 1, total)} / {total}
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
                    key={c}
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

                {/* ✅ progress bar only when correct */}
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

            {/* ✅ only show Next when WRONG */}
            {selected !== null && isCorrect === false && (
              <div className="study-footer">
                <button className="study-next" onClick={next}>
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
