import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import LoginCard from "./components/LoginCard";
import { fetchConfig, fetchProfile, getSsoLoginUrl } from "./api";
import { AuthConfig, UserProfile } from "./types";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Home() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchConfig()
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load configuration");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("farmwith_token");
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      sessionStorage.removeItem("farmwith_token");
      return;
    }
    sessionStorage.setItem("farmwith_token", token);
    fetchProfile(token)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [token]);

  const handleSso = () => {
    window.location.href = getSsoLoginUrl();
  };

  if (loading) {
    return <main>Loading authentication configuration...</main>;
  }

  if (error) {
    return (
      <main>
        <div className="alert error">{error}</div>
      </main>
    );
  }

  return (
    <main>
      <div className="card-grid">
        <LoginCard variant="buyer" enableSso={false} onTokenReceived={setToken} />
        <LoginCard
          variant="enterprise"
          enableSso={Boolean(config?.enable_sso)}
          onTokenReceived={setToken}
          onSsoRequested={handleSso}
        />
      </div>
      {token && profile && (
        <div className="card" style={{ marginTop: "2rem" }}>
          <h2>Session</h2>
          <p>
            Logged in as <strong>{profile.email}</strong>
          </p>
          <p>Account type: {profile.is_enterprise ? "Enterprise" : "Buyer"}</p>
          <p>MFA enabled: {profile.mfa_enabled ? "Yes" : "No"}</p>
          <button onClick={() => setToken(null)}>Clear session</button>
        </div>
      )}
    </main>
  );
}

function SsoCallback() {
  const navigate = useNavigate();
  const query = useQuery();
  const token = query.get("token");

  useEffect(() => {
    if (token) {
      sessionStorage.setItem("farmwith_token", token);
    }
    navigate("/", { replace: true });
  }, [token, navigate]);

  return (
    <main>
      <div className="card">
        <h2>Completing SSO...</h2>
        <p>You will be redirected shortly.</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sso/callback" element={<SsoCallback />} />
    </Routes>
  );
}
