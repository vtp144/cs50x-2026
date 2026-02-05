import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

function fetchDeck(id) {
  return api.get(`/api/decks/${id}/`).then((r) => r.data);
}

function fetchCards(deckId) {
  return api.get(`/api/decks/${deckId}/cards/`).then((r) => r.data);
}

export default function DeckDetail() {
  const { id } = useParams();
  const deckId = Number(id);
  const qc = useQueryClient();

  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");

  const deckQ = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => fetchDeck(deckId),
  });
  const cardsQ = useQuery({
    queryKey: ["cards", deckId],
    queryFn: () => fetchCards(deckId),
  });

  const addCard = useMutation({
    mutationFn: (payload) =>
      api.post(`/api/decks/${deckId}/cards/`, payload).then((r) => r.data),
    onSuccess: () => {
      setTerm("");
      setMeaning("");
      qc.invalidateQueries({ queryKey: ["cards", deckId] });
      qc.invalidateQueries({ queryKey: ["decks"] }); // update cards_count
    },
  });

  return (
    <div style={{ maxWidth: 800, margin: "40px auto" }}>
      <p>
        <Link to="/decks">← Back</Link>
      </p>

      {deckQ.isLoading ? (
        <p>Loading deck...</p>
      ) : deckQ.isError ? (
        <p style={{ color: "crimson" }}>Deck not found / no permission.</p>
      ) : (
        <>
          <h2>{deckQ.data.title}</h2>
          <p>
            {deckQ.data.source_lang} → {deckQ.data.target_lang}
          </p>

          <div
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <h3>Add card</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                placeholder="term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
              <input
                placeholder="meaning"
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
              />
              <button
                onClick={() => addCard.mutate({ term, meaning })}
                disabled={!term.trim() || !meaning.trim() || addCard.isPending}
              >
                Add
              </button>
            </div>
            {addCard.isError && <p style={{ color: "crimson" }}>Add failed.</p>}
          </div>

          <h3>Cards</h3>
          {cardsQ.isLoading && <p>Loading cards...</p>}
          {cardsQ.isError && (
            <p style={{ color: "crimson" }}>Failed to load cards.</p>
          )}
          <ul>
            {(cardsQ.data || []).map((c) => (
              <li key={c.id} style={{ marginBottom: 6 }}>
                <b>{c.term}</b> — {c.meaning}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
