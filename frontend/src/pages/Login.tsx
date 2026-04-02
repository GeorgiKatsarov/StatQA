import { useState } from "react";

interface LoginProps {
  mode: "login" | "register";
  loading: boolean;
  error: string;
  onModeChange: (mode: "login" | "register") => void;
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function Login({ mode, loading, error, onModeChange, onSubmit }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Authenticated product UI</p>
        <h1>{mode === "login" ? "Sign in to StatQA" : "Create your StatQA account"}</h1>
        <div className="auth-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>
            Register
          </button>
        </div>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" disabled={loading} onClick={() => void onSubmit(email, password)}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
      </section>
    </main>
  );
}

