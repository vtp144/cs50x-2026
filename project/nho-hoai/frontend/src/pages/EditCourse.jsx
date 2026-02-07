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
  const [note, setNote] = useState("");

  // inline edit state
  const [editingId, setEditingId] = useState(null);
  const [draftTerm, setDraftTerm] = useState("");
  const [draftMeaning, setDraftMeaning] = useState("");
  const [draftNote, setDraftNote] = useState("");

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
      setNote("");
      qc.invalidateQueries({ queryKey: ["cards", deckId] });
      qc.invalidateQueries({ queryKey: ["decks"] });
      qc.invalidateQueries({ queryKey: ["deck", deckId] });
    },
  });

  const updateCard = useMutation({
    mutationFn: ({ cardId, term, meaning, note }) =>
      api
        .patch(`/api/cards/${cardId}/`, { term, meaning, note })
        .then((r) => r.data),
    onSuccess: () => {
      setEditingId(null);
      setDraftTerm("");
      setDraftMeaning("");
      setDraftNote("");
      qc.invalidateQueries({ queryKey: ["cards", deckId] });
    },
  });

  const deleteCard = useMutation({
    mutationFn: (cardId) =>
      api.delete(`/api/cards/${cardId}/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards", deckId] });
      qc.invalidateQueries({ queryKey: ["decks"] });
      qc.invalidateQueries({ queryKey: ["deck", deckId] });
    },
  });

  function startEdit(card) {
    setEditingId(card.id);
    setDraftTerm(card.term || "");
    setDraftMeaning(card.meaning || "");
    setDraftNote(card.note || "");
  }

  const canSave = useMemo(() => {
    if (!editingId) return false;
    return draftTerm.trim().length > 0 && draftMeaning.trim().length > 0;
  }, [editingId, draftTerm, draftMeaning]);

  function saveEdit() {
    if (!editingId || !canSave) return;
    updateCard.mutate({
      cardId: editingId,
      term: draftTerm.trim(),
      meaning: draftMeaning.trim(),
      note: draftNote, // note can be empty
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

        {/* Add words */}
        <section className="edit-card">
          <h2 className="section-title">Add words</h2>

          <div className="grid grid3">
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

            <div>
              <div className="label">Note</div>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. quả màu đỏ tròn, vị chua ngọt"
              />
            </div>
          </div>

          <button
            className="addBtn addWide"
            onClick={() => addCard.mutate({ term, meaning, note })}
            disabled={!canAdd || addCard.isPending}
            type="button"
          >
            {addCard.isPending ? "Adding..." : "Add"}
          </button>

          {addCard.isError && (
            <div className="err">Add failed. Check backend / validation.</div>
          )}
        </section>

        {/* Words table */}
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
                <div className="thead thead4">
                  <div>Word</div>
                  <div>Definition</div>
                  <div>Note</div>
                  <div className="right">Actions</div>
                </div>

                {(cardsQ.data || []).map((c) => {
                  const isEditing = editingId === c.id;

                  return (
                    <div
                      key={c.id}
                      className={`trow trow4 ${isEditing ? "editing" : ""}`}
                    >
                      {/* Word */}
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

                      {/* Definition */}
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

                      {/* Note */}
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
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            placeholder="(optional)"
                          />
                        ) : (
                          <span style={{ opacity: c.note ? 1 : 0.55 }}>
                            {c.note || "—"}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="cell right">
                        <div className="rowActions">
                          {isEditing ? (
                            <>
                              <button
                                className="okBtn"
                                type="button"
                                onClick={saveEdit}
                                disabled={!canSave || updateCard.isPending}
                              >
                                {updateCard.isPending ? "..." : "OK"}
                              </button>

                              <button
                                className="delBtn"
                                type="button"
                                onClick={() => {
                                  const ok = window.confirm(
                                    `Delete this word?\n\n${c.term} → ${c.meaning}`,
                                  );
                                  if (!ok) return;
                                  deleteCard.mutate(c.id);
                                }}
                                disabled={deleteCard.isPending}
                                title="Delete"
                              >
                                {deleteCard.isPending ? "..." : "🗑"}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="okBtn ghost"
                                type="button"
                                onClick={() => startEdit(c)}
                                title="Edit"
                              >
                                ✎
                              </button>
                              <button
                                className="delBtn ghost"
                                type="button"
                                onClick={() => {
                                  const ok = window.confirm(
                                    `Delete this word?\n\n${c.term} → ${c.meaning}`,
                                  );
                                  if (!ok) return;
                                  deleteCard.mutate(c.id);
                                }}
                                disabled={deleteCard.isPending}
                                title="Delete"
                              >
                                🗑
                              </button>
                            </>
                          )}
                        </div>
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
