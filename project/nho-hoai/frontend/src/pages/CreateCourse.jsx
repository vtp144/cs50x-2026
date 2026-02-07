import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { clearToken } from "../lib/auth";
import "./createCourse.css";

const LANGS = [
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "vi", label: "Vietnamese" },
  { value: "km", label: "Khmer" },
];

export default function CreateCourse() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [teaching, setTeaching] = useState("");
  const [forLang, setForLang] = useState("en");

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 && teaching && forLang && teaching !== forLang
    );
  }, [name, teaching, forLang]);

  const createDeck = useMutation({
    mutationFn: (payload) =>
      api.post("/api/decks/", payload).then((r) => r.data),
    onSuccess: () => nav("/"),
  });

  function logout() {
    clearToken();
    nav("/login");
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    createDeck.mutate({
      title: name.trim(),
      source_lang: teaching,
      target_lang: forLang,
    });
  }

  return (
    <div className="cc-shell">
      <header className="cc-topbar">
        <Link className="cc-brand" to="/">
          NHỚ HOÀI
        </Link>

        <div className="cc-actionsTop">
          <Link className="cc-topBtn" to="/">
            Home
          </Link>
          <button className="cc-topBtn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="cc-main">
        <h1 className="cc-title">Create a Course</h1>

        <section className="cc-card">
          <form onSubmit={onSubmit} className="cc-form">
            <div className="cc-row">
              <label className="cc-label">Name</label>
              <div className="cc-field">
                <input
                  className="cc-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="cc-row">
              <label className="cc-label">Teaching</label>
              <div className="cc-field">
                <select
                  className="cc-select"
                  value={teaching}
                  onChange={(e) => setTeaching(e.target.value)}
                >
                  <option value="">Please select one...</option>
                  {LANGS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="cc-row">
              <label className="cc-label">For</label>
              <div className="cc-field cc-inline">
                <select
                  className="cc-select"
                  value={forLang}
                  onChange={(e) => setForLang(e.target.value)}
                >
                  {LANGS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <span className="cc-inlineText">speakers</span>
              </div>
            </div>

            {teaching && forLang && teaching === forLang && (
              <div className="cc-error">
                source_lang và target_lang phải khác nhau.
              </div>
            )}

            {createDeck.isError && (
              <div className="cc-error">
                Create failed. Check API / token / server.
              </div>
            )}

            <div className="cc-actions">
              <button
                type="submit"
                className="cc-button"
                disabled={!canSubmit || createDeck.isPending}
              >
                {createDeck.isPending ? "Creating..." : "Create Course"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
