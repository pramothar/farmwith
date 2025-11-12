import { FormEvent, useState } from "react";
import { initiateMfa, login, register, verifyMfa } from "../api";
import { TokenResponse } from "../types";

type LoginVariant = "buyer" | "enterprise";

interface Props {
  variant: LoginVariant;
  enableSso: boolean;
  onTokenReceived: (token: string) => void;
  onSsoRequested?: () => void;
}

interface MessageState {
  type: "error" | "success";
  text: string;
}

export default function LoginCard({ variant, enableSso, onTokenReceived, onSsoRequested }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [message, setMessage] = useState<MessageState | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);

  const isEnterprise = variant === "enterprise";

  const resetMessage = () => setMessage(null);

  const handleAuthResponse = (data: TokenResponse) => {
    setToken(data.access_token);
    onTokenReceived(data.access_token);
    setMessage({ type: "success", text: "Authenticated successfully" });
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    resetMessage();
    setLoading(true);
    try {
      const data = await login({ email, password, totp_code: totpCode || undefined });
      handleAuthResponse(data);
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Unable to login";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    resetMessage();
    setLoading(true);
    try {
      await register({ email, password, is_enterprise: isEnterprise });
      setMessage({ type: "success", text: "Account created. You can login now." });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Unable to register";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateMfa = async () => {
    if (!token) {
      setMessage({ type: "error", text: "Login to initialize MFA." });
      return;
    }
    resetMessage();
    setLoading(true);
    try {
      const response = await initiateMfa(token);
      setMfaSecret(response.secret);
      setOtpauthUrl(response.otpauth_url);
      setMessage({ type: "success", text: "Scan the QR or add the secret to your authenticator." });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Unable to setup MFA";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!token) {
      setMessage({ type: "error", text: "Login first to verify MFA." });
      return;
    }
    if (!totpCode) {
      setMessage({ type: "error", text: "Enter a one-time password." });
      return;
    }
    resetMessage();
    setLoading(true);
    try {
      const response = await verifyMfa(token, totpCode);
      setMessage({ type: "success", text: response.detail || "MFA enabled." });
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Unable to verify MFA";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const title = isEnterprise ? "Enterprise buyer login" : "Buyer login";
  const description = isEnterprise
    ? enableSso
      ? "Sign in with your enterprise credentials. Choose password + MFA or use single sign-on."
      : "Sign in with password + MFA." 
    : "Sign in using email, password and your authenticator app.";

  return (
    <div className="card">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
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
        <label>
          MFA one-time password
          <input
            value={totpCode}
            onChange={(event) => setTotpCode(event.target.value)}
            type="text"
            placeholder="123456"
            inputMode="numeric"
          />
          <span className="helper">Required after you enable MFA.</span>
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Login"}
        </button>
      </form>
      <button type="button" onClick={handleRegister} disabled={loading}>
        {loading ? "Processing..." : "Register"}
      </button>

      <div>
        <button type="button" onClick={handleInitiateMfa} disabled={loading || !token}>
          Generate MFA secret
        </button>
        <button type="button" onClick={handleVerifyMfa} disabled={loading || !token}>
          Verify MFA code
        </button>
        {mfaSecret && (
          <div className="helper">
            Secret: <strong>{mfaSecret}</strong>
            <br />
            {otpauthUrl && (
              <a href={otpauthUrl} target="_blank" rel="noreferrer">
                Open in authenticator
              </a>
            )}
          </div>
        )}
      </div>

      {isEnterprise && enableSso && onSsoRequested && (
        <button type="button" onClick={onSsoRequested} disabled={loading}>
          Continue with single sign-on
        </button>
      )}

      {message && <div className={`alert ${message.type}`}>{message.text}</div>}
    </div>
  );
}
