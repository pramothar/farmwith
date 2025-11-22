import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import LoginCard from "./components/LoginCard";
import { fetchConfig, fetchProfile, getSsoLoginUrl } from "./api";
import { AuthConfig, UserProfile } from "./types";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function Spotlight() {
  const highlights = [
    "Custodial farming tailored for Indian crops, dairy, and aquaculture.",
    "Transparent monitoring with weekly health notes and payout schedules.",
    "Local agronomists, vetted vendors, and weather-aware task planning.",
  ];

  return (
    <section className="hero">
      <div>
        <span className="pill">Custodial Farming • India-first</span>
        <h1>FarmWith keeps your projects productive and visible.</h1>
        <p>
          Set up managed farm or livestock contracts, follow progress in real time,
          and keep investors informed without living in spreadsheets or chat threads.
        </p>
        <div className="highlight-list">
          {highlights.map((item) => (
            <div key={item} className="highlight">
              <span>✓</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Dashboard({ profile }: { profile: UserProfile }) {
  const stats = [
    { label: "Active contracts", value: "6", detail: "Fruits • Dairy • Poultry" },
    { label: "Capital at work", value: "₹48.6L", detail: "Across 3 states" },
    { label: "Next payout", value: "15 Mar", detail: "Turmeric & dairy cycle" },
    { label: "Field visits", value: "2 scheduled", detail: "Mysuru, Coimbatore" },
  ];

  const actions = [
    {
      title: "Track crop health",
      body: "Weekly notes on rainfall, soil vitals, pest control, and irrigation cadence.",
      cta: "Open crop journal",
    },
    {
      title: "Livestock care",
      body: "Monitor feed, vaccinations, and yield trends for dairy and poultry batches.",
      cta: "View husbandry log",
    },
    {
      title: "Investor updates",
      body: "One-click WhatsApp/email recaps with photos, expenses, and payout status.",
      cta: "Prepare update",
    },
    {
      title: "Marketplace sourcing",
      body: "Source seeds, feed, and equipment from vetted vendors with doorstep delivery.",
      cta: "Browse vendors",
    },
  ];

  const quickWins = [
    "Soil testing reminders and mandal-wise weather alerts.",
    "FPO / cooperative friendly documentation for compliance.",
    "UPI-friendly payouts with TDS-ready summaries.",
  ];

  return (
    <section className="dashboard">
      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2>{profile.email}</h2>
            <p className="helper">Keep tabs on every farm contract in one place.</p>
          </div>
          <div className="badge">Live beta</div>
        </div>
        <div className="stat-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
              <p className="stat-detail">{stat.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section-grid">
        {actions.map((action) => (
          <div key={action.title} className="section-card">
            <p className="eyebrow">Workflow</p>
            <h3>{action.title}</h3>
            <p className="helper">{action.body}</p>
            <button type="button" className="ghost">{action.cta}</button>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">What we’ll build next</p>
            <h3>India-first conveniences for your operators and investors</h3>
          </div>
        </div>
        <div className="highlight-list compact">
          {quickWins.map((item) => (
            <div key={item} className="highlight">
              <span>•</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardPage({ profile }: { profile: UserProfile }) {
  return (
    <main className="page">
      <Spotlight />
      <Dashboard profile={profile} />
    </main>
  );
}

function LoginPage({
  loading,
  error,
  enableSso,
  onTokenReceived,
  onSsoRequested,
}: {
  loading: boolean;
  error: string | null;
  enableSso: boolean;
  onTokenReceived: (token: string, remember: boolean) => void;
  onSsoRequested: () => void;
}) {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="auth-panel">
          <div>
            <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
              Welcome back
            </p>
            <h1 className="auth-title">FarmWith</h1>
            <p className="helper">
              Sign in to manage custodial farming projects and payouts for your investors.
            </p>
          </div>

          <LoginCard
            enableSso={enableSso}
            onTokenReceived={onTokenReceived}
            onSsoRequested={onSsoRequested}
            busy={loading}
          />

          {error && <div className="alert error">{error}</div>}
        </div>

        <div className="auth-illustration">
          <div className="auth-illustration-card">
            <img
              src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80"
              alt="Farmer walking through a green field at sunrise"
            />
            <div className="auth-quote">
              <p>
                “Custodial farming lets investors back Indian agriculture confidently while
                on-ground teams handle the operations.”
              </p>
              <span>– FarmWith</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SsoCallback({ onTokenReceived }: { onTokenReceived: (token: string) => void }) {
  const navigate = useNavigate();
  const query = useQuery();
  const token = query.get("token");

  useEffect(() => {
    if (token) {
      onTokenReceived(token);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [token, navigate, onTokenReceived]);

  return (
    <main className="page">
      <div className="card">
        <h2>Completing SSO...</h2>
        <p>You will be redirected shortly.</p>
      </div>
    </main>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    fetchConfig()
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => {
        setConfigError(err instanceof Error ? err.message : "Unable to load configuration");
      })
      .finally(() => setConfigLoading(false));
  }, []);

  useEffect(() => {
    const storedPersistent = localStorage.getItem("farmwith_token");
    if (storedPersistent) {
      setToken(storedPersistent);
      setRemembered(true);
      return;
    }

    const storedSession = sessionStorage.getItem("farmwith_token");
    if (storedSession) {
      setToken(storedSession);
      setRemembered(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      sessionStorage.removeItem("farmwith_token");
      localStorage.removeItem("farmwith_token");
      return;
    }

    if (remembered) {
      localStorage.setItem("farmwith_token", token);
      sessionStorage.removeItem("farmwith_token");
    } else {
      sessionStorage.setItem("farmwith_token", token);
      localStorage.removeItem("farmwith_token");
    }
  }, [token, remembered]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setProfileLoading(true);
    fetchProfile(token)
      .then((data) => {
        setProfile(data);
      })
      .catch(() => {
        setProfile(null);
        setToken(null);
        sessionStorage.removeItem("farmwith_token");
        localStorage.removeItem("farmwith_token");
        navigate("/login", { replace: true });
      })
      .finally(() => setProfileLoading(false));
  }, [token, navigate]);

  const handleToken = (newToken: string, remember: boolean) => {
    setRemembered(remember);
    setToken(newToken);
    navigate("/dashboard", { replace: true });
  };

  const handleSso = () => {
    window.location.href = getSsoLoginUrl();
  };

  const handleSsoCallbackToken = (newToken: string) => {
    setRemembered(false);
    setToken(newToken);
  };

  const isAuthenticated = useMemo(() => Boolean(token && profile), [token, profile]);

  return (
    <Routes>
      <Route
        path="/login"
        element=
          {
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage
                loading={configLoading || profileLoading}
                error={configError}
                enableSso={Boolean(config?.enable_sso)}
                onTokenReceived={handleToken}
                onSsoRequested={handleSso}
              />
            )
          }
      />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <DashboardPage profile={profile as UserProfile} />
          ) : configLoading ? (
            <main className="page">
              <div className="card">Loading your session...</div>
            </main>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/sso/callback"
        element={<SsoCallback onTokenReceived={handleSsoCallbackToken} />}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
