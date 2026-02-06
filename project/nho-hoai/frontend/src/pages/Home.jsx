import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { clearToken } from "../lib/auth";
import "./home.css";

function fetchDecks() {
  return api.get("/api/decks/").then((r) => r.data);
}

export default function Home() {
  const nav = useNavigate();

  const {
    data: decks = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["decks"],
    queryFn: fetchDecks,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
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

  const [openMenuDeckId, setOpenMenuDeckId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpenMenuDeckId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="home-shell">
      <header className="home-topbar">
        {/* ✅ brand click -> home */}
        <Link className="home-brand" to="/">
          NHỚ HOÀI
        </Link>

        <div className="home-actions">
          <Link className="home-btn home-btnPrimary" to="/courses/create">
            + Create a course
          </Link>
          <button className="home-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="home-main">
        <div className="home-titleRow">
          <h1 className="home-title">All Courses</h1>

          <button
            onClick={() => refetch()}
            className="home-refresh"
            type="button"
          >
            Refresh
          </button>
        </div>

        {isLoading && <p>Loading...</p>}

        {isError && status !== 401 && (
          <div style={{ color: "crimson" }}>
            <p>Failed to load courses.</p>
            <p style={{ opacity: 0.7, fontSize: 13 }}>
              {String(error?.message || "")}
            </p>
          </div>
        )}

        {!isLoading && !isError && decks.length === 0 && (
          <div style={{ opacity: 0.8 }}>
            <p>You have no courses yet.</p>
            <p>
              Click <b>Create a course</b> to make your first deck.
            </p>
          </div>
        )}

        <div className="home-courses">
          {decks.map((d) => {
            const isOpen = openMenuDeckId === d.id;

            return (
              <div
                key={d.id}
                className="course-card"
                role="button"
                tabIndex={0}
                onClick={() => nav(`/decks/${d.id}/study`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") nav(`/decks/${d.id}/study`);
                }}
              >
                <div className="course-left">
                  <div className="course-badge">✓</div>
                </div>

                <div className="course-mid">
                  <div className="course-name">{d.title}</div>

                  <div className="course-meta">
                    <span className="course-strong">
                      {d.source_lang} → {d.target_lang}
                    </span>
                    <span className="course-dot">•</span>
                    <span>
                      <span className="course-strong">
                        {d.cards_count ?? 0}
                      </span>{" "}
                      cards
                    </span>
                  </div>

                  <div className="course-progress">
                    <div
                      className="course-progressBar"
                      style={{ width: "0%" }}
                    />
                  </div>

                  <div className="course-hint">
                    Click card to study • Use ⋮ to edit
                  </div>
                </div>

                <div className="course-right">
                  <button
                    type="button"
                    className="kebab"
                    aria-label="Course menu"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuDeckId(isOpen ? null : d.id);
                    }}
                  >
                    ⋮
                  </button>

                  {isOpen && (
                    <div
                      className="menu"
                      ref={menuRef}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="menu-item"
                        type="button"
                        onClick={() => {
                          setOpenMenuDeckId(null);
                          nav(`/decks/${d.id}/edit`);
                        }}
                      >
                        Edit course
                      </button>
                      <button
                        className="menu-item"
                        type="button"
                        onClick={() => {
                          setOpenMenuDeckId(null);
                          nav(`/decks/${d.id}/study`);
                        }}
                      >
                        Study
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
