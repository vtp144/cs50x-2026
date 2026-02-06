import { useMemo, useState } from "react";
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

export default function Study() {
  const { id } = useParams();
  const deckId = Number(id);
  const nav = useNavigate();

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);

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

  function pick(choice) {
    if (!question) return;
    if (selected !== null) return;

    setSelected(choice);
    setIsCorrect(choice === question.correct);
  }

  function next() {
    setSelected(null);
    setIsCorrect(null);

    if (idx + 1 < total) setIdx(idx + 1);
    else setIdx(0);
  }

  return (
    <div className="study-shell">
      <header className="study-topbar">
        {/* ✅ brand click -> home */}
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
                const correct = selected !== null && c === question.correct;
                const wrongPicked =
                  picked && selected !== null && c !== question.correct;

                let cls = "choice";
                if (picked) cls += " choice-picked";
                if (correct) cls += " choice-correct";
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
              </div>
            )}

            <div className="study-footer">
              <button
                className="study-next"
                onClick={next}
                disabled={selected === null}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
