import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { clearToken } from "../lib/auth";
import "./createCourse.css";

export default function CreateCourse() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [teaching, setTeaching] = useState(""); // source_lang
  const [forLang, setForLang] = useState("en"); // target_lang

  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 && teaching && forLang && teaching !== forLang
    );
  }, [name, teaching, forLang]);

  const createDeck = useMutation({
    mutationFn: (payload) =>
      api.post("/api/decks/", payload).then((r) => r.data),
    onSuccess: () => {
      nav("/");
    },
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
        <div className="cc-brand">NHO-HOAI</div>

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

        <div className="cc-grid">
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
                  <div className="cc-help">
                    Naming your course well will help other learners find it.
                  </div>
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
                    <option value="en">English</option>
                    <option value="ja">Japanese</option>
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
                    <option value="en">English</option>
                    <option value="ja">Japanese</option>
                  </select>
                  <span className="cc-inlineText">speakers</span>
                </div>
              </div>

              <div className="cc-row">
                <label className="cc-label">Tags</label>
                <div className="cc-field">
                  <input
                    className="cc-input"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                  <div className="cc-help">
                    E.g. Japanese vocabulary, JLPT N5, travel phrases
                    <span className="cc-muted"> (chưa lưu backend)</span>
                  </div>
                </div>
              </div>

              <div className="cc-row">
                <label className="cc-label">Description</label>
                <div className="cc-field">
                  <textarea
                    className="cc-textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <div className="cc-help">
                    Keep the description of the course in the language of what
                    the learners speak.
                    <span className="cc-muted"> (chưa lưu backend)</span>
                  </div>
                </div>
              </div>

              <div className="cc-row">
                <label className="cc-label">Short description</label>
                <div className="cc-field">
                  <input
                    className="cc-input"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                  />
                  <div className="cc-help">
                    A short description for our apps.
                    <span className="cc-muted"> (chưa lưu backend)</span>
                  </div>
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

          <aside className="cc-side">
            <div className="cc-sideCard">
              <h3>Why create a course?</h3>
              <ul>
                <li>A quick list of personal facts to remember</li>
                <li>Share common content with your classmates/colleagues</li>
                <li>Share awesome teaching materials with the community!</li>
              </ul>

              <h4 className="cc-sideSubtitle">Need more help?</h4>
              <a
                className="cc-link"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                Check out the Course Creation knowledge base.
              </a>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
