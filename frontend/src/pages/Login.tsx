import { useMemo, useState } from "react";
import type { RegisterFormData } from "../lib/types";

interface LoginProps {
  mode: "login" | "register";
  loading: boolean;
  error: string;
  onModeChange: (mode: "login" | "register") => void;
  onSubmit: (payload: { email: string; password: string } | RegisterFormData) => Promise<void>;
}

const initialRegisterForm: RegisterFormData = {
  email: "",
  password: "",
  fullName: "",
  companyName: "",
  role: "",
  websiteUrl: "",
  useCase: "agency",
  teamSize: "2-5",
  marketingOptIn: false,
  acceptedTerms: false
};

function getPasswordChecks(password: string) {
  return [
    { label: "12+ characters", passed: password.length >= 12 },
    { label: "Upper and lowercase letters", passed: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "At least one number", passed: /[0-9]/.test(password) },
    { label: "At least one symbol", passed: /[^A-Za-z0-9]/.test(password) }
  ];
}

export function Login({ mode, loading, error, onModeChange, onSubmit }: LoginProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerForm, setRegisterForm] = useState<RegisterFormData>(initialRegisterForm);

  const passwordChecks = useMemo(() => getPasswordChecks(registerForm.password), [registerForm.password]);

  function updateRegisterForm<K extends keyof RegisterFormData>(key: K, value: RegisterFormData[K]) {
    setRegisterForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (mode === "login") {
      void onSubmit({ email: loginEmail, password: loginPassword });
      return;
    }

    void onSubmit(registerForm);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-wide">
        <div className="auth-hero">
          <p className="eyebrow">Secure QA workspace</p>
          <h1>{mode === "login" ? "Sign in to StatQA" : "Create your StatQA account"}</h1>
          <p>
            Run website audits, save evidence-backed reports, and turn findings into a prioritized remediation plan.
          </p>
        </div>

        <div className="auth-switch" role="tablist" aria-label="Authentication mode">
          <button className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>
            Register
          </button>
        </div>

        {mode === "login" ? (
          <div className="auth-form-grid">
            <label>
              Email
              <input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                type="email"
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </label>
          </div>
        ) : (
          <>
            <div className="auth-form-grid two-column">
              <label>
                Full name
                <input
                  value={registerForm.fullName}
                  onChange={(event) => updateRegisterForm("fullName", event.target.value)}
                  type="text"
                  autoComplete="name"
                />
              </label>
              <label>
                Work email
                <input
                  value={registerForm.email}
                  onChange={(event) => updateRegisterForm("email", event.target.value)}
                  type="email"
                  autoComplete="email"
                />
              </label>
              <label>
                Company
                <input
                  value={registerForm.companyName}
                  onChange={(event) => updateRegisterForm("companyName", event.target.value)}
                  type="text"
                  autoComplete="organization"
                />
              </label>
              <label>
                Role
                <input
                  value={registerForm.role}
                  onChange={(event) => updateRegisterForm("role", event.target.value)}
                  type="text"
                  autoComplete="organization-title"
                />
              </label>
              <label>
                Website to audit
                <input
                  value={registerForm.websiteUrl}
                  onChange={(event) => updateRegisterForm("websiteUrl", event.target.value)}
                  type="url"
                  placeholder="https://example.com"
                />
              </label>
              <label>
                Team size
                <select value={registerForm.teamSize} onChange={(event) => updateRegisterForm("teamSize", event.target.value)}>
                  <option value="solo">Solo</option>
                  <option value="2-5">2-5</option>
                  <option value="6-20">6-20</option>
                  <option value="21-100">21-100</option>
                  <option value="100+">100+</option>
                </select>
              </label>
              <label>
                Primary use case
                <select value={registerForm.useCase} onChange={(event) => updateRegisterForm("useCase", event.target.value)}>
                  <option value="agency">Agency client audits</option>
                  <option value="founder">Founder / product owner</option>
                  <option value="in-house">In-house marketing or product</option>
                  <option value="freelancer">Freelance website delivery</option>
                  <option value="qa">QA and release checks</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Password
                <input
                  value={registerForm.password}
                  onChange={(event) => updateRegisterForm("password", event.target.value)}
                  type="password"
                  autoComplete="new-password"
                />
              </label>
            </div>

            <ul className="password-checklist" aria-label="Password requirements">
              {passwordChecks.map((check) => (
                <li key={check.label} className={check.passed ? "passed" : ""}>
                  {check.label}
                </li>
              ))}
            </ul>

            <div className="auth-consents">
              <label className="checkbox-row">
                <input
                  checked={registerForm.marketingOptIn}
                  onChange={(event) => updateRegisterForm("marketingOptIn", event.target.checked)}
                  type="checkbox"
                />
                Send me product updates and launch resources.
              </label>
              <label className="checkbox-row">
                <input
                  checked={registerForm.acceptedTerms}
                  onChange={(event) => updateRegisterForm("acceptedTerms", event.target.checked)}
                  type="checkbox"
                />
                I agree to use StatQA only for websites I own or am authorized to test.
              </label>
            </div>
          </>
        )}

        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" disabled={loading} onClick={submit}>
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
        </button>
      </section>
    </main>
  );
}
