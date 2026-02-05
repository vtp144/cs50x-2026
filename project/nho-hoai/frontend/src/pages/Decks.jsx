import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { clearToken } from "../lib/auth";

function fetchDecks() {
  return api.get("/api/decks/").then((r) => r.data);
}

export default function Decks() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("ja");

  const { data, isLoading, error } = useQuery({
    queryKey: ["decks"],
    queryFn: fetchDecks,
  });

  const createDeck = useMutation({
    mutationFn: (payload) =>
      api.post("/api/decks/", payload).then((r) => r.data),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["decks"] });
    },
  });

  return (
    <div style={{ maxWidth: 800, margin: "40px auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>My Decks</h2>
        <button
          onClick={() => {
            clearToken();
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 12,
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <h3>Create deck</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
          >
            <option value="en">en</option>
            <option value="ja">ja</option>
          </select>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
          >
            <option value="ja">ja</option>
            <option value="en">en</option>
          </select>
          <button
            onClick={() =>
              createDeck.mutate({
                title,
                source_lang: sourceLang,
                target_lang: targetLang,
              })
            }
            disabled={!title.trim() || createDeck.isPending}
          >
            Create
          </button>
        </div>
        {createDeck.isError && (
          <p style={{ color: "crimson" }}>Create failed.</p>
        )}
      </div>

      {isLoading && <p>Loading...</p>}
      {error && <p style={{ color: "crimson" }}>Failed to load decks.</p>}

      <ul>
        {(data || []).map((d) => (
          <li key={d.id} style={{ marginBottom: 8 }}>
            <Link to={`/decks/${d.id}`}>
              {d.title} ({d.source_lang}→{d.target_lang}) — {d.cards_count}{" "}
              cards
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
