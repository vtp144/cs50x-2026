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

  // ✅ inline edit state
  const [editingId, setEditingId] = useState(null);
  const [draftTerm, setDraftTerm] = useState("");
  const [draftMeaning, setDraftMeaning] = useState("");

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
      qc.invalidateQueries({ queryKey: ["decks"] });
      qc.invalidateQueries({ queryKey: ["deck", deckId] });
    },
  });

  const updateCard = useMutation({
    mutationFn: ({ cardId, term, meaning }) =>
      api.patch(`/api/cards/${cardId}/`, { term, meaning }).then((r) => r.data),
    onSuccess: () => {
      setEditingId(null);
      setDraftTerm("");
      setDraftMeaning("");
      qc.invalidateQueries({ queryKey: ["cards", deckId] });
    },
  });

  function startEdit(card) {
    setEditingId(card.id);
    setDraftTerm(card.term || "");
    setDraftMeaning(card.meaning || "");
  }

  const canSave = useMemo(() => {
    if (!editingId) return false;
    return draftTerm.trim().length > 0 && draftMeaning.trim().length > 0;
  }, [editingId, draftTerm, draftMeaning]);

  function saveEdit() {
    if (!editingId) return;
    if (!canSave) return;
    updateCard.mutate({
      cardId: editingId,
      term: draftTerm.trim(),
      meaning: draftMeaning.trim(),
    });
  }

  return (
    <div className="edit-shell">
      <header className="edit-topbar">
        <Link className="edit-brand" to="/">
          NHO-HOAI
        </Link>

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

          {updateCard.isError && (
            <div className="err">Update failed. Check API / permission.</div>
          )}

          {!cardsQ.isLoading &&
            !cardsQ.isError &&
            (cardsQ.data || []).length > 0 && (
              <div className="table">
                <div className="thead thead3">
                  <div>Word</div>
                  <div>Definition</div>
                  <div className="right">OK</div>
                </div>

                {(cardsQ.data || []).map((c) => {
                  const isEditing = editingId === c.id;

                  return (
                    <div
                      key={c.id}
                      className={`trow trow3 ${isEditing ? "editing" : ""}`}
                    >
                      {/* Word cell */}
                      <div
                        className={`cell editable ${isEditing ? "" : "hoverable"}`}
                        onClick={() => !isEditing && startEdit(c)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isEditing) startEdit(c);
                        }}
                        title={!isEditing ? "Click to edit" : ""}
                      >
                        {isEditing ? (
                          <input
                            className="rowInput"
                            value={draftTerm}
                            onChange={(e) => setDraftTerm(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className="strong">{c.term}</span>
                        )}
                      </div>

                      {/* Definition cell */}
                      <div
                        className={`cell editable ${isEditing ? "" : "hoverable"}`}
                        onClick={() => !isEditing && startEdit(c)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isEditing) startEdit(c);
                        }}
                        title={!isEditing ? "Click to edit" : ""}
                      >
                        {isEditing ? (
                          <input
                            className="rowInput"
                            value={draftMeaning}
                            onChange={(e) => setDraftMeaning(e.target.value)}
                          />
                        ) : (
                          <span>{c.meaning}</span>
                        )}
                      </div>

                      {/* OK button */}
                      <div className="cell right">
                        {isEditing ? (
                          <button
                            className="okBtn"
                            type="button"
                            onClick={saveEdit}
                            disabled={!canSave || updateCard.isPending}
                          >
                            {updateCard.isPending ? "..." : "OK"}
                          </button>
                        ) : (
                          <button
                            className="okBtn ghost"
                            type="button"
                            onClick={() => startEdit(c)}
                            title="Edit"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </section>
      </main>
    </div>
  );
}
