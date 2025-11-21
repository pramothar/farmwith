import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
          and keep investors informed without living in spreadsheets or chat
          threads.
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

function Home() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [remembered, setRemembered] = useState(false);
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
    fetchProfile(token)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [token, remembered]);

  const handleSso = () => {
    window.location.href = getSsoLoginUrl();
  };

  const handleToken = (newToken: string, remember: boolean) => {
    setRemembered(remember);
    setToken(newToken);
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
    <main className="page">
      <Spotlight />

      <div className="card-grid" style={{ marginTop: "2rem" }}>
        <LoginCard
          enableSso={Boolean(config?.enable_sso)}
          onTokenReceived={handleToken}
          onSsoRequested={handleSso}
        />
        <div className="card">
          <h2>Why FarmWith?</h2>
          <p className="helper">
            Built for Indian farms, cooperatives, and family offices that need a trusted
            operator to manage on-ground tasks while keeping investors informed.
          </p>
          <ul className="feature-list">
            <li>Milestone-based payouts for crops, dairy, poultry, and aqua.</li>
            <li>Vendor and labor tracking with GST-aware expense logs.</li>
            <li>Satellite + field photo galleries to show harvest progress.</li>
            <li>Support for WhatsApp/email notifications in English & Hindi.</li>
          </ul>
        </div>
      </div>

      {token && profile && <Dashboard profile={profile} />}
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
