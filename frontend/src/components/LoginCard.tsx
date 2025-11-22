import { FormEvent, useState } from "react";
import { forgotPassword, login } from "../api";
import { TokenResponse } from "../types";

interface Props {
  enableSso: boolean;
  onTokenReceived: (token: string, remember: boolean) => void;
  onSsoRequested?: () => void;
  busy?: boolean;
}

interface MessageState {
  type: "error" | "success";
  text: string;
}

export default function LoginCard({
  enableSso,
  onTokenReceived,
  onSsoRequested,
  busy = false,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);
  const [loading, setLoading] = useState(false);
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
      const data = await login({ email, password, remember: rememberMe });
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

  const isBusy = loading || busy;

  return (
    <div className="auth-card">
      <form onSubmit={handleLogin}>
        <label>
          Email
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
        <div className="auth-row">
          <label className="remember-me">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Remember me
          </label>
          <button type="button" className="link-button" onClick={handleForgotPassword} disabled={isBusy}>
            Forgot password?
          </button>
        </div>
        <button type="submit" disabled={isBusy}>
          {isBusy ? "Processing..." : "Sign in"}
        </button>
      </form>

      <button type="button" className="sso-button" onClick={handleSsoClick} disabled={isBusy}>
        <span>Sign in with SSO</span>
      </button>

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
    </div>
  );
}
