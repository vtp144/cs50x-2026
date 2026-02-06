import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { clearToken } from "../lib/auth";
import "./editCourse.css";

function fetchDeck(deckId) {
  return api.get(`/api/decks/${deckId}/`).then((r) => r.data);
}
function fetchCards(deckId) {
  return api.get(`/api/decks/${deckId}/cards/`).then((r) => r.data);
}

export default function EditCourse() {
  const { id } = useParams();
  const deckId = Number(id);
  const nav = useNavigate();
  const qc = useQueryClient();

  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");

  function logout() {
    clearToken();
    nav("/login");
  }

  const deckQ = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => fetchDeck(deckId),
    refetchOnMount: "always",
    retry: 1,
  });

  const cardsQ = useQuery({
    queryKey: ["cards", deckId],
    queryFn: () => fetchCards(deckId),
    refetchOnMount: "always",
    retry: 1,
  });

  // auto logout nếu token invalid
  const status =
    deckQ.error?.response?.status || cardsQ.error?.response?.status;
  if ((deckQ.isError || cardsQ.isError) && status === 401) {
    logout();
    return null;
  }

  const canAdd = useMemo(() => term.trim() && meaning.trim(), [term, meaning]);

  const addCard = useMutation({
    mutationFn: (payload) =>
      api.post(`/api/decks/${deckId}/cards/`, payload).then((r) => r.data),
    onSuccess: () => {
      setTerm("");
      setMeaning("");
      qc.invalidateQueries({ queryKey: ["cards", deckId] });
      qc.invalidateQueries({ queryKey: ["decks"] }); // update cards_count on home
      qc.invalidateQueries({ queryKey: ["deck", deckId] });
    },
  });

  return (
    <div className="edit-shell">
      <header className="edit-topbar">
        <div className="edit-brand">NHO-HOAI</div>

        <div className="edit-actions">
          <Link className="edit-btn" to="/">
            Home
          </Link>
          <button className="edit-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="edit-main">
        <div className="edit-head">
          <div>
            <h1 className="edit-title">
              {deckQ.isLoading
                ? "Loading..."
                : deckQ.data?.title || "Edit Course"}
            </h1>
            <div className="edit-sub">
              {deckQ.data ? (
                <>
                  {deckQ.data.source_lang} → {deckQ.data.target_lang}
                  <span className="dot">•</span>
                  {deckQ.data.cards_count ?? cardsQ.data?.length ?? 0} cards
                </>
              ) : (
                " "
              )}
            </div>
          </div>

          <button
            className="edit-study"
            onClick={() => nav(`/decks/${deckId}/study`)}
            type="button"
          >
            Study →
          </button>
        </div>

        <section className="edit-card">
          <h2 className="section-title">Add words</h2>

          <div className="grid">
            <div>
              <div className="label">Word</div>
              <input
                className="input"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. apple / りんご"
              />
            </div>

            <div>
              <div className="label">Definition</div>
              <input
                className="input"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                placeholder="e.g. りんご / apple"
              />
            </div>

            <div className="actionsCol">
              <button
                className="addBtn"
                onClick={() => addCard.mutate({ term, meaning })}
                disabled={!canAdd || addCard.isPending}
                type="button"
              >
                {addCard.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>

          {addCard.isError && (
            <div className="err">Add failed. Check backend / validation.</div>
          )}
        </section>

        <section className="edit-card">
          <h2 className="section-title">Words</h2>

          {cardsQ.isLoading && <p>Loading cards...</p>}
          {cardsQ.isError && status !== 401 && (
            <p className="err">Failed to load cards.</p>
          )}

          {!cardsQ.isLoading &&
            !cardsQ.isError &&
            (cardsQ.data?.length ?? 0) === 0 && (
              <p style={{ opacity: 0.75 }}>
                No words yet. Add your first word above.
              </p>
            )}

          {!cardsQ.isLoading &&
            !cardsQ.isError &&
            (cardsQ.data || []).length > 0 && (
              <div className="table">
                <div className="thead">
                  <div>Word</div>
                  <div>Definition</div>
                </div>
                {(cardsQ.data || []).map((c) => (
                  <div key={c.id} className="trow">
                    <div className="cell strong">{c.term}</div>
                    <div className="cell">{c.meaning}</div>
                  </div>
                ))}
              </div>
            )}
        </section>
      </main>
    </div>
  );
}
