import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { saveToken } from "../lib/auth";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      const res = await api.post("/api/auth/login/", { username, password });
      saveToken(res.data.access); // ✅ IMPORTANT
      nav("/");
    } catch (e) {
      setErr("Login failed. Check username/password.");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>
        {err && <p style={{ color: "crimson" }}>{err}</p>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}
