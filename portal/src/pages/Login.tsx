import { useState, type FormEvent } from "react";
import { api, type Session } from "../api";
import { useAuth } from "../auth";
import { ErrorText } from "../components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ company_name: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      signIn(await api<Session>(`/api/auth/${mode}`, { method: "POST", body }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div>
          <h1>AI Guard</h1>
          <p className="subtle">{mode === "login" ? "Sign in to your management portal." : "Create an organization."}</p>
        </div>
        {mode === "signup" && (
          <>
            <label className="field">Organization name<input required value={form.company_name} onChange={set("company_name")} /></label>
            <label className="field">Your name<input required value={form.name} onChange={set("name")} /></label>
          </>
        )}
        <label className="field">Email<input type="email" required autoComplete="email" value={form.email} onChange={set("email")} /></label>
        <label className="field">
          Password
          <input type="password" required minLength={mode === "signup" ? 10 : 1}
                 autoComplete={mode === "login" ? "current-password" : "new-password"}
                 value={form.password} onChange={set("password")} />
        </label>
        <ErrorText error={error} />
        <button className="primary" disabled={busy}>{mode === "login" ? "Sign in" : "Create organization"}</button>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "New here? Create an organization" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
