import { FormEvent, useState } from "react";
import { forgotPassword, login } from "../api";
import { TokenResponse } from "../types";

interface Props {
  enableSso: boolean;
  onTokenReceived: (token: string, remember: boolean) => void;
  onSsoRequested?: () => void;
}

interface MessageState {
  type: "error" | "success";
  text: string;
}

export default function LoginCard({ enableSso, onTokenReceived, onSsoRequested }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const resetMessage = () => setMessage(null);

  const handleAuthResponse = (data: TokenResponse) => {
    onTokenReceived(data.access_token, rememberMe);
    setMessage({ type: "success", text: "Authenticated successfully" });
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    resetMessage();
    setLoading(true);
    try {
      const data = await login({ email, password });
      handleAuthResponse(data);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Unable to login";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setMessage({ type: "error", text: "Enter your email to reset your password." });
      return;
    }
    resetMessage();
    setLoading(true);
    try {
      const response = await forgotPassword(email);
      setMessage({ type: "success", text: response.detail });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Unable to reset password";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleSsoClick = () => {
    if (enableSso && onSsoRequested) {
      onSsoRequested();
    } else {
      setMessage({ type: "error", text: "SSO not enabled for this organization" });
    }
  };

  return (
    <div className="card">
      <div>
        <h2>Login</h2>
        <p>Select how you want to sign in.</p>
      </div>

      <div className="button-row">
        <button type="button" onClick={() => setShowPasswordForm(true)} disabled={loading}>
          Sign in with username and password
        </button>
        <button type="button" onClick={handleSsoClick} disabled={loading}>
          Sign in with SSO
        </button>
      </div>

      {showPasswordForm && (
        <form onSubmit={handleLogin} style={{ marginTop: "1rem" }}>
          <label>
            Username (email)
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="you@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••••••"
              minLength={8}
              required
            />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              style={{ marginLeft: "auto" }}
            >
              Forgot password?
            </button>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Processing..." : "Login"}
          </button>
        </form>
      )}

      {message && <div className={`alert ${message.type}`} style={{ marginTop: "1rem" }}>{message.text}</div>}
    </div>
  );
}
