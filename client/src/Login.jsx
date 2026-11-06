import { useState } from "react";
import { api } from "./api";
import { Icon } from "./components";

const ROLES = [
  { value: "patient", label: "Patient", icon: "user" },
  { value: "doctor", label: "Doctor", icon: "stethoscope" },
  { value: "admin", label: "Admin", icon: "shield" },
];

const EMPTY_FORM = { name: "", age: "", gender: "", phone: "", email: "", password: "" };

export default function Login({ onSignIn }) {
  const [mode, setMode] = useState("signin"); // "signin" or "register"
  const [role, setRole] = useState("patient");
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const roleLabel = ROLES.find((r) => r.value === role).label;

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (mode === "register" && !form.gender) return setError("Please select your gender.");

    setError("");
    setLoading(true);
    try {
      const user = mode === "register"
        ? await api("/register", "POST", form) // new accounts are always patients
        : await api("/login", "POST", { email: form.email, password: form.password, role });
      onSignIn(user);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo"><Icon name="plus" size={22} /></span>
          <div>
            <b>CareConnect</b>
            <small>Clinic appointment system</small>
          </div>
        </div>

        <div className="segmented full">
          <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => switchMode("signin")}>Sign in</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Create account</button>
        </div>

        <form key={mode} className="auth-form fade-in" onSubmit={handleSubmit}>
          {mode === "signin" ? (
            <>
              <p className="field-title">Sign in as</p>
              <div className="role-picker">
                {ROLES.map((r) => (
                  <button type="button" key={r.value}
                    className={"role-option" + (role === r.value ? " selected" : "")}
                    onClick={() => { setRole(r.value); setError(""); }}>
                    <span className="role-icon"><Icon name={r.icon} size={20} /></span>
                    {r.label}
                  </button>
                ))}
              </div>
              {role !== "patient" && (
                <p className="note"><Icon name="info" size={16} /> Use the email registered by the clinic. {roleLabel} accounts cannot be created here.</p>
              )}
            </>
          ) : (
            <p className="note"><Icon name="info" size={16} /> Only patients can create an account. Doctor and admin accounts are created by the clinic.</p>
          )}

          {error && <p className="alert error">{error}</p>}

          {mode === "register" && (
            <>
              <label>Full name
                <input name="name" value={form.name} onChange={update} placeholder="Your full name" required />
              </label>
              <div className="row">
                <label>Age
                  <input type="number" name="age" min="0" max="120" value={form.age} onChange={update} required />
                </label>
                <label>Mobile number
                  <input name="phone" value={form.phone} onChange={update} pattern="[0-9]{10}" title="10 digit mobile number" required />
                </label>
              </div>
              <div className="field">
                <span className="field-title">Gender</span>
                <div className="choice-row">
                  {["Female", "Male", "Other"].map((g) => (
                    <button type="button" key={g} className={"choice" + (form.gender === g ? " selected" : "")}
                      onClick={() => setForm({ ...form, gender: g })}>{g}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          <label>Email
            <input type="email" name="email" value={form.email} onChange={update} placeholder="name@example.com" required />
          </label>
          <label>Password
            <span className="password-field">
              <input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={update}
                minLength={mode === "register" ? 6 : undefined} required />
              <button type="button" className="eye" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}>
                <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
              </button>
            </span>
          </label>

          <button className="btn primary full" disabled={loading}>
            {loading ? "Please wait..." : mode === "register" ? "Create account" : `Sign in as ${roleLabel}`}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signin" ? "New patient? " : "Already have an account? "}
          <button type="button" className="link" onClick={() => switchMode(mode === "signin" ? "register" : "signin")}>
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
