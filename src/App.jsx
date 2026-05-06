import { useState, useMemo, useCallback, useEffect } from "react";

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
// These come from environment variables — set them in .env.local (local dev)
// and in your Vercel project settings (production).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://xcjmefkzkfkposzrcwti.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";

// ── Supabase client (no npm needed — uses fetch directly) ─────────────────────
const sb = {
  headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  authHeaders: (token) => ({ "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json", "Authorization": `Bearer ${token}` }),

  async signUp(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method: "POST", headers: sb.headers, body: JSON.stringify({ email, password }) });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: sb.headers, body: JSON.stringify({ email, password }) });
    return r.json();
  },
  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: sb.authHeaders(token) });
  },
  async getUser(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: sb.authHeaders(token) });
    return r.json();
  },
  async select(token, table, filters = "") {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filters}&order=created_at.asc`, { headers: { ...sb.authHeaders(token), "Prefer": "return=representation" } });
    return r.json();
  },
  async insert(token, table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: { ...sb.authHeaders(token), "Prefer": "return=representation" }, body: JSON.stringify(data) });
    return r.json();
  },
  async update(token, table, id, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: { ...sb.authHeaders(token), "Prefer": "return=representation" }, body: JSON.stringify(data) });
    return r.json();
  },
  async remove(token, table, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers: sb.authHeaders(token) });
  },
  async upsert(token, table, data, onConflict) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, { method: "POST", headers: { ...sb.authHeaders(token), "Prefer": "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(data) });
    return r.json();
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = ["Marketing", "Supplies", "Labor", "Venue/Rent", "Food & Bev", "Equipment", "Other"];
const INCOME_CATEGORIES = ["Sales", "Event Revenue", "Services", "Refund", "Other Income"];
const EXPENSE_SOURCES = ["Owner's Cash", "Business Checking", "Business Credit Card", "Cash App", "PayPal", "Venmo", "Square", "Zelle", "Other"];
const INCOME_SOURCES = ["Cash", "Square", "Cash App", "PayPal", "Venmo", "Zelle", "Check", "Bank Transfer", "Other"];
const TABS = ["dashboard", "events", "transactions", "blueroots", "breakeven", "inventory", "goals", "bestsellers", "whatif"];
const PRIMARY_TABS = ["dashboard", "events", "blueroots", "breakeven"];
const MORE_TABS = ["transactions", "inventory", "goals", "bestsellers", "whatif"];

const fmt = (n) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${Math.round(n)}%`;

const C = {
  bg: "#F7F4EF", surface: "#FFFFFF", navy: "#1B2A4A",
  blue: "#2563EB", blueLight: "#EFF4FF", slate: "#64748B", slateLight: "#F1F5F9",
  green: "#059669", greenBg: "#ECFDF5", red: "#DC2626", redBg: "#FEF2F2",
  amber: "#D97706", amberBg: "#FFFBEB", purple: "#7C3AED", purpleBg: "#F5F3FF",
  teal: "#0891B2", tealBg: "#ECFEFF", border: "#E2E8F0", text: "#1E293B", muted: "#94A3B8",
};

const Bar = ({ value, max, color, height = 8 }) => (
  <div style={{ height, background: C.slateLight, borderRadius: 4, overflow: "hidden" }}>
    <div style={{ height: "100%", width: `${Math.min(100, max > 0 ? (value / max) * 100 : 0)}%`, background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
  </div>
);

const TIP_CARDS = {
  dashboard: { icon: "📊", title: "Welcome to Blue Mountain Books", body: "This is your dashboard — your at-a-glance view of income, expenses, and profit. Start by creating your first event and logging what you spent and made.", action: "Create your first event", tab: "events" },
  events: { icon: "📅", title: "Track each market or pop-up separately", body: "Create one event for each market you attend. Attach income and expenses to it so you always know exactly what each market cost and made you. There's a built-in General Operations bucket for everyday business costs.", action: null },
  transactions: { icon: "↕️", title: "Log every dollar in and out", body: "Add a transaction every time money moves — booth fees, supply purchases, sales, Square payments. Each gets tagged to an event so you see the full picture.", action: null },
  breakeven: { icon: "⚖️", title: "Know exactly what you need to sell", body: "Add your products with their sale price and cost to make. The break-even calculator tells you how many units you need to sell to cover costs — and updates live as you tap sales at your booth.", action: null },
  inventory: { icon: "📦", title: "Never run out without knowing", body: "Add products with a starting stock count. Every time you save a live sale it deducts from inventory automatically. You'll see low stock warnings before you're caught empty-handed.", action: null },
  goals: { icon: "🎯", title: "Set a target and track progress", body: "Set a monthly revenue goal and per-event targets. The app tracks progress in real time and estimates taxes so there are no surprises at year end.", action: null },
  bestsellers: { icon: "🏆", title: "Find out what's really selling", body: "Use the Live Sales Tracker in Break-Even, save it at the end of an event, and your best sellers start appearing here. Over time you'll know exactly what to make more of.", action: null },
};

const TipCard = ({ tabKey, onAction }) => {
  const storageKey = `bmb_tip_${tabKey}`;
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(storageKey) === "1"; } catch { return false; } });
  const dismiss = () => { setDismissed(true); try { localStorage.setItem(storageKey, "1"); } catch {} };
  const tip = TIP_CARDS[tabKey];
  if (dismissed || !tip) return null;
  return (
    <div style={{ background: C.navy, borderRadius: 16, padding: "20px 22px", marginBottom: 20, position: "relative" }}>
      <button onClick={dismiss} style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{tip.icon}</div>
      <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: "#F5F0E8", marginBottom: 8 }}>{tip.title}</div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.65, margin: "0 0 14px" }}>{tip.body}</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {tip.action && <button onClick={() => { onAction && onAction(); dismiss(); }} style={{ background: "#5CC882", color: C.navy, border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{tip.action} →</button>}
        <button onClick={dismiss} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Got it, dismiss</button>
      </div>
    </div>
  );
};

const EmptyState = ({ icon, title, body, btnLabel, onBtn }) => (
  <div style={{ textAlign: "center", padding: "40px 24px" }}>
    <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
    <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 14, color: C.muted, maxWidth: 320, margin: "0 auto", lineHeight: 1.6, marginBottom: btnLabel ? 20 : 0 }}>{body}</div>
    {btnLabel && <button style={{ background: C.navy, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={onBtn}>{btnLabel}</button>}
  </div>
);

// ── Auth Screen ───────────────────────────────────────────────────────────────
const AuthScreen = ({ onAuth }) => {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handle = async () => {
    if (mode === "forgot") {
      if (!email) { setError("Please enter your email address."); return; }
      setLoading(true); setError(""); setSuccess("");
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, { method: "POST", headers: sb.headers, body: JSON.stringify({ email }) });
        setSuccess("Password reset email sent! Check your inbox.");
      } catch { setError("Something went wrong. Try again."); }
      setLoading(false); return;
    }
    if (!email || !password) { setError("Please enter your email and password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      if (mode === "signup") {
        const res = await sb.signUp(email, password);
        if (res.error) { setError(res.error.message); }
        else { setSuccess("Account created! Check your email to confirm, then sign in."); setMode("signin"); }
      } else {
        const res = await sb.signIn(email, password);
        if (res.error) { setError(res.error.message); }
        else {
          const token = res.access_token || res.session?.access_token;
          const user = res.user || res.session?.user;
          if (token) { onAuth(token, user); }
          else { setError("Login failed — please try again."); }
        }
      }
    } catch { setError("Something went wrong. Check your connection and try again."); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter',-apple-system,sans-serif" }}>
      <div style={{ background: C.surface, borderRadius: 24, padding: "36px 32px", width: 420, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <svg width="52" height="52" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: 14 }}>
            <polygon points="40,8 72,64 8,64" fill="#1B2A4A"/>
            <polygon points="40,8 53,32 27,32" fill="#5CC882"/>
            <rect x="8" y="60" width="64" height="5" rx="2.5" fill="#1B2A4A" opacity="0.2"/>
          </svg>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500, color: C.navy, marginBottom: 4 }}>Blue Mountain Books</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Clear. Confident. Bookkeeping.</div>
        </div>

        {mode !== "forgot" && (
          <div style={{ display: "flex", background: C.slateLight, borderRadius: 10, padding: 4, marginBottom: 24 }}>
            {["signin", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                style={{ flex: 1, background: mode === m ? C.surface : "transparent", border: "none", borderRadius: 8, padding: "8px 0", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, color: mode === m ? C.navy : C.muted, cursor: "pointer", transition: "all 0.15s" }}>
                {m === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>
        )}

        {mode === "forgot" && (
          <div style={{ marginBottom: 20 }}>
            <button onClick={() => { setMode("signin"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", padding: 0 }}>← Back to Sign In</button>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 17, color: C.navy, marginTop: 10, marginBottom: 6 }}>Reset your password</div>
            <div style={{ fontSize: 13, color: C.muted }}>Enter your email and we'll send you a reset link.</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.slate, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handle()}
              style={{ width: "100%", background: C.slateLight, border: "1.5px solid transparent", color: C.text, borderRadius: 10, padding: "10px 14px", fontFamily: "'Inter',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
          </div>
          {mode !== "forgot" && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.slate, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Password</label>
              <input type="password" placeholder={mode === "signup" ? "At least 6 characters" : "Your password"} value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handle()}
                style={{ width: "100%", background: C.slateLight, border: "1.5px solid transparent", color: C.text, borderRadius: 10, padding: "10px 14px", fontFamily: "'Inter',sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
            </div>
          )}
        </div>

        {error && <div style={{ background: C.redBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red, marginBottom: 14, fontWeight: 500 }}>{error}</div>}
        {success && <div style={{ background: C.greenBg, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.green, marginBottom: 14, fontWeight: 500 }}>{success}</div>}

        <button onClick={handle} disabled={loading}
          style={{ width: "100%", background: loading ? C.muted : C.navy, color: "white", border: "none", borderRadius: 12, padding: "14px", fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "opacity 0.15s" }}>
          {loading ? "Please wait..." : mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
        </button>

        {mode === "signin" && (
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <button onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.blue, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              Forgot your password?
            </button>
          </div>
        )}

        {mode === "signup" && <p style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>Your data is saved to your account and accessible from any device.</p>}
      </div>
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(() => { try { return localStorage.getItem("bmb_token") || null; } catch { return null; } });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSalesHistory, setProductSalesHistory] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [settings, setSettings] = useState({ tax_rate: 25, monthly_goal: 0 });
  const [profile, setProfile] = useState({ business_name: "", vendor_type: "craft", default_tax_rate: 25, phone: "", location: "" });

  const [liveSales, setLiveSales] = useState({});
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeEventFilter, setActiveEventFilter] = useState("all");
  const [breakEvenEventId, setBreakEvenEventId] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [quickEntryData, setQuickEntryData] = useState({});
  const [quickEntryEventId, setQuickEntryEventId] = useState("");
  const [csvImportText, setCsvImportText] = useState("");
  const [csvImportPreview, setCsvImportPreview] = useState([]);
  const [csvImportEventId, setCsvImportEventId] = useState("");
  const [whatIfPrice, setWhatIfPrice] = useState({});
  const [whatIfSupplyIncrease, setWhatIfSupplyIncrease] = useState(0);
  const [whatIfWholesaleDiscount, setWhatIfWholesaleDiscount] = useState(50);
  const [whatIfHelperHours, setWhatIfHelperHours] = useState(0);
  const [whatIfHelperRate, setWhatIfHelperRate] = useState(15);
  const [whatIfEventsPerMonth, setWhatIfEventsPerMonth] = useState(2);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showReport, setShowReport] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Edit modals
  const [editEvent, setEditEvent] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editSupply, setEditSupply] = useState(null);
  const [editTx, setEditTx] = useState(null);

  const [txForm, setTxForm] = useState({ type: "expense", description: "", amount: "", category: CATEGORIES[0], source: EXPENSE_SOURCES[0], isOwnerFunded: false, eventId: "", date: new Date().toISOString().split("T")[0] });
  const [eventForm, setEventForm] = useState({ name: "", date: "", goalRevenue: "", milesDriven: "", notes: "", productIds: [] });
  const [productForm, setProductForm] = useState({ name: "", price: "", stock: "", cogsMode: "simple", simpleCogs: "", vendorType: "craft", materials: "", packaging: "", labor: "", overhead: "", ingredients: "", consumables: "", permits: "", supplies: "", equipment: "", other: "", blueRoots: [{ id: 1, name: "", bulkCost: "", bulkQty: "", usedPerUnit: "", unit: "units", supplyId: null }] });
  const [supplyForm, setSupplyForm] = useState({ name: "", bulkCost: "", bulkQty: "", unit: "lb", lowStockThreshold: "" });
  const [settingsForm, setSettingsForm] = useState({ tax_rate: 25, monthly_goal: 0 });
  const [profileForm, setProfileForm] = useState({ business_name: "", vendor_type: "craft", default_tax_rate: 25, phone: "", location: "" });

  // ── Auth handlers ───────────────────────────────────────────────────────────
  const handleAuth = useCallback((accessToken, userData) => {
    try { localStorage.setItem("bmb_token", accessToken); } catch {}
    setToken(accessToken);
    setUser(userData);
  }, []);

  const handleSignOut = useCallback(async () => {
    const t = token;
    try { localStorage.removeItem("bmb_token"); } catch {}
    setToken(null); setUser(null);
    setEvents([]); setTransactions([]); setProducts([]); setProductSalesHistory([]);
    if (t) { try { await sb.signOut(t); } catch {} }
  }, [token]);

  // ── Load data on mount / token change ──────────────────────────────────────
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      try {
        // First verify the token is still valid
        const userData = await sb.getUser(token);
        if (!userData || userData.error || !userData.id) {
          try { localStorage.removeItem("bmb_token"); } catch {}
          setToken(null); setLoading(false); return;
        }
        setUser(userData);
        const [evRes, txRes, prRes, shRes, stRes, supRes, profRes] = await Promise.all([
          sb.select(token, "events"),
          sb.select(token, "transactions"),
          sb.select(token, "products"),
          sb.select(token, "sales_history"),
          sb.select(token, "settings"),
          sb.select(token, "supplies").catch(() => []),
          sb.select(token, "profile").catch(() => []),
        ]);
        const evList = Array.isArray(evRes) ? evRes : [];
        if (!evList.find(e => e.name === "General Operations")) {
          const genOps = await sb.insert(token, "events", { name: "General Operations", date: "", goal_revenue: 0, miles_driven: 0 });
          evList.push(Array.isArray(genOps) ? genOps[0] : genOps);
        }
        setEvents(evList);
        setTransactions(Array.isArray(txRes) ? txRes : []);
        setProducts(Array.isArray(prRes) ? prRes : []);
        setProductSalesHistory(Array.isArray(shRes) ? shRes : []);
        setSupplies(Array.isArray(supRes) ? supRes : []);
        const st = Array.isArray(stRes) && stRes.length > 0 ? stRes[0] : { tax_rate: 25, monthly_goal: 0 };
        setSettings(st);
        setSettingsForm({ tax_rate: st.tax_rate, monthly_goal: st.monthly_goal });
        const prof = Array.isArray(profRes) && profRes.length > 0 ? profRes[0] : { business_name: "", vendor_type: "craft", default_tax_rate: 25, phone: "", location: "" };
        setProfile(prof);
        setProfileForm(prof);
        if (evList.length > 0) setTxForm(f => ({ ...f, eventId: evList[0].id }));
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [token]);

  // ── Computed metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const f = activeEventFilter === "all" ? transactions : transactions.filter(t => t.event_id === Number(activeEventFilter));
    const totalIncome = f.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpenses = f.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const ownerInvested = f.filter(t => t.is_owner_funded).reduce((s, t) => s + t.amount, 0);
    const operationalExpenses = totalExpenses - ownerInvested;
    const profit = totalIncome - operationalExpenses;
    const roi = ownerInvested > 0 ? ((profit / ownerInvested) * 100).toFixed(1) : null;
    const taxEstimate = profit > 0 ? profit * ((settings.tax_rate || 25) / 100) : 0;
    return { totalIncome, ownerInvested, operationalExpenses, profit, roi, taxEstimate, takeHome: profit - taxEstimate };
  }, [transactions, activeEventFilter, settings]);

  const eventBreakdowns = useMemo(() => events.map(ev => {
    const evTx = transactions.filter(t => t.event_id === ev.id);
    const income = evTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = evTx.filter(t => t.type === "expense" && !t.is_owner_funded).reduce((s, t) => s + t.amount, 0);
    const net = income - expenses;
    return { ...ev, income, expenses, net, taxEstimate: net > 0 ? net * ((settings.tax_rate || 25) / 100) : 0, mileageDeduction: (ev.miles_driven || 0) * 0.67 };
  }), [events, transactions, settings]);

  const beMetrics = useMemo(() => {
    const f = breakEvenEventId === "all" ? transactions : transactions.filter(t => t.event_id === Number(breakEvenEventId));
    const loggedIncome = f.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpenses = f.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const ownerInvested = f.filter(t => t.is_owner_funded).reduce((s, t) => s + t.amount, 0);
    const operationalExpenses = totalExpenses - ownerInvested;
    const liveRevenue = Object.entries(liveSales).reduce((sum, [pid, qty]) => {
      const p = products.find(p => String(p.id) === String(pid));
      return sum + (p ? p.price * qty : 0);
    }, 0);
    const totalIncome = loggedIncome + liveRevenue;
    return { liveRevenue, totalIncome, operationalExpenses, profit: totalIncome - operationalExpenses };
  }, [transactions, breakEvenEventId, liveSales, products]);

  const productScenarios = useMemo(() => {
    const gap = beMetrics.operationalExpenses - beMetrics.totalIncome;
    return products.map(p => ({ ...p, grossProfit: p.price - (p.cogs||0), unitsToBreakEven: gap <= 0 ? 0 : Math.ceil(gap / Math.max(p.price-(p.cogs||0), p.price)), alreadyProfitable: gap <= 0 }));
  }, [products, beMetrics]);

  const inventoryData = useMemo(() => products.map(p => {
    const soldFromHistory = productSalesHistory.filter(h => h.product_id === p.id).reduce((s, h) => s + h.qty, 0);
    const remaining = Math.max(0, (p.stock||0) - soldFromHistory);
    return { ...p, soldFromHistory, remaining, stockValue: remaining * (p.cogs||0), potentialRevenue: remaining * p.price };
  }), [products, productSalesHistory]);

  const bestSellers = useMemo(() => {
    const totals = {};
    productSalesHistory.forEach(e => {
      if (!totals[e.product_name]) totals[e.product_name] = { name: e.product_name, totalQty: 0, totalRevenue: 0, price: e.price, cogs: e.cogs||0, eventNames: new Set() };
      totals[e.product_name].totalQty += e.qty;
      totals[e.product_name].totalRevenue += e.revenue;
      totals[e.product_name].eventNames.add(e.event_name);
    });
    return Object.values(totals).sort((a, b) => b.totalQty - a.totalQty).map(p => ({ ...p, eventNames: [...p.eventNames], grossProfit: p.totalRevenue - (p.cogs * p.totalQty) }));
  }, [productSalesHistory]);

  const salesByEvent = useMemo(() => {
    const byEvent = {};
    productSalesHistory.forEach(e => {
      if (!byEvent[e.event_name]) byEvent[e.event_name] = { name: e.event_name, date: e.date, prods: {} };
      if (!byEvent[e.event_name].prods[e.product_name]) byEvent[e.event_name].prods[e.product_name] = { qty: 0, revenue: 0 };
      byEvent[e.event_name].prods[e.product_name].qty += e.qty;
      byEvent[e.event_name].prods[e.product_name].revenue += e.revenue;
    });
    return Object.values(byEvent);
  }, [productSalesHistory]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyIncome = useMemo(() => transactions.filter(t => t.type === "income" && t.date?.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0), [transactions, thisMonth]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const addTransaction = async () => {
    if (!txForm.description || !txForm.amount) return;
    setSaving(true);
    const data = { type: txForm.type, description: txForm.description, amount: parseFloat(txForm.amount), category: txForm.category, source: txForm.source, is_owner_funded: txForm.isOwnerFunded, event_id: Number(txForm.eventId), date: txForm.date };
    const res = await sb.insert(token, "transactions", data);
    const newTx = Array.isArray(res) ? res[0] : res;
    setTransactions(prev => [...prev, newTx]);
    setTxForm({ type: "expense", description: "", amount: "", category: CATEGORIES[0], source: EXPENSE_SOURCES[0], isOwnerFunded: false, eventId: events[0]?.id, date: new Date().toISOString().split("T")[0] });
    setShowAddTx(false); setSaving(false);
  };

  const addEvent = async () => {
    if (!eventForm.name) return;
    setSaving(true);
    const data = { name: eventForm.name, date: eventForm.date, goal_revenue: parseFloat(eventForm.goalRevenue)||0, miles_driven: parseFloat(eventForm.milesDriven)||0, notes: eventForm.notes || "", product_ids: eventForm.productIds.join(",") };
    const res = await sb.insert(token, "events", data);
    const newEv = Array.isArray(res) ? res[0] : res;
    setEvents(prev => [...prev, newEv]);
    setEventForm({ name: "", date: "", goalRevenue: "", milesDriven: "", notes: "", productIds: [] });
    setShowAddEvent(false); setSaving(false);
  };

  const addSupply = async () => {
    if (!supplyForm.name || !supplyForm.bulkCost || !supplyForm.bulkQty) return;
    setSaving(true);
    const data = { name: supplyForm.name, bulk_cost: parseFloat(supplyForm.bulkCost), bulk_qty: parseFloat(supplyForm.bulkQty), unit: supplyForm.unit, low_stock_threshold: parseFloat(supplyForm.lowStockThreshold) || 0, current_qty: parseFloat(supplyForm.bulkQty) };
    const res = await sb.insert(token, "supplies", data);
    const newSup = Array.isArray(res) ? res[0] : res;
    setSupplies(prev => [...prev, newSup]);
    setSupplyForm({ name: "", bulkCost: "", bulkQty: "", unit: "lb", lowStockThreshold: "" });
    setShowAddSupply(false); setSaving(false);
  };

  const deleteSupply = async (id) => { await sb.remove(token, "supplies", id); setSupplies(prev => prev.filter(s => s.id !== id)); };

  const addProduct = async () => {
    if (!productForm.name || !productForm.price) return;
    setSaving(true);
    const f = productForm;
    let totalCogs = 0;
    let breakdown = null;
    if (f.cogsMode === "simple") {
      totalCogs = parseFloat(f.simpleCogs) || 0;
    } else if (f.cogsMode === "blueroots") {
      // Calculate per-unit cost from each supply
      const lines = {};
      f.blueRoots.forEach(item => {
        const bulkCost = parseFloat(item.bulkCost) || 0;
        const bulkQty = parseFloat(item.bulkQty) || 0;
        const usedPerUnit = parseFloat(item.usedPerUnit) || 0;
        if (item.name && bulkCost > 0 && bulkQty > 0 && usedPerUnit > 0) {
          const perUnitCost = (bulkCost / bulkQty) * usedPerUnit;
          totalCogs += perUnitCost;
          lines[item.name] = perUnitCost;
        }
      });
      breakdown = JSON.stringify({ mode: "blueroots", lines, supplies: f.blueRoots.filter(i => i.name) });
    } else if (f.vendorType === "craft") {
      totalCogs = [f.materials, f.packaging, f.labor, f.overhead, f.other].reduce((s, v) => s + (parseFloat(v)||0), 0);
    } else if (f.vendorType === "food") {
      totalCogs = [f.ingredients, f.packaging, f.consumables, f.labor, f.permits, f.other].reduce((s, v) => s + (parseFloat(v)||0), 0);
    } else {
      totalCogs = [f.supplies, f.equipment, f.labor, f.other].reduce((s, v) => s + (parseFloat(v)||0), 0);
    }
    if (f.cogsMode === "detailed") {
      breakdown = JSON.stringify({ vendorType: f.vendorType, lines: f.vendorType === "craft" ? { Materials: parseFloat(f.materials)||0, Packaging: parseFloat(f.packaging)||0, Labor: parseFloat(f.labor)||0, Overhead: parseFloat(f.overhead)||0, Other: parseFloat(f.other)||0 } : f.vendorType === "food" ? { Ingredients: parseFloat(f.ingredients)||0, Packaging: parseFloat(f.packaging)||0, Consumables: parseFloat(f.consumables)||0, Labor: parseFloat(f.labor)||0, "Permits/Fees": parseFloat(f.permits)||0, Other: parseFloat(f.other)||0 } : { Supplies: parseFloat(f.supplies)||0, Equipment: parseFloat(f.equipment)||0, Labor: parseFloat(f.labor)||0, Other: parseFloat(f.other)||0 } });
    }
    const data = { name: f.name, price: parseFloat(f.price), cogs: totalCogs, stock: parseInt(f.stock)||0, cogs_breakdown: breakdown };
    const res = await sb.insert(token, "products", data);
    const newProd = Array.isArray(res) ? res[0] : res;
    setProducts(prev => [...prev, newProd]);
    setProductForm({ name: "", price: "", stock: "", cogsMode: "simple", simpleCogs: "", vendorType: "craft", materials: "", packaging: "", labor: "", overhead: "", ingredients: "", consumables: "", permits: "", supplies: "", equipment: "", other: "", blueRoots: [{ id: 1, name: "", bulkCost: "", bulkQty: "", usedPerUnit: "", unit: "units" }] });
    setShowAddProduct(false); setSaving(false);
  };

  const saveLiveSales = async () => {
    const eventId = breakEvenEventId === "all" ? events[0].id : Number(breakEvenEventId);
    const eventName = events.find(e => e.id === eventId)?.name || "Unknown";
    const date = new Date().toISOString().split("T")[0];
    const entries = Object.entries(liveSales).filter(([,qty]) => qty > 0).map(([pid, qty]) => {
      const p = products.find(p => String(p.id) === String(pid));
      return { product_id: Number(pid), product_name: p?.name||"Unknown", price: p?.price||0, cogs: p?.cogs||0, qty, revenue: (p?.price||0)*qty, event_id: eventId, event_name: eventName, date };
    });
    if (!entries.length) return;
    setSaving(true);
    const shRes = await sb.insert(token, "sales_history", entries);
    setProductSalesHistory(prev => [...prev, ...(Array.isArray(shRes) ? shRes : [shRes])]);
    const txEntries = entries.map(e => ({ type: "income", description: `${e.qty} x ${e.product_name}`, amount: e.revenue, category: "Sales", source: "Live Tracker", is_owner_funded: false, event_id: eventId, date }));
    const txRes = await sb.insert(token, "transactions", txEntries);
    setTransactions(prev => [...prev, ...(Array.isArray(txRes) ? txRes : [txRes])]);

    // Auto-decrement product stock
    const updatedProducts = [...products];
    for (const entry of entries) {
      const idx = updatedProducts.findIndex(p => p.id === entry.product_id);
      if (idx >= 0 && updatedProducts[idx].stock > 0) {
        const newStock = Math.max(0, (updatedProducts[idx].stock || 0) - entry.qty);
        await sb.update(token, "products", entry.product_id, { stock: newStock });
        updatedProducts[idx] = { ...updatedProducts[idx], stock: newStock };
      }
    }
    setProducts(updatedProducts);

    setLiveSales({}); setShowSaveConfirm(false); setSaving(false);
  };

  // Save Quick Entry — batch enter sales after the event
  const saveQuickEntry = async () => {
    if (!quickEntryEventId) { alert("Pick an event first"); return; }
    const eventId = Number(quickEntryEventId);
    const eventName = events.find(e => e.id === eventId)?.name || "Unknown";
    const date = events.find(e => e.id === eventId)?.date || new Date().toISOString().split("T")[0];
    const entries = Object.entries(quickEntryData).filter(([,qty]) => parseInt(qty) > 0).map(([pid, qty]) => {
      const p = products.find(p => String(p.id) === String(pid));
      const q = parseInt(qty);
      return { product_id: Number(pid), product_name: p?.name||"Unknown", price: p?.price||0, cogs: p?.cogs||0, qty: q, revenue: (p?.price||0)*q, event_id: eventId, event_name: eventName, date };
    });
    if (!entries.length) { alert("Enter at least one quantity"); return; }
    setSaving(true);
    const shRes = await sb.insert(token, "sales_history", entries);
    setProductSalesHistory(prev => [...prev, ...(Array.isArray(shRes) ? shRes : [shRes])]);
    const txEntries = entries.map(e => ({ type: "income", description: `${e.qty} x ${e.product_name}`, amount: e.revenue, category: "Sales", source: "Quick Entry", is_owner_funded: false, event_id: eventId, date }));
    const txRes = await sb.insert(token, "transactions", txEntries);
    setTransactions(prev => [...prev, ...(Array.isArray(txRes) ? txRes : [txRes])]);

    // Auto-decrement product stock
    const updatedProducts = [...products];
    for (const entry of entries) {
      const idx = updatedProducts.findIndex(p => p.id === entry.product_id);
      if (idx >= 0 && updatedProducts[idx].stock > 0) {
        const newStock = Math.max(0, (updatedProducts[idx].stock || 0) - entry.qty);
        await sb.update(token, "products", entry.product_id, { stock: newStock });
        updatedProducts[idx] = { ...updatedProducts[idx], stock: newStock };
      }
    }
    setProducts(updatedProducts);

    setQuickEntryData({}); setShowQuickEntry(false); setSaving(false);
  };

  // Parse CSV (simple parser — handles quoted fields)
  const parseCsv = (text) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const parseRow = (row) => {
      const cells = []; let cur = ""; let inQ = false;
      for (let i = 0; i < row.length; i++) {
        const c = row[i];
        if (c === '"' && row[i+1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = !inQ;
        else if (c === "," && !inQ) { cells.push(cur); cur = ""; }
        else cur += c;
      }
      cells.push(cur);
      return cells.map(c => c.trim());
    };
    const headers = parseRow(lines[0]).map(h => h.toLowerCase());
    return lines.slice(1).map(line => {
      const cells = parseRow(line);
      const row = {};
      headers.forEach((h, i) => row[h] = cells[i] || "");
      return row;
    });
  };

  // Try to extract sales data from common CSV formats (Square, Shopify, Etsy, generic)
  const previewCsvImport = () => {
    const rows = parseCsv(csvImportText);
    if (!rows.length) { alert("Couldn't parse the CSV. Make sure the first row has headers."); return; }
    const findKey = (row, options) => Object.keys(row).find(k => options.some(o => k.includes(o)));
    const previews = rows.map(row => {
      const itemKey = findKey(row, ["item", "product", "name", "title", "description"]);
      const qtyKey = findKey(row, ["qty", "quantity", "units"]);
      const priceKey = findKey(row, ["price", "amount", "gross", "subtotal", "net"]);
      const dateKey = findKey(row, ["date", "time", "created"]);
      const item = itemKey ? row[itemKey] : "";
      const qty = qtyKey ? parseFloat(row[qtyKey]) || 1 : 1;
      const priceStr = priceKey ? row[priceKey].replace(/[$,]/g, "") : "0";
      const price = parseFloat(priceStr) || 0;
      const date = dateKey ? row[dateKey].split("T")[0].split(" ")[0] : "";
      // Try to match an existing product by name
      const matchedProduct = products.find(p => item && p.name.toLowerCase().includes(item.toLowerCase()) || (item && item.toLowerCase().includes(p.name.toLowerCase())));
      return { item, qty, price, date, matchedProductId: matchedProduct?.id || null, matchedProductName: matchedProduct?.name || null };
    }).filter(p => p.item && p.price > 0);
    setCsvImportPreview(previews);
  };

  const saveCsvImport = async () => {
    if (!csvImportEventId) { alert("Pick an event first"); return; }
    const eventId = Number(csvImportEventId);
    const eventName = events.find(e => e.id === eventId)?.name || "Unknown";
    const fallbackDate = events.find(e => e.id === eventId)?.date || new Date().toISOString().split("T")[0];
    setSaving(true);
    const shEntries = csvImportPreview.filter(r => r.matchedProductId).map(r => ({
      product_id: r.matchedProductId, product_name: r.matchedProductName, price: r.price, cogs: products.find(p => p.id === r.matchedProductId)?.cogs || 0, qty: r.qty, revenue: r.price * r.qty, event_id: eventId, event_name: eventName, date: r.date || fallbackDate,
    }));
    if (shEntries.length > 0) {
      const shRes = await sb.insert(token, "sales_history", shEntries);
      setProductSalesHistory(prev => [...prev, ...(Array.isArray(shRes) ? shRes : [shRes])]);
    }
    // For unmatched items create transactions only
    const txEntries = csvImportPreview.map(r => ({ type: "income", description: r.matchedProductName ? `${r.qty} x ${r.matchedProductName}` : `${r.qty} x ${r.item}`, amount: r.price * r.qty, category: "Sales", source: "CSV Import", is_owner_funded: false, event_id: eventId, date: r.date || fallbackDate }));
    const txRes = await sb.insert(token, "transactions", txEntries);
    setTransactions(prev => [...prev, ...(Array.isArray(txRes) ? txRes : [txRes])]);

    // Auto-decrement stock for matched products
    const updatedProducts = [...products];
    for (const entry of shEntries) {
      const idx = updatedProducts.findIndex(p => p.id === entry.product_id);
      if (idx >= 0 && updatedProducts[idx].stock > 0) {
        const newStock = Math.max(0, (updatedProducts[idx].stock || 0) - entry.qty);
        await sb.update(token, "products", entry.product_id, { stock: newStock });
        updatedProducts[idx] = { ...updatedProducts[idx], stock: newStock };
      }
    }
    setProducts(updatedProducts);

    setCsvImportText(""); setCsvImportPreview([]); setShowCsvImport(false); setSaving(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    const data = { tax_rate: parseFloat(settingsForm.tax_rate)||25, monthly_goal: parseFloat(settingsForm.monthly_goal)||0 };
    if (settings.id) { await sb.update(token, "settings", settings.id, data); setSettings({ ...settings, ...data }); }
    else { const res = await sb.insert(token, "settings", data); setSettings(Array.isArray(res) ? res[0] : res); }
    setShowSettings(false); setSaving(false);
  };

  const deleteTransaction = async (id) => { await sb.remove(token, "transactions", id); setTransactions(prev => prev.filter(t => t.id !== id)); };
  const deleteProduct = async (id) => { await sb.remove(token, "products", id); setProducts(prev => prev.filter(p => p.id !== id)); };

  // Save profile
  const saveProfile = async () => {
    setSaving(true);
    try {
      if (profile && profile.id) {
        await sb.update(token, "profile", profile.id, profileForm);
        setProfile({ ...profile, ...profileForm });
      } else {
        const res = await sb.insert(token, "profile", profileForm);
        const newProf = Array.isArray(res) ? res[0] : res;
        setProfile(newProf);
        setProfileForm(newProf);
      }
      setShowProfile(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  // Update functions
  const updateEvent = async () => {
    if (!editEvent || !editEvent.name) return;
    setSaving(true);
    const data = { name: editEvent.name, date: editEvent.date || "", goal_revenue: parseFloat(editEvent.goal_revenue) || 0, miles_driven: parseFloat(editEvent.miles_driven) || 0, notes: editEvent.notes || "", product_ids: Array.isArray(editEvent.product_ids) ? editEvent.product_ids.join(",") : (editEvent.product_ids || "") };
    await sb.update(token, "events", editEvent.id, data);
    setEvents(prev => prev.map(e => e.id === editEvent.id ? { ...e, ...data } : e));
    setEditEvent(null); setSaving(false);
  };

  const updateProduct = async () => {
    if (!editProduct || !editProduct.name) return;
    setSaving(true);
    const data = { name: editProduct.name, price: parseFloat(editProduct.price) || 0, cogs: parseFloat(editProduct.cogs) || 0, stock: parseInt(editProduct.stock) || 0 };
    await sb.update(token, "products", editProduct.id, data);
    setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...data } : p));
    setEditProduct(null); setSaving(false);
  };

  const updateSupply = async () => {
    if (!editSupply || !editSupply.name) return;
    setSaving(true);
    const data = { name: editSupply.name, bulk_cost: parseFloat(editSupply.bulk_cost) || 0, bulk_qty: parseFloat(editSupply.bulk_qty) || 0, unit: editSupply.unit, low_stock_threshold: parseFloat(editSupply.low_stock_threshold) || 0, current_qty: parseFloat(editSupply.current_qty) || 0 };
    await sb.update(token, "supplies", editSupply.id, data);
    setSupplies(prev => prev.map(s => s.id === editSupply.id ? { ...s, ...data } : s));
    setEditSupply(null); setSaving(false);
  };

  const updateTransaction = async () => {
    if (!editTx || !editTx.description) return;
    setSaving(true);
    const data = { type: editTx.type, description: editTx.description, amount: parseFloat(editTx.amount) || 0, category: editTx.category, source: editTx.source, is_owner_funded: editTx.is_owner_funded || false, event_id: editTx.event_id, date: editTx.date };
    await sb.update(token, "transactions", editTx.id, data);
    setTransactions(prev => prev.map(t => t.id === editTx.id ? { ...t, ...data } : t));
    setEditTx(null); setSaving(false);
  };

  // Archive event (soft delete)
  const archiveEvent = async (id) => {
    await sb.update(token, "events", id, { archived: true });
    setEvents(prev => prev.map(e => e.id === id ? { ...e, archived: true } : e));
  };
  const unarchiveEvent = async (id) => {
    await sb.update(token, "events", id, { archived: false });
    setEvents(prev => prev.map(e => e.id === id ? { ...e, archived: false } : e));
  };
  const deleteEvent = async (id) => {
    await sb.remove(token, "events", id);
    setEvents(prev => prev.filter(e => e.id !== id));
    setSelectedEventId(null);
  };
  const printReport = (ev) => { const bd = eventBreakdowns.find(e => e.id === ev.id); const evSales = salesByEvent.find(s => s.name === ev.name); setShowReport({ ev, bd, evSales }); };

  const displayTransactions = activeEventFilter === "all" ? transactions : transactions.filter(t => t.event_id === Number(activeEventFilter));
  const profitPos = metrics.profit >= 0;
  const hasLiveSales = Object.values(liveSales).some(v => v > 0);
  const isMoreActive = MORE_TABS.includes(activeTab);
  const tabLabel = (t) => ({ dashboard: "Home", events: "Events", breakeven: "Break-Even", transactions: "Ledger", inventory: "Inventory", goals: "Goals", bestsellers: "Top Sellers", blueroots: "Blue Roots", whatif: "What-If" }[t] || t);
  const tabIcon = (t) => ({ dashboard: "⊞", events: "📅", breakeven: "⚖", transactions: "↕", inventory: "📦", goals: "🎯", bestsellers: "🏆", blueroots: "🌿", whatif: "🔮" }[t] || "•");

  // ── CSS ───────────────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Clash+Display:wght@600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px}
    .card{background:${C.surface};border-radius:16px;border:1px solid ${C.border};padding:22px 24px}
    .btn-p{background:${C.navy};color:white;border:none;border-radius:10px;padding:10px 20px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s}
    .btn-p:hover{opacity:0.85}
    .btn-o{background:white;color:${C.navy};border:1.5px solid ${C.border};border-radius:10px;padding:9px 18px;font-family:'Inter',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.15s}
    .btn-o:hover{border-color:${C.navy}}
    .inp{background:${C.slateLight};border:1.5px solid transparent;color:${C.text};border-radius:10px;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;outline:none;width:100%;transition:all 0.15s}
    .inp:focus{border-color:${C.blue};background:white}
    .sel{background:${C.slateLight};border:1.5px solid transparent;color:${C.text};border-radius:10px;padding:10px 14px;font-family:'Inter',sans-serif;font-size:14px;outline:none;width:100%;cursor:pointer;appearance:none}
    .sel:focus{border-color:${C.blue};background:white}
    .overlay{position:fixed;inset:0;background:rgba(15,23,42,0.5);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px)}
    .modal{background:white;border-radius:20px;padding:28px;width:480px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:90vh;overflow-y:auto}
    .pill{background:none;border:1.5px solid ${C.border};border-radius:20px;padding:6px 14px;font-family:'Inter',sans-serif;font-size:12px;font-weight:500;color:${C.slate};cursor:pointer;transition:all 0.15s;white-space:nowrap}
    .pill.on{background:${C.navy};border-color:${C.navy};color:white}
    .pill:hover:not(.on){border-color:${C.navy};color:${C.navy}}
    .txrow{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid ${C.slateLight};transition:background 0.1s}
    .txrow:last-child{border-bottom:none}
    .txrow:hover{background:${C.slateLight}}
    .del{background:none;border:none;cursor:pointer;color:${C.border};font-size:18px;padding:0 4px;transition:color 0.15s}
    .del:hover{color:${C.red}}
    .mlbl{font-size:12px;font-weight:500;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px}
    .big{font-family:'Clash Display','Inter',sans-serif;font-size:28px;font-weight:700;line-height:1;letter-spacing:-0.02em}
    .slbl{font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px}
    label{font-size:12px;font-weight:600;color:${C.slate};text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:6px}
    .tab{background:none;border:none;cursor:pointer;font-family:'Inter',sans-serif;font-size:12px;font-weight:500;padding:8px 14px;color:rgba(255,255,255,0.5);border-radius:8px;transition:all 0.15s;white-space:nowrap}
    .tab.active{background:white;color:${C.navy}}
    .tab:hover:not(.active){color:white;background:rgba(255,255,255,0.12)}
    @keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .fu{animation:fu 0.25s ease forwards}
    @keyframes su{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .su{animation:su 0.2s ease forwards}
    .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:${C.navy};border-top:1px solid rgba(255,255,255,0.08);z-index:90;padding-bottom:env(safe-area-inset-bottom)}
    .bnav-btn{flex:1;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px 8px}
    .bnav-icon{font-size:20px;line-height:1}
    .bnav-label{font-family:'Inter',sans-serif;font-size:10px;font-weight:500;color:rgba(255,255,255,0.45)}
    .bnav-btn.active .bnav-label{color:#5CC882}
    .bnav-dot{width:4px;height:4px;border-radius:50%;background:#5CC882;margin-top:2px}
    .dtabs{display:flex}
    .more-menu{position:fixed;bottom:70px;right:0;left:0;margin:0 12px;background:${C.navy};border-radius:16px;border:1px solid rgba(255,255,255,0.1);z-index:95;padding:8px 0}
    @media(max-width:640px){.bottom-nav{display:flex}.dtabs{display:none}.btn-event{display:none}.pcontent{padding-bottom:80px!important}.card{padding:16px}.big{font-size:22px}.modal{padding:20px}}
  `;

  const MTitle = ({ children }) => <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 20, color: C.navy, marginBottom: 8 }}>{children}</div>;

  // ── Loading screen ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Inter',sans-serif" }}>
      <svg width="52" height="52" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
        <polygon points="40,8 72,64 8,64" fill="#5CC882"/>
        <polygon points="40,8 53,32 27,32" fill="#F5F0E8"/>
      </svg>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading your books...</div>
    </div>
  );

  // ── Auth gate ─────────────────────────────────────────────────────────────────
  if (!token) return <><style>{css}</style><AuthScreen onAuth={handleAuth} /></>;

  return (
    <div style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ background: C.navy }}>
        <div style={{ maxWidth: 1020, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="34" height="34" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
              <polygon points="40,8 72,64 8,64" fill="#5CC882"/>
              <polygon points="40,8 53,32 27,32" fill="#F5F0E8"/>
              <rect x="8" y="60" width="64" height="5" rx="2.5" fill="#5CC882" opacity="0.35"/>
            </svg>
            <div>
              <div style={{ fontFamily: "Georgia, serif", fontWeight: 500, fontSize: 16, color: "#F5F0E8" }}>Blue Mountain Books</div>
              <div style={{ fontFamily: "sans-serif", fontSize: 9, letterSpacing: "0.12em", color: "#8BBF9A", marginTop: 1, textTransform: "uppercase" }}>Clear. Confident. Bookkeeping.</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {saving && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginRight: 4 }}>Saving...</div>}
            <button className="btn-o" title="My Profile" style={{ background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.2)", fontSize: 12, padding: "7px 12px" }} onClick={() => { setProfileForm(profile); setShowProfile(true); }}>👤</button>
            <button className="btn-o" title="Settings" style={{ background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.2)", fontSize: 12, padding: "7px 12px" }} onClick={() => { setSettingsForm({ tax_rate: settings.tax_rate, monthly_goal: settings.monthly_goal }); setShowSettings(true); }}>⚙</button>
            <button className="btn-o btn-event" style={{ background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.2)", fontSize: 12, padding: "7px 12px" }} onClick={() => setShowAddEvent(true)}>+ Event</button>
            <button className="btn-p" style={{ background: C.blue, fontSize: 12, padding: "7px 14px" }} onClick={() => setShowAddTx(true)}>+ Transaction</button>
            <button className="btn-o" style={{ background: "transparent", color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)", fontSize: 12, padding: "7px 12px" }} onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
        <div className="dtabs" style={{ maxWidth: 1020, margin: "0 auto", padding: "0 16px 10px", gap: 2, flexWrap: "wrap" }}>
          {TABS.map(t => <button key={t} className={`tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>{tabLabel(t)}</button>)}
        </div>
      </div>

      {/* Filter bar */}
      {(activeTab === "dashboard" || activeTab === "transactions") && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 16px" }}>
          <div style={{ maxWidth: 1020, margin: "0 auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Filter:</span>
            <button className={`pill${activeEventFilter === "all" ? " on" : ""}`} onClick={() => setActiveEventFilter("all")}>All</button>
            {events.map(ev => <button key={ev.id} className={`pill${activeEventFilter === String(ev.id) ? " on" : ""}`} onClick={() => setActiveEventFilter(String(ev.id))}>{ev.name}</button>)}
          </div>
        </div>
      )}

      {/* Page */}
      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "24px 16px" }} className="pcontent">

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="fu">
            {/* Welcoming greeting + quick stats */}
            {(() => {
              const hour = new Date().getHours();
              const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
              const userName = profile?.business_name || (user?.email ? user.email.split("@")[0] : "vendor");
              const today = new Date().toISOString().split("T")[0];
              const todayEvent = events.find(e => e.date === today && e.name !== "General Operations");
              const upcomingEvent = events.filter(e => e.date && e.date > today && e.name !== "General Operations").sort((a,b) => a.date.localeCompare(b.date))[0];
              const realEvents = events.filter(e => e.name !== "General Operations").length;
              const tips = [
                "Track every dollar — even the small ones add up at tax time. 🌿",
                "Your real cost per product is the foundation of every profitable price. Use Blue Roots! 🌱",
                "An event without a goal is just a guess. Set a target before you set up. 🎯",
                "Save your supplies once in Blue Roots — reuse them across every product. ⚡",
                "Owner-funded purchases aren't expenses — they're investments. Track them differently. 💜",
                "Margins under 30% mean you're working hard for very little. Always check your numbers. ⚠️",
                "Today's small sale is tomorrow's repeat customer. Smile, even when it's slow. 💛",
                "Knowing your break-even tells you when you can finally relax at an event. ⚖️",
                "Cash, Cash App, Square — log it all in one place so taxes are easy. 📒",
                "Your prices reflect your worth. Don't undersell what you make. 🏔️",
              ];
              const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
              const tipOfDay = tips[dayOfYear % tips.length];

              return (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 28, color: C.navy, fontWeight: 500, lineHeight: 1.2 }}>{greeting}, {userName.charAt(0).toUpperCase() + userName.slice(1)} 🌿</div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
                  </div>

                  {/* Quick stats banner */}
                  <div className="card" style={{ marginBottom: 16, background: "linear-gradient(135deg, #1B2A4A 0%, #2D4270 100%)", borderColor: C.navy, padding: "18px 22px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Events</div>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 28, fontWeight: 700, color: "white", lineHeight: 1, marginTop: 6 }}>{realEvents}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Products</div>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 28, fontWeight: 700, color: "white", lineHeight: 1, marginTop: 6 }}>{products.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Earned This Month</div>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 28, fontWeight: 700, color: "#5CC882", lineHeight: 1, marginTop: 6 }}>{fmt(monthlyIncome)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Today's event spotlight */}
                  {todayEvent && (
                    <div className="card" onClick={() => { setSelectedEventId(todayEvent.id); setActiveTab("events"); }}
                      style={{ marginBottom: 16, background: C.greenBg, borderColor: "#A7F3D0", borderLeft: `4px solid ${C.green}`, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 28 }}>📅</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Today's Event</div>
                          <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 20, fontWeight: 700, color: C.navy }}>{todayEvent.name}</div>
                          <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>Tap to track sales, view details, and add transactions →</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {!todayEvent && upcomingEvent && (() => {
                    const daysUntil = Math.ceil((new Date(upcomingEvent.date) - new Date(today)) / 86400000);
                    return (
                      <div className="card" onClick={() => { setSelectedEventId(upcomingEvent.id); setActiveTab("events"); }}
                        style={{ marginBottom: 16, background: C.blueLight, borderColor: "#BFDBFE", borderLeft: `4px solid ${C.blue}`, cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 28 }}>⏰</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Coming Up</div>
                            <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 18, fontWeight: 700, color: C.navy }}>{upcomingEvent.name}</div>
                            <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>{daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`} · {upcomingEvent.date}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Vendor tip of the day */}
                  <div className="card" style={{ marginBottom: 20, background: "#FAEEDA", borderColor: "#F4C775", padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{ fontSize: 22, lineHeight: 1.2 }}>💡</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#854F0B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Vendor Tip of the Day</div>
                        <div style={{ fontSize: 13, color: "#412402", lineHeight: 1.6 }}>{tipOfDay}</div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            <TipCard tabKey="dashboard" onAction={() => setShowAddEvent(true)} />
            {settings.monthly_goal > 0 && (
              <div className="card" style={{ marginBottom: 20, background: monthlyIncome >= settings.monthly_goal ? C.greenBg : C.navy, borderColor: monthlyIncome >= settings.monthly_goal ? "#A7F3D0" : C.navy }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: monthlyIncome >= settings.monthly_goal ? C.green : "rgba(255,255,255,0.7)" }}>📈 Monthly Goal</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: monthlyIncome >= settings.monthly_goal ? C.green : "white" }}>{fmt(monthlyIncome)} / {fmt(settings.monthly_goal)}</div>
                </div>
                <Bar value={monthlyIncome} max={settings.monthly_goal} color={monthlyIncome >= settings.monthly_goal ? C.green : "#5CC882"} height={10} />
                <div style={{ fontSize: 12, color: monthlyIncome >= settings.monthly_goal ? C.green : "rgba(255,255,255,0.5)", marginTop: 8 }}>{monthlyIncome >= settings.monthly_goal ? "Goal reached! 🎉" : `${fmt(settings.monthly_goal - monthlyIncome)} to go`}</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 20 }}>
              <div className="card"><div className="mlbl">Total Income</div><div className="big" style={{ color: C.green }}>{fmt(metrics.totalIncome)}</div></div>
              <div className="card"><div className="mlbl">Operating Costs</div><div className="big" style={{ color: C.red }}>{fmt(metrics.operationalExpenses)}</div></div>
              <div className="card" style={{ background: metrics.profit > 0 ? C.greenBg : metrics.profit < 0 ? C.redBg : C.surface, borderColor: metrics.profit > 0 ? "#A7F3D0" : metrics.profit < 0 ? "#FECACA" : C.border }}>
                <div className="mlbl">Net Profit</div>
                <div className="big" style={{ color: metrics.profit > 0 ? C.green : metrics.profit < 0 ? C.red : C.muted }}>{metrics.profit !== 0 ? (profitPos ? "+" : "-") : ""}{fmt(metrics.profit)}</div>
                {metrics.profit !== 0 && <span style={{ display: "inline-block", marginTop: 8, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: profitPos ? "#D1FAE5" : "#FEE2E2", color: profitPos ? C.green : C.red }}>{profitPos ? "✓ Profitable" : "⚠ In the red"}</span>}
              </div>
              <div className="card" style={{ background: C.purpleBg, borderColor: "#DDD6FE" }}>
                <div className="mlbl">Owner Invested</div>
                <div className="big" style={{ color: C.purple }}>{fmt(metrics.ownerInvested)}</div>
                {metrics.roi !== null && <div style={{ fontSize: 12, color: C.purple, marginTop: 8, fontWeight: 600 }}>{metrics.roi}% ROI</div>}
              </div>
            </div>
            {metrics.profit > 0 && (
              <div className="card" style={{ marginBottom: 20, borderColor: "#FDE68A", background: C.amberBg }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                  <div><div className="mlbl" style={{ color: C.amber }}>Tax Estimate ({settings.tax_rate}%)</div><div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 24, fontWeight: 700, color: C.amber }}>{fmt(metrics.taxEstimate)}</div><div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>Set this aside — not yours to spend</div></div>
                  <div style={{ textAlign: "right" }}><div className="mlbl">Real Take-Home</div><div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 24, fontWeight: 700, color: C.green }}>{fmt(metrics.takeHome)}</div></div>
                </div>
              </div>
            )}
            {transactions.length === 0
              ? <div className="card"><EmptyState icon="💡" title="Your dashboard is empty" body="Add your first event and some transactions to see your money flow here." btnLabel="+ Add Transaction" onBtn={() => setShowAddTx(true)} /></div>
              : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="card">
                    <div className="slbl">Money Flow</div>
                    <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                      {(() => { const tot = metrics.totalIncome + metrics.operationalExpenses; const p = tot > 0 ? (metrics.totalIncome/tot*100) : 50; return <><div style={{ width: `${p}%`, background: "#10B981" }}/><div style={{ flex: 1, background: "#F87171" }}/></>; })()}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: C.green, fontWeight: 600 }}>▲ {fmt(metrics.totalIncome)}</span><span style={{ color: C.red, fontWeight: 600 }}>{fmt(metrics.operationalExpenses)} ▼</span></div>
                  </div>
                  <div className="card">
                    <div className="slbl">Top Expenses</div>
                    {(() => {
                      const fl = activeEventFilter === "all" ? transactions : transactions.filter(t => t.event_id === Number(activeEventFilter));
                      const cats = {}; fl.filter(t => t.type === "expense").forEach(t => { cats[t.category] = (cats[t.category]||0)+t.amount; });
                      const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,4); const mx = sorted[0]?.[1]||1;
                      const clr = { Marketing:"#F59E0B", Supplies:"#3B82F6", Labor:"#EC4899", "Venue/Rent":"#8B5CF6", "Food & Bev":"#10B981", Equipment:"#6366F1", Other:C.slate };
                      return sorted.length === 0 ? <div style={{ color: C.muted, fontSize: 13 }}>No expenses yet</div> : sorted.map(([cat, amt]) => (
                        <div key={cat} style={{ marginBottom: 12 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span style={{ fontWeight: 500 }}>{cat}</span><span style={{ fontWeight: 600 }}>{fmt(amt)}</span></div><Bar value={amt} max={mx} color={clr[cat]||C.blue} /></div>
                      ));
                    })()}
                  </div>
                </div>
            }
          </div>
        )}

        {/* EVENTS */}
        {activeTab === "events" && !selectedEventId && (
          <div className="fu">
            <TipCard tabKey="events" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10, flexWrap: "wrap" }}>
              <div className="slbl" style={{ margin: 0 }}>{showArchived ? "Archived Events" : "Your Events"}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-o" style={{ fontSize: 12 }} onClick={() => setShowArchived(!showArchived)}>{showArchived ? "← Active Events" : "📦 Archived"}</button>
                {!showArchived && <button className="btn-p" onClick={() => setShowAddEvent(true)}>+ New Event</button>}
              </div>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {eventBreakdowns.filter(ev => showArchived ? ev.archived : !ev.archived).map(ev => (
                <div key={ev.id} className="card" onClick={(e) => { if (e.target.closest(".event-actions")) return; ev.name !== "General Operations" && setSelectedEventId(ev.id); }}
                  style={{ borderLeft: `4px solid ${ev.archived ? C.muted : ev.net > 0 ? C.green : ev.net < 0 ? C.red : C.border}`, cursor: ev.name === "General Operations" ? "default" : "pointer", transition: "transform 0.15s, box-shadow 0.15s", opacity: ev.archived ? 0.7 : 1 }}
                  onMouseEnter={e => { if (ev.name !== "General Operations") { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.06)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: ev.name === "General Operations" ? 0 : 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 18, color: C.navy }}>{ev.name}</div>
                        {ev.archived && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: C.slateLight, color: C.muted }}>ARCHIVED</span>}
                        {!ev.archived && ev.name !== "General Operations" && <span style={{ fontSize: 11, color: C.muted }}>›</span>}
                      </div>
                      {ev.date && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{ev.date}</div>}
                      {ev.name === "General Operations" && (
                        <div style={{ marginTop: 12, marginBottom: 18, background: C.blueLight, border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 14px", maxWidth: 520 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>💡 What goes here?</div>
                          <p style={{ fontSize: 13, color: C.slate, lineHeight: 1.65, margin: 0 }}><strong>General Operations</strong> is your catch-all for day-to-day costs not tied to one specific event — things like <strong>monthly supplies</strong>, <strong>packaging</strong>, <strong>business insurance</strong>, <strong>app subscriptions</strong>, or <strong>payment processor fees</strong>.</p>
                        </div>
                      )}
                      {ev.name !== "General Operations" && ev.income === 0 && ev.expenses === 0 && <div style={{ marginTop: 8, fontSize: 13, color: C.muted }}>No transactions yet — tap to add income and expenses.</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                      <div style={{ textAlign: "right", flexShrink: 0, paddingLeft: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Net</div>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 22, color: ev.net > 0 ? C.green : ev.net < 0 ? C.red : C.muted }}>{ev.net > 0 ? "+" : ""}{fmt(ev.net)}</div>
                      </div>
                      {ev.name !== "General Operations" && (
                        <div className="event-actions" style={{ display: "flex", gap: 4 }}>
                          <button onClick={(e) => { e.stopPropagation(); setEditEvent({ ...ev, product_ids: ev.product_ids || "" }); }} title="Edit"
                            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>✎</button>
                          {ev.archived
                            ? <>
                                <button onClick={(e) => { e.stopPropagation(); unarchiveEvent(ev.id); }} title="Unarchive" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>↶</button>
                                <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Permanently delete "${ev.name}"? This cannot be undone.`)) deleteEvent(ev.id); }} title="Delete" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid #FECACA`, background: "white", cursor: "pointer", color: C.red, fontSize: 14 }}>×</button>
                              </>
                            : <button onClick={(e) => { e.stopPropagation(); archiveEvent(ev.id); }} title="Archive" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>📦</button>
                          }
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", paddingTop: 14, borderTop: `1px solid ${C.border}`, marginBottom: ev.goal_revenue > 0 ? 14 : 0 }}>
                    {[["Revenue", fmt(ev.income), C.green], ["Expenses", fmt(ev.expenses), C.red], ["Margin", ev.income > 0 ? `${((ev.net/ev.income)*100).toFixed(0)}%` : "—", C.navy], ["Tax Est.", fmt(ev.taxEstimate), C.amber]].map(([lbl, val, col]) => (
                      <div key={lbl}><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{lbl}</div><div style={{ fontSize: 15, fontWeight: 700, color: col }}>{val}</div></div>
                    ))}
                    {ev.miles_driven > 0 && <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Mileage</div><div style={{ fontSize: 15, fontWeight: 700, color: C.teal }}>{fmt(ev.mileageDeduction)}</div></div>}
                  </div>
                  {ev.goal_revenue > 0 && <div style={{ marginTop: 14 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span style={{ fontWeight: 600, color: C.slate }}>Revenue Goal</span><span style={{ fontWeight: 600, color: ev.income >= ev.goal_revenue ? C.green : C.slate }}>{fmt(ev.income)} / {fmt(ev.goal_revenue)}</span></div><Bar value={ev.income} max={ev.goal_revenue} color={ev.income >= ev.goal_revenue ? C.green : C.blue} /></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EVENT DETAIL VIEW */}
        {activeTab === "events" && selectedEventId && (() => {
          const ev = eventBreakdowns.find(e => e.id === selectedEventId);
          if (!ev) { setSelectedEventId(null); return null; }
          const evTx = transactions.filter(t => t.event_id === selectedEventId);
          const evSales = salesByEvent.find(s => s.name === ev.name);
          return (
            <div className="fu">
              <button onClick={() => setSelectedEventId(null)} style={{ background: "none", border: "none", color: C.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", padding: 0, marginBottom: 16 }}>← Back to all events</button>

              <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${ev.net > 0 ? C.green : ev.net < 0 ? C.red : C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 24, color: C.navy }}>{ev.name}</div>
                    {ev.date && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{ev.date}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Net Profit</div>
                    <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 32, color: ev.net > 0 ? C.green : ev.net < 0 ? C.red : C.muted }}>{ev.net > 0 ? "+" : ""}{fmt(ev.net)}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  {[["Revenue", fmt(ev.income), C.green], ["Expenses", fmt(ev.expenses), C.red], ["Margin", ev.income > 0 ? `${((ev.net/ev.income)*100).toFixed(0)}%` : "—", C.navy], ["Tax Est.", fmt(ev.taxEstimate), C.amber], ...(ev.miles_driven > 0 ? [["Mileage", fmt(ev.mileageDeduction), C.teal]] : [])].map(([lbl, val, col]) => (
                    <div key={lbl}><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{lbl}</div><div style={{ fontSize: 16, fontWeight: 700, color: col }}>{val}</div></div>
                  ))}
                </div>
                {ev.goal_revenue > 0 && <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span style={{ fontWeight: 600, color: C.slate }}>Revenue Goal</span><span style={{ fontWeight: 600, color: ev.income >= ev.goal_revenue ? C.green : C.slate }}>{fmt(ev.income)} / {fmt(ev.goal_revenue)}</span></div><Bar value={ev.income} max={ev.goal_revenue} color={ev.income >= ev.goal_revenue ? C.green : C.blue} /></div>}
                {ev.notes && <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Notes</div><div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{ev.notes}</div></div>}
                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  <button className="btn-p" style={{ fontSize: 12 }} onClick={() => { setTxForm(f => ({ ...f, eventId: ev.id })); setShowAddTx(true); }}>+ Add Transaction</button>
                  <button className="btn-o" style={{ fontSize: 12 }} onClick={() => { setBreakEvenEventId(String(ev.id)); setActiveTab("breakeven"); }}>⚖ Live Sales Tracker</button>
                  <button className="btn-o" style={{ fontSize: 12 }} onClick={() => printReport(ev)}>📄 Export Report</button>
                </div>
              </div>

              {/* Transactions for this event */}
              <div className="slbl" style={{ marginBottom: 12 }}>{evTx.length} Transactions</div>
              <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
                {evTx.length === 0
                  ? <div style={{ padding: 20, color: C.muted, fontSize: 13, textAlign: "center" }}>No transactions yet for this event.</div>
                  : [...evTx].sort((a, b) => (b.date||"").localeCompare(a.date||"")).map(tx => (
                    <div key={tx.id} className="txrow">
                      <div style={{ width: 32, height: 32, borderRadius: 10, background: tx.type === "income" ? C.greenBg : tx.is_owner_funded ? C.purpleBg : C.redBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                        {tx.type === "income" ? "↑" : tx.is_owner_funded ? "★" : "↓"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{tx.category} · {tx.date}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: tx.type === "income" ? C.green : tx.is_owner_funded ? C.purple : C.red, flexShrink: 0 }}>{tx.type === "income" ? "+" : "-"}{fmt(tx.amount)}</div>
                      <button onClick={() => setEditTx({ ...tx })} title="Edit" style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 11, marginRight: 4 }}>✎</button>
                      <button className="del" onClick={() => deleteTransaction(tx.id)}>×</button>
                    </div>
                  ))
                }
              </div>

              {/* Product sales for this event */}
              {evSales && Object.keys(evSales.prods).length > 0 && (
                <>
                  <div className="slbl" style={{ marginBottom: 12 }}>Product Sales</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8, marginBottom: 16 }}>
                    {Object.entries(evSales.prods).sort((a,b)=>b[1].qty-a[1].qty).map(([name, data]) => (
                      <div key={name} className="card" style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>{data.qty} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>sold</span></div>
                        <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginTop: 2 }}>{fmt(data.revenue)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* TRANSACTIONS */}
        {activeTab === "transactions" && (
          <div className="fu">
            <TipCard tabKey="transactions" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div className="slbl" style={{ margin: 0 }}>{displayTransactions.length} Transactions</div>
              <button className="btn-p" onClick={() => setShowAddTx(true)}>+ Add</button>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {displayTransactions.length === 0
                ? <EmptyState icon="↕️" title="No transactions yet" body="Every dollar in or out gets logged here." btnLabel="+ Add Transaction" onBtn={() => setShowAddTx(true)} />
                : [...displayTransactions].sort((a, b) => (b.date||"").localeCompare(a.date||"")).map(tx => (
                  <div key={tx.id} className="txrow">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: tx.type === "income" ? C.greenBg : tx.is_owner_funded ? C.purpleBg : C.redBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                      {tx.type === "income" ? "↑" : tx.is_owner_funded ? "★" : "↓"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{tx.category} · <span style={{ background: tx.is_owner_funded ? C.purpleBg : C.slateLight, color: tx.is_owner_funded ? C.purple : C.slate, padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{tx.is_owner_funded ? "★ Owner" : tx.source}</span> · {events.find(e => e.id === tx.event_id)?.name} · {tx.date}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tx.type === "income" ? C.green : tx.is_owner_funded ? C.purple : C.red, flexShrink: 0 }}>{tx.type === "income" ? "+" : "-"}{fmt(tx.amount)}</div>
                    <button onClick={() => setEditTx({ ...tx })} title="Edit" style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 11, marginRight: 4 }}>✎</button>
                    <button className="del" onClick={() => deleteTransaction(tx.id)}>×</button>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* BREAKEVEN */}
        {/* BLUE ROOTS TAB */}
        {activeTab === "blueroots" && (
          <div className="fu">
            {/* Educational header */}
            <div className="card" style={{ marginBottom: 20, background: "linear-gradient(135deg, #1B2A4A 0%, #2D4270 100%)", borderColor: C.navy }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 32 }}>🌿</span>
                <div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 22, color: "#F5F0E8", fontWeight: 500 }}>Blue Roots</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 10, letterSpacing: "0.14em", color: "#8BBF9A", marginTop: 2, textTransform: "uppercase" }}>Get to the root of your real cost</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, margin: "12px 0" }}>
                Most vendors guess at their costs and end up underpricing. <strong style={{ color: "#5CC882" }}>Blue Roots changes that.</strong>
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.65, margin: 0 }}>
                You buy supplies in bulk — wax, jars, ingredients, packaging — but you sell ONE product at a time. Blue Roots breaks down what each individual product actually costs you to make. That number powers everything else: your real profit per sale, accurate break-even, and confident pricing.
              </p>
              <div style={{ background: "rgba(92,200,130,0.15)", border: "1px solid rgba(92,200,130,0.3)", borderRadius: 10, padding: "12px 14px", marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5CC882", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>How it works</div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, margin: 0 }}>
                  Save your supplies once with bulk cost + bulk quantity. Then when you build a product, just say how much of each supply goes into one unit. The app does the math for you.
                </p>
              </div>
            </div>

            {/* My Supplies */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="slbl" style={{ margin: 0 }}>My Supplies Library</div>
              <button className="btn-p" onClick={() => setShowAddSupply(true)}>+ Add Supply</button>
            </div>
            {supplies.length === 0
              ? <div className="card" style={{ marginBottom: 24 }}><EmptyState icon="🌿" title="No supplies saved yet" body="Add the raw materials you buy in bulk — wax, jars, fragrance oil, ingredients, packaging. Then reuse them across all your products." btnLabel="+ Add Your First Supply" onBtn={() => setShowAddSupply(true)} /></div>
              : (
                <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                  {supplies.map(sup => {
                    const perUnit = sup.bulk_qty > 0 ? sup.bulk_cost / sup.bulk_qty : 0;
                    const isLow = sup.low_stock_threshold > 0 && (sup.current_qty || 0) <= sup.low_stock_threshold;
                    return (
                      <div key={sup.id} className="card" style={{ padding: "16px 20px", borderLeft: `4px solid ${isLow ? C.amber : C.green}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy }}>{sup.name}</div>
                              {isLow && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: C.amberBg, color: C.amber }}>LOW STOCK</span>}
                            </div>
                            <div style={{ fontSize: 12, color: C.muted }}>{fmt(sup.bulk_cost)} for {sup.bulk_qty} {sup.unit} → <strong style={{ color: C.green }}>{fmt(perUnit)} per {sup.unit}</strong></div>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setEditSupply({ ...sup })} title="Edit" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>✎</button>
                            <button className="del" onClick={() => deleteSupply(sup.id)}>×</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }

            {/* My Products */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="slbl" style={{ margin: 0 }}>My Products</div>
              <button className="btn-p" onClick={() => setShowAddProduct(true)}>+ Add Product</button>
            </div>
            {products.length === 0
              ? <div className="card"><EmptyState icon="📦" title="No products yet" body="Once you've added your supplies above, build your products and Blue Roots will calculate the true cost per unit." btnLabel="+ Add Product" onBtn={() => setShowAddProduct(true)} /></div>
              : (
                <div style={{ display: "grid", gap: 10 }}>
                  {products.map(p => {
                    const margin = p.price > 0 ? ((p.price - (p.cogs||0)) / p.price) * 100 : 0;
                    const suggested = (p.cogs || 0) * 2.5; // 60% margin
                    return (
                      <div key={p.id} className="card" style={{ padding: "16px 20px", borderLeft: `4px solid ${margin >= 30 ? C.green : margin > 0 ? C.amber : C.red}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                          <div>
                            <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>You sell at {fmt(p.price)} · Stock: {p.stock || 0}</div>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setEditProduct({ ...p })} title="Edit" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>✎</button>
                            <button className="del" onClick={() => deleteProduct(p.id)}>×</button>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 12 }}>
                          <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Real Cost</div><div style={{ fontSize: 17, fontWeight: 700, color: C.red }}>{fmt(p.cogs||0)}</div></div>
                          <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Profit/Sale</div><div style={{ fontSize: 17, fontWeight: 700, color: C.green }}>{fmt(p.price - (p.cogs||0))}</div></div>
                          <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Margin</div><div style={{ fontSize: 17, fontWeight: 700, color: margin >= 30 ? C.green : margin > 0 ? C.amber : C.red }}>{pct(margin)}</div></div>
                          {p.cogs > 0 && <div><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Suggested</div><div style={{ fontSize: 17, fontWeight: 700, color: C.purple }}>{fmt(suggested)}</div><div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>for 60% margin</div></div>}
                        </div>
                        {margin > 0 && margin < 30 && <div style={{ background: C.amberBg, borderRadius: 8, padding: "8px 12px", marginTop: 10, fontSize: 12, color: C.amber, fontWeight: 500 }}>💡 Margin under 30%. Consider raising your price to {fmt(suggested)} for a healthy 60% margin.</div>}
                        {margin <= 0 && p.price > 0 && <div style={{ background: C.redBg, borderRadius: 8, padding: "8px 12px", marginTop: 10, fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ You're losing money on every sale! Raise your price.</div>}
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        )}


        {activeTab === "breakeven" && (
          <div className="fu">
            <TipCard tabKey="breakeven" onAction={() => setShowAddProduct(true)} />
            <div className="card" style={{ marginBottom: 20, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>Analyzing:</span>
                <button className={`pill${breakEvenEventId === "all" ? " on" : ""}`} onClick={() => setBreakEvenEventId("all")}>All Events</button>
                {events.map(ev => <button key={ev.id} className={`pill${breakEvenEventId === String(ev.id) ? " on" : ""}`} onClick={() => setBreakEvenEventId(String(ev.id))}>{ev.name}</button>)}
              </div>
            </div>
            {products.length > 0 && (() => {
              const selectedEvent = breakEvenEventId === "all" ? null : events.find(e => String(e.id) === breakEvenEventId);
              const eventProductIds = selectedEvent?.product_ids ? selectedEvent.product_ids.split(",").filter(Boolean).map(Number) : null;
              const visibleProducts = eventProductIds && eventProductIds.length > 0 ? products.filter(p => eventProductIds.includes(p.id)) : products;
              return (
              <>
              {/* Sales entry mode buttons */}
              <div className="card" style={{ marginBottom: 12, padding: "14px 18px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Three Ways to Track Sales</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
                  <button onClick={() => { setQuickEntryEventId(breakEvenEventId !== "all" ? breakEvenEventId : (events.find(e => e.name !== "General Operations")?.id || "")); setShowQuickEntry(true); }}
                    style={{ background: "white", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.background = C.blueLight; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "white"; }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>⚡</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Quick Entry</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>Enter totals after the event</div>
                  </button>
                  <button onClick={() => { setCsvImportEventId(breakEvenEventId !== "all" ? breakEvenEventId : (events.find(e => e.name !== "General Operations")?.id || "")); setShowCsvImport(true); }}
                    style={{ background: "white", border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.background = C.blueLight; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "white"; }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>📋</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Import from Square/Etsy</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>Paste CSV from any platform</div>
                  </button>
                  <div style={{ background: C.blueLight, border: `1.5px solid ${C.blue}`, borderRadius: 12, padding: "12px 14px", textAlign: "left" }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>👇</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Live Tracker (below)</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>Tap + during the event</div>
                  </div>
                </div>
              </div>
              <div className="card" style={{ marginBottom: 20, borderColor: "#BFDBFE", background: C.blueLight }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }}/><span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Live Sales Tracker</span></div>
                  {hasLiveSales && <div style={{ display: "flex", gap: 8 }}><button className="btn-p" style={{ fontSize: 11, padding: "5px 14px", background: C.green }} onClick={() => setShowSaveConfirm(true)}>Save to History</button><button className="btn-o" style={{ fontSize: 11, padding: "5px 12px", color: C.red, borderColor: "#FECACA" }} onClick={() => setLiveSales({})}>Reset</button></div>}
                </div>
                <div style={{ fontSize: 12, color: C.slate, marginBottom: 16 }}>
                  {selectedEvent && eventProductIds && eventProductIds.length > 0
                    ? `Showing products you tagged for ${selectedEvent.name} · Tap + as you make sales`
                    : "Tap + as you make sales — everything updates instantly"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
                  {visibleProducts.map(p => {
                    const qty = liveSales[p.id] || 0;
                    return (
                      <div key={p.id} style={{ background: qty > 0 ? C.surface : "#F8FAFC", border: `1.5px solid ${qty > 0 ? C.green : C.border}`, borderRadius: 12, padding: "12px 14px", transition: "all 0.2s" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.slate, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{fmt(p.price)} · profit {fmt(p.price-(p.cogs||0))}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex" }}>
                            <button onClick={() => setLiveSales(s => ({ ...s, [p.id]: Math.max(0,(s[p.id]||0)-1) }))} style={{ width: 28, height: 28, borderRadius: "8px 0 0 8px", border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", fontSize: 18, fontWeight: 600, color: C.slate }}>−</button>
                            <div style={{ width: 36, height: 28, background: qty > 0 ? C.navy : C.slateLight, color: qty > 0 ? "white" : C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>{qty}</div>
                            <button onClick={() => setLiveSales(s => ({ ...s, [p.id]: (s[p.id]||0)+1 }))} style={{ width: 28, height: 28, borderRadius: "0 8px 8px 0", border: `1px solid ${C.blue}`, background: C.blue, cursor: "pointer", fontSize: 18, fontWeight: 700, color: "white" }}>+</button>
                          </div>
                          {qty > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>{fmt(qty*p.price)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {beMetrics.liveRevenue > 0 && <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #BFDBFE", display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, color: C.slate }}>Live total</span><span style={{ fontSize: 16, fontWeight: 700, color: C.green }}>+{fmt(beMetrics.liveRevenue)}</span></div>}
              </div>
              </>
              );
            })()}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div className="card"><div className="mlbl">Total Spent</div><div className="big" style={{ color: C.red }}>{fmt(beMetrics.operationalExpenses)}</div></div>
              <div className="card"><div className="mlbl">Revenue Earned</div><div className="big" style={{ color: C.green }}>{fmt(beMetrics.totalIncome)}</div>{beMetrics.liveRevenue > 0 && <div style={{ fontSize: 11, color: C.green, fontWeight: 600, marginTop: 4 }}>incl. {fmt(beMetrics.liveRevenue)} live</div>}<div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{beMetrics.profit >= 0 ? `${fmt(beMetrics.profit)} ahead` : `${fmt(Math.abs(beMetrics.profit))} to go`}</div></div>
            </div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="slbl">Gap to Break Even</div>
              {beMetrics.operationalExpenses === 0 && beMetrics.totalIncome === 0
                ? <div style={{ color: C.muted, fontSize: 14 }}>Add transactions and products to see your break-even analysis.</div>
                : beMetrics.profit >= 0
                  ? <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 28 }}>🎉</span><div><div style={{ fontWeight: 700, fontSize: 16, color: C.green }}>Already profitable!</div><div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Up {fmt(beMetrics.profit)} over costs</div></div></div>
                  : <div><div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}><div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 36, color: C.red }}>{fmt(Math.abs(beMetrics.profit))}</div><div style={{ fontSize: 14, color: C.muted }}>still needed</div></div><Bar value={beMetrics.totalIncome} max={beMetrics.operationalExpenses} color={C.blue} /><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginTop: 8 }}><span>{((beMetrics.totalIncome/(beMetrics.operationalExpenses||1))*100).toFixed(0)}% covered</span><span>Goal {fmt(beMetrics.operationalExpenses)}</span></div></div>
              }
            </div>
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div className="slbl" style={{ margin: 0 }}>Your Products</div>
                <button className="btn-o" style={{ fontSize: 12, padding: "6px 14px" }} onClick={() => setShowAddProduct(true)}>+ Add Product</button>
              </div>
              {products.length === 0
                ? <EmptyState icon="📦" title="No products yet" body="Add the items you sell with your sale price and cost to make." btnLabel="+ Add Product" onBtn={() => setShowAddProduct(true)} />
                : <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
                      {products.map(p => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.slateLight, borderRadius: 10, padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: C.blue }}/><span style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</span></div>
                          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{fmt(p.price)}</div><div style={{ fontSize: 11, color: C.muted }}>costs {fmt(p.cogs||0)} · {p.price > 0 ? pct(((p.price-(p.cogs||0))/p.price)*100) : "—"} margin</div></div>
                            <button className="del" onClick={() => deleteProduct(p.id)}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {beMetrics.profit < 0 && (
                      <>
                        <div className="slbl" style={{ marginBottom: 14 }}>Units Needed to Break Even</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(145px,1fr))", gap: 10 }}>
                          {productScenarios.map(p => (
                            <div key={p.id} style={{ background: C.amberBg, border: "1px solid #FDE68A", borderRadius: 12, padding: 16 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{p.name}</div>
                              <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 32, color: C.navy, lineHeight: 1 }}>{p.unitsToBreakEven}</div>
                              <div style={{ fontSize: 12, color: C.slate, marginTop: 6 }}>units @ {fmt(p.grossProfit)} profit each</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {beMetrics.profit >= 0 && beMetrics.operationalExpenses > 0 && <div style={{ background: C.greenBg, borderRadius: 12, padding: 16, border: "1px solid #A7F3D0" }}><div style={{ fontWeight: 600, color: C.green, fontSize: 14 }}>✓ Already profitable! Every sale is pure profit.</div></div>}
                  </>
              }
            </div>
          </div>
        )}

        {/* INVENTORY */}
        {activeTab === "inventory" && (
          <div className="fu">
            <TipCard tabKey="inventory" onAction={() => setShowAddProduct(true)} />

            {/* Inventory Hub Summary */}
            {(() => {
              const finishedValue = inventoryData.reduce((s,p)=>s+p.stockValue,0);
              const rawValue = supplies.reduce((s, sup) => {
                const perUnit = sup.bulk_qty > 0 ? sup.bulk_cost / sup.bulk_qty : 0;
                return s + (perUnit * (sup.current_qty || 0));
              }, 0);
              const totalValue = finishedValue + rawValue;
              const lowSupplies = supplies.filter(s => s.low_stock_threshold > 0 && (s.current_qty || 0) <= s.low_stock_threshold).length;
              const lowProducts = inventoryData.filter(p => p.remaining > 0 && p.remaining <= 5).length;
              const outProducts = inventoryData.filter(p => p.remaining === 0 && p.stock > 0).length;
              return (
                <>
                  <div className="card" style={{ marginBottom: 20, background: "linear-gradient(135deg, #1B2A4A 0%, #2D4270 100%)", borderColor: C.navy, padding: "20px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <span style={{ fontSize: 24 }}>📦</span>
                      <div>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 18, color: "white" }}>Inventory Hub</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Everything you have on hand, valued in real time</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Value</div>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 26, fontWeight: 700, color: "#5CC882", lineHeight: 1, marginTop: 6 }}>{fmt(totalValue)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Raw Materials</div>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 26, fontWeight: 700, color: "white", lineHeight: 1, marginTop: 6 }}>{fmt(rawValue)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Finished Products</div>
                        <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontSize: 26, fontWeight: 700, color: "white", lineHeight: 1, marginTop: 6 }}>{fmt(finishedValue)}</div>
                      </div>
                    </div>
                  </div>

                  {(lowSupplies > 0 || lowProducts > 0 || outProducts > 0) && (
                    <div className="card" style={{ marginBottom: 20, background: C.amberBg, borderColor: "#FDE68A" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <div style={{ fontWeight: 700, color: C.amber, fontSize: 14 }}>Stock Alerts</div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13, color: C.slate }}>
                        {outProducts > 0 && <span><strong style={{ color: C.red }}>{outProducts}</strong> {outProducts === 1 ? "product is" : "products are"} out of stock</span>}
                        {lowProducts > 0 && <span><strong style={{ color: C.amber }}>{lowProducts}</strong> {lowProducts === 1 ? "product has" : "products have"} low stock</span>}
                        {lowSupplies > 0 && <span><strong style={{ color: C.amber }}>{lowSupplies}</strong> {lowSupplies === 1 ? "supply is" : "supplies are"} running low</span>}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Raw Materials Section */}
            {supplies.length > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, marginTop: 6 }}>
                  <div className="slbl" style={{ margin: 0 }}>🌿 Raw Materials</div>
                  <button className="btn-o" style={{ fontSize: 12 }} onClick={() => setShowAddSupply(true)}>+ Add Supply</button>
                </div>
                <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                  {supplies.map(sup => {
                    const perUnit = sup.bulk_qty > 0 ? sup.bulk_cost / sup.bulk_qty : 0;
                    const value = perUnit * (sup.current_qty || 0);
                    const isLow = sup.low_stock_threshold > 0 && (sup.current_qty || 0) <= sup.low_stock_threshold;
                    const pctRemaining = sup.bulk_qty > 0 ? ((sup.current_qty || 0) / sup.bulk_qty) * 100 : 0;
                    return (
                      <div key={sup.id} className="card" style={{ padding: "14px 18px", borderLeft: `4px solid ${isLow ? C.amber : C.green}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 15, color: C.navy }}>{sup.name}</div>
                              {isLow && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: C.amberBg, color: C.amber }}>LOW</span>}
                            </div>
                            <div style={{ fontSize: 12, color: C.muted }}>{fmt(perUnit)} per {sup.unit}</div>
                          </div>
                          <button onClick={() => setEditSupply({ ...sup })} title="Edit" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>✎</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>On Hand</div><div style={{ fontSize: 16, fontWeight: 700, color: isLow ? C.amber : C.navy, marginTop: 2 }}>{sup.current_qty || 0} {sup.unit}</div></div>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Value</div><div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginTop: 2 }}>{fmt(value)}</div></div>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Original</div><div style={{ fontSize: 16, fontWeight: 700, color: C.muted, marginTop: 2 }}>{sup.bulk_qty} {sup.unit}</div></div>
                        </div>
                        {sup.bulk_qty > 0 && <div style={{ marginTop: 10 }}><Bar value={sup.current_qty || 0} max={sup.bulk_qty} color={isLow ? C.amber : C.green} /></div>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Finished Products Section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="slbl" style={{ margin: 0 }}>📦 Finished Products</div>
              <button className="btn-p" onClick={() => setShowAddProduct(true)}>+ Add Product</button>
            </div>
            {inventoryData.length === 0
              ? <div className="card"><EmptyState icon="📦" title="No products tracked yet" body="Add your products with a starting stock count and the app tracks what sells." btnLabel="+ Add Product" onBtn={() => setShowAddProduct(true)} /></div>
              : (
                <div style={{ display: "grid", gap: 12 }}>
                  {inventoryData.map(p => {
                    const low = p.remaining <= 5 && p.remaining > 0, out = p.remaining === 0 && p.stock > 0;
                    return (
                      <div key={p.id} className="card" style={{ borderLeft: `4px solid ${out ? C.red : low ? C.amber : C.green}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 10 }}>
                          <div><div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy }}>{p.name}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Sell {fmt(p.price)} · Cost {fmt(p.cogs||0)} · {p.price > 0 ? pct(((p.price-(p.cogs||0))/p.price)*100) : "—"} margin</div></div>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {(out||low) && <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: out ? C.redBg : C.amberBg, color: out ? C.red : C.amber }}>{out ? "Out" : "Low"}</span>}
                            <button onClick={() => setEditProduct({ ...p })} title="Edit" style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 12 }}>✎</button>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
                          {[["Started", p.stock, C.slate], ["Sold", p.soldFromHistory, C.green], ["Remaining", p.remaining, out ? C.red : low ? C.amber : C.navy], ["Value", fmt(p.stockValue), C.teal]].map(([lbl, val, col]) => (
                            <div key={lbl}><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{lbl}</div><div style={{ fontSize: 18, fontWeight: 700, color: col }}>{val}</div></div>
                          ))}
                        </div>
                        <Bar value={p.soldFromHistory} max={p.stock||1} color={C.green} />
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{p.stock > 0 ? ((p.soldFromHistory/p.stock)*100).toFixed(0) : 0}% sold</div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        )}

        {/* GOALS */}
        {activeTab === "goals" && (
          <div className="fu">
            <TipCard tabKey="goals" onAction={() => { setSettingsForm({ tax_rate: settings.tax_rate, monthly_goal: settings.monthly_goal }); setShowSettings(true); }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div className="slbl" style={{ margin: 0 }}>Goals & Tax Planning</div>
              <button className="btn-o" onClick={() => { setSettingsForm({ tax_rate: settings.tax_rate, monthly_goal: settings.monthly_goal }); setShowSettings(true); }}>⚙ Edit Settings</button>
            </div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div><div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy }}>Monthly Revenue Goal</div><div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Current month</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{fmt(monthlyIncome)}</div><div style={{ fontSize: 12, color: C.muted }}>of {settings.monthly_goal > 0 ? fmt(settings.monthly_goal) : "no goal set"}</div></div>
              </div>
              {settings.monthly_goal > 0
                ? <><Bar value={monthlyIncome} max={settings.monthly_goal} color={monthlyIncome >= settings.monthly_goal ? C.green : C.blue} height={12} /><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, marginTop: 8 }}><span>{pct((monthlyIncome/settings.monthly_goal)*100)} complete</span><span>{settings.monthly_goal > monthlyIncome ? `${fmt(settings.monthly_goal - monthlyIncome)} remaining` : "Goal reached! 🎉"}</span></div></>
                : <button className="btn-o" style={{ fontSize: 12, padding: "7px 14px", marginTop: 8 }} onClick={() => { setSettingsForm({ tax_rate: settings.tax_rate, monthly_goal: settings.monthly_goal }); setShowSettings(true); }}>Set a monthly goal →</button>
              }
            </div>
            <div className="slbl" style={{ marginBottom: 14, marginTop: 8 }}>Event Goals</div>
            {events.filter(ev => ev.goal_revenue > 0).length === 0
              ? <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>No event goals set yet. Add a revenue goal when creating a new event.</div>
              : <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>{events.filter(ev => ev.goal_revenue > 0).map(ev => { const bd = eventBreakdowns.find(e => e.id === ev.id); return (<div key={ev.id} className="card" style={{ padding: "16px 20px" }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><div style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{ev.name}</div><div style={{ fontSize: 13, fontWeight: 700, color: bd.income >= ev.goal_revenue ? C.green : C.slate }}>{fmt(bd.income)} / {fmt(ev.goal_revenue)}</div></div><Bar value={bd.income} max={ev.goal_revenue} color={bd.income >= ev.goal_revenue ? C.green : C.blue} /></div>); })}</div>
            }
            <div className="slbl" style={{ marginBottom: 14 }}>Tax Planning</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div className="card" style={{ background: C.amberBg, borderColor: "#FDE68A" }}><div className="mlbl" style={{ color: C.amber }}>Tax Estimate</div><div className="big" style={{ color: C.amber }}>{fmt(metrics.taxEstimate)}</div><div style={{ fontSize: 12, color: C.slate, marginTop: 8 }}>{settings.tax_rate}% of profit</div></div>
              <div className="card" style={{ background: C.greenBg, borderColor: "#A7F3D0" }}><div className="mlbl">Real Take-Home</div><div className="big" style={{ color: C.green }}>{fmt(metrics.takeHome)}</div><div style={{ fontSize: 12, color: C.slate, marginTop: 8 }}>After taxes</div></div>
            </div>
            <div className="card" style={{ background: C.slateLight }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 8 }}>💡 Tax tip for market vendors</div>
              <p style={{ fontSize: 13, color: C.slate, lineHeight: 1.65, margin: 0 }}>As a self-employed vendor you are responsible for <strong>self-employment tax (~15.3%)</strong> plus income tax on profits. Setting aside <strong>{settings.tax_rate}%</strong> is a safe starting point. Keep receipts for booth fees, supplies, mileage, and equipment — all potentially deductible. Consult a tax professional for advice specific to your situation.</p>
            </div>
          </div>
        )}

        {/* BEST SELLERS */}
        {activeTab === "bestsellers" && (
          <div className="fu">
            <TipCard tabKey="bestsellers" />
            {bestSellers.length === 0
              ? <div className="card"><EmptyState icon="🏆" title="No sales history yet" body="Use the Live Sales Tracker in Break-Even during an event, then tap Save to History." /></div>
              : <>
                  <div className="slbl" style={{ marginBottom: 14 }}>Overall Best Sellers</div>
                  <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
                    {bestSellers.map((p, i) => {
                      const mx = bestSellers[0].totalQty, medal = ["🥇","🥈","🥉"][i] || `#${i+1}`, bc = i === 0 ? "#F59E0B" : i === 1 ? "#94A3B8" : i === 2 ? "#CD7F32" : C.blue;
                      return (
                        <div key={p.name} className="card" style={{ padding: "16px 20px", borderLeft: `4px solid ${bc}` }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontSize: 20 }}>{medal}</span>
                              <div><div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy }}>{p.name}</div><div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fmt(p.price)} sell · {fmt(p.cogs)} cost · {p.price > 0 ? pct(((p.price-p.cogs)/p.price)*100) : "—"} margin</div></div>
                            </div>
                            <div style={{ textAlign: "right" }}><div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 20, color: C.navy }}>{p.totalQty} <span style={{ fontSize: 13, fontWeight: 400, color: C.muted }}>sold</span></div><div style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{fmt(p.totalRevenue)}</div><div style={{ fontSize: 12, color: C.purple, fontWeight: 600 }}>{fmt(p.grossProfit)} profit</div></div>
                          </div>
                          <Bar value={p.totalQty} max={mx} color={bc} />
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>{p.eventNames.map(ev => <span key={ev} style={{ fontSize: 11, fontWeight: 500, background: C.slateLight, color: C.slate, padding: "3px 10px", borderRadius: 20 }}>{ev}</span>)}</div>
                        </div>
                      );
                    })}
                  </div>
                  {salesByEvent.length > 0 && <>
                    <div className="slbl" style={{ marginBottom: 14 }}>Sales by Event</div>
                    <div style={{ display: "grid", gap: 12 }}>
                      {salesByEvent.map((ev, i) => (
                        <div key={i} className="card">
                          <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 4 }}>{ev.name}</div>
                          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{ev.date}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
                            {Object.entries(ev.prods).sort((a,b)=>b[1].qty-a[1].qty).map(([name, data]) => (
                              <div key={name} style={{ background: C.slateLight, borderRadius: 10, padding: "10px 12px" }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: C.navy }}>{data.qty} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>sold</span></div>
                                <div style={{ fontSize: 12, color: C.green, fontWeight: 600, marginTop: 2 }}>{fmt(data.revenue)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>}
                </>
            }
          </div>
        )}

        {/* WHAT-IF PLANNER */}
        {activeTab === "whatif" && (
          <div className="fu">
            <div className="card" style={{ marginBottom: 20, background: "linear-gradient(135deg, #1B2A4A 0%, #2D4270 100%)", borderColor: C.navy }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 32 }}>🔮</span>
                <div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 22, color: "#F5F0E8", fontWeight: 500 }}>What-If Planner</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 10, letterSpacing: "0.14em", color: "#8BBF9A", marginTop: 2, textTransform: "uppercase" }}>Test decisions before you make them</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.65, margin: 0 }}>
                Use your real numbers to model business decisions. <strong style={{ color: "#5CC882" }}>What if your supplies cost more? What if you raise prices? What if you sell wholesale?</strong> See the impact instantly so you can make confident decisions.
              </p>
            </div>

            {products.length === 0 ? (
              <div className="card"><EmptyState icon="🔮" title="Add products first" body="What-If scenarios use your real product costs and prices. Add at least one product to start modeling." btnLabel="+ Add Product" onBtn={() => setShowAddProduct(true)} /></div>
            ) : (
              <>
                {/* Scenario 1: Supply cost increase */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 4 }}>📈 What if my supplies cost more?</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Inflation, supplier price hikes, or shipping increases</div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ marginBottom: 0 }}>Supply cost increase</label>
                      <span style={{ fontSize: 14, fontWeight: 700, color: whatIfSupplyIncrease > 20 ? C.red : whatIfSupplyIncrease > 10 ? C.amber : C.green }}>+{whatIfSupplyIncrease}%</span>
                    </div>
                    <input type="range" min="0" max="50" step="5" value={whatIfSupplyIncrease} onChange={e => setWhatIfSupplyIncrease(Number(e.target.value))} style={{ width: "100%", accentColor: C.navy }}/>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, marginTop: 4 }}><span>0%</span><span>50%</span></div>
                  </div>
                  {(() => {
                    const newCogsList = products.map(p => ({ ...p, newCogs: (p.cogs || 0) * (1 + whatIfSupplyIncrease / 100) }));
                    const oldProfit = products.reduce((s, p) => s + (p.price - (p.cogs || 0)), 0);
                    const newProfit = newCogsList.reduce((s, p) => s + (p.price - p.newCogs), 0);
                    const profitDrop = oldProfit - newProfit;
                    const unprofitable = newCogsList.filter(p => p.price > 0 && p.price - p.newCogs <= 0);
                    return (
                      <div style={{ background: profitDrop > 0 ? C.amberBg : C.greenBg, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>Total profit per round of products:</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: profitDrop > 0 ? C.amber : C.green }}>{fmt(oldProfit)} → {fmt(newProfit)}</span>
                        </div>
                        {profitDrop > 0 && <div style={{ fontSize: 12, color: C.slate, marginBottom: unprofitable.length > 0 ? 6 : 0 }}>You'd lose <strong style={{ color: C.red }}>{fmt(profitDrop)}</strong> in profit per round at current prices.</div>}
                        {unprofitable.length > 0 && <div style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ {unprofitable.length} {unprofitable.length === 1 ? "product becomes" : "products become"} unprofitable: {unprofitable.map(p => p.name).join(", ")}</div>}
                      </div>
                    );
                  })()}
                </div>

                {/* Scenario 2: Raise prices */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 4 }}>💲 What if I raise my prices?</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Test different price points per product</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {products.map(p => {
                      const newPrice = whatIfPrice[p.id] !== undefined ? whatIfPrice[p.id] : p.price;
                      const oldMargin = p.price > 0 ? ((p.price - (p.cogs||0)) / p.price) * 100 : 0;
                      const newMargin = newPrice > 0 ? ((newPrice - (p.cogs||0)) / newPrice) * 100 : 0;
                      const marginGain = newMargin - oldMargin;
                      return (
                        <div key={p.id} style={{ background: C.slateLight, borderRadius: 10, padding: "10px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: C.navy }}>{p.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, color: C.muted }}>Current {fmt(p.price)} →</span>
                              <input type="number" value={newPrice} onChange={e => setWhatIfPrice(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                style={{ width: 80, padding: "4px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, fontWeight: 600 }}/>
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                            <span style={{ color: C.muted }}>Margin: <strong style={{ color: oldMargin >= 30 ? C.green : C.amber }}>{pct(oldMargin)}</strong> → <strong style={{ color: newMargin >= 30 ? C.green : newMargin > 0 ? C.amber : C.red }}>{pct(newMargin)}</strong></span>
                            <span style={{ color: marginGain > 0 ? C.green : marginGain < 0 ? C.red : C.muted, fontWeight: 600 }}>{marginGain > 0 ? "+" : ""}{marginGain.toFixed(1)} pts</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ background: C.blueLight, borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 12, color: C.slate, lineHeight: 1.5 }}>
                    💡 <strong>Smart pricing tip:</strong> A 20% price increase only requires keeping ~80% of customers to come out ahead. Most vendors underprice — your true cost matters more than competitor matching.
                  </div>
                </div>

                {/* Scenario 3: Sell wholesale */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 4 }}>🏪 What if I sell wholesale?</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Most wholesale = 50% off retail. See if it's worth it.</div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ marginBottom: 0 }}>Wholesale discount</label>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>{whatIfWholesaleDiscount}% off retail</span>
                    </div>
                    <input type="range" min="20" max="60" step="5" value={whatIfWholesaleDiscount} onChange={e => setWhatIfWholesaleDiscount(Number(e.target.value))} style={{ width: "100%", accentColor: C.purple }}/>
                  </div>
                  {(() => {
                    const wholesalePrices = products.map(p => ({ ...p, wholesalePrice: p.price * (1 - whatIfWholesaleDiscount / 100), wholesaleMargin: p.price > 0 ? ((p.price * (1 - whatIfWholesaleDiscount / 100) - (p.cogs || 0)) / (p.price * (1 - whatIfWholesaleDiscount / 100))) * 100 : 0 }));
                    const losers = wholesalePrices.filter(p => p.wholesalePrice <= (p.cogs || 0));
                    const avgRetailMargin = products.length > 0 ? products.reduce((s, p) => s + (p.price > 0 ? ((p.price - (p.cogs||0)) / p.price) * 100 : 0), 0) / products.length : 0;
                    const avgWholesaleMargin = wholesalePrices.length > 0 ? wholesalePrices.reduce((s, p) => s + p.wholesaleMargin, 0) / wholesalePrices.length : 0;
                    return (
                      <div style={{ background: losers.length > 0 ? C.redBg : avgWholesaleMargin >= 20 ? C.greenBg : C.amberBg, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>Average margin:</span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}><span style={{ color: avgRetailMargin >= 30 ? C.green : C.amber }}>{pct(avgRetailMargin)}</span> retail → <span style={{ color: avgWholesaleMargin >= 20 ? C.green : avgWholesaleMargin > 0 ? C.amber : C.red }}>{pct(avgWholesaleMargin)}</span> wholesale</span>
                        </div>
                        {losers.length > 0 ? <div style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>⚠ {losers.length} {losers.length === 1 ? "product would lose money" : "products would lose money"} at this wholesale price: {losers.map(p => p.name).join(", ")}</div>
                          : avgWholesaleMargin >= 20 ? <div style={{ fontSize: 12, color: C.green }}>✓ Wholesale could work — you'd still earn a healthy margin. Volume becomes the question.</div>
                          : <div style={{ fontSize: 12, color: C.amber }}>⚠ Margin is tight at wholesale. You'd need significant volume to make it worth your time.</div>
                        }
                      </div>
                    );
                  })()}
                </div>

                {/* Scenario 4: Hire help */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 4 }}>👥 What if I pay someone to help?</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>See what your event needs to make to cover labor</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div><label>Hourly Rate ($)</label><input className="inp" type="number" value={whatIfHelperRate} onChange={e => setWhatIfHelperRate(parseFloat(e.target.value) || 0)}/></div>
                    <div><label>Hours Worked</label><input className="inp" type="number" value={whatIfHelperHours} onChange={e => setWhatIfHelperHours(parseFloat(e.target.value) || 0)}/></div>
                  </div>
                  {(() => {
                    const laborCost = whatIfHelperRate * whatIfHelperHours;
                    const avgEventProfit = events.filter(e => e.name !== "General Operations" && !e.archived).map(ev => {
                      const tx = transactions.filter(t => t.event_id === ev.id);
                      const inc = tx.filter(t => t.type === "income").reduce((s,t) => s+t.amount, 0);
                      const exp = tx.filter(t => t.type === "expense" && !t.is_owner_funded).reduce((s,t) => s+t.amount, 0);
                      return inc - exp;
                    });
                    const avg = avgEventProfit.length > 0 ? avgEventProfit.reduce((s,p) => s+p, 0) / avgEventProfit.length : 0;
                    const newProfit = avg - laborCost;
                    return laborCost > 0 ? (
                      <div style={{ background: newProfit > 0 ? C.greenBg : C.redBg, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>Labor cost per event:</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{fmt(laborCost)}</span>
                        </div>
                        {avg > 0 && <>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>Your average event profit:</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt(avg)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                            <span style={{ color: C.slate, fontWeight: 600 }}>New profit after labor:</span>
                            <span style={{ fontWeight: 700, color: newProfit > 0 ? C.green : C.red }}>{fmt(newProfit)}</span>
                          </div>
                        </>}
                        {avg === 0 && <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>Add transactions to your events to compare against your real profit.</div>}
                      </div>
                    ) : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Enter hours and rate above to see the impact.</div>;
                  })()}
                </div>

                {/* Scenario 5: Scale up events */}
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: 4 }}>📅 What if I do more events per month?</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Project your monthly numbers if you scale up</div>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ marginBottom: 0 }}>Events per month</label>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{whatIfEventsPerMonth} {whatIfEventsPerMonth === 1 ? "event" : "events"}</span>
                    </div>
                    <input type="range" min="1" max="12" step="1" value={whatIfEventsPerMonth} onChange={e => setWhatIfEventsPerMonth(Number(e.target.value))} style={{ width: "100%", accentColor: C.blue }}/>
                  </div>
                  {(() => {
                    const eventStats = events.filter(e => e.name !== "General Operations" && !e.archived).map(ev => {
                      const tx = transactions.filter(t => t.event_id === ev.id);
                      return { rev: tx.filter(t => t.type === "income").reduce((s,t) => s+t.amount, 0), exp: tx.filter(t => t.type === "expense" && !t.is_owner_funded).reduce((s,t) => s+t.amount, 0) };
                    }).filter(e => e.rev > 0);
                    const avgRev = eventStats.length > 0 ? eventStats.reduce((s,e) => s+e.rev, 0) / eventStats.length : 0;
                    const avgExp = eventStats.length > 0 ? eventStats.reduce((s,e) => s+e.exp, 0) / eventStats.length : 0;
                    const projRev = avgRev * whatIfEventsPerMonth;
                    const projExp = avgExp * whatIfEventsPerMonth;
                    const projProfit = projRev - projExp;
                    return avgRev > 0 ? (
                      <div style={{ background: C.blueLight, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 12 }}>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Monthly Revenue</div><div style={{ fontSize: 18, fontWeight: 700, color: C.green, marginTop: 2 }}>{fmt(projRev)}</div></div>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Monthly Costs</div><div style={{ fontSize: 18, fontWeight: 700, color: C.red, marginTop: 2 }}>{fmt(projExp)}</div></div>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Monthly Profit</div><div style={{ fontSize: 18, fontWeight: 700, color: C.navy, marginTop: 2 }}>{fmt(projProfit)}</div></div>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Yearly Profit</div><div style={{ fontSize: 18, fontWeight: 700, color: C.purple, marginTop: 2 }}>{fmt(projProfit * 12)}</div></div>
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 10, fontStyle: "italic" }}>Based on your average event ({fmt(avgRev)} revenue, {fmt(avgExp)} expenses)</div>
                      </div>
                    ) : <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>Add transactions to your events to see projections.</div>;
                  })()}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* More menu */}
      {showMore && (
        <div style={{ position: "fixed", inset: 0, zIndex: 94 }} onClick={() => setShowMore(false)}>
          <div className="more-menu su" onClick={e => e.stopPropagation()}>
            {MORE_TABS.map(t => (
              <button key={t} onClick={() => { setActiveTab(t); setShowMore(false); }} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 20px", borderBottom: t !== MORE_TABS[MORE_TABS.length-1] ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <span style={{ fontSize: 22 }}>{tabIcon(t)}</span>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 500, color: activeTab === t ? "#5CC882" : "rgba(255,255,255,0.85)" }}>{tabLabel(t)}</span>
                {activeTab === t && <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "#5CC882" }}/>}
              </button>
            ))}
            <button onClick={() => { setSettingsForm({ tax_rate: settings.tax_rate, monthly_goal: settings.monthly_goal }); setShowSettings(true); setShowMore(false); }} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 22 }}>⚙️</span><span style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {PRIMARY_TABS.map(t => (
          <button key={t} className={`bnav-btn${activeTab === t ? " active" : ""}`} onClick={() => { setActiveTab(t); setShowMore(false); }}>
            <span className="bnav-icon">{tabIcon(t)}</span>
            <span className="bnav-label">{tabLabel(t)}</span>
            {activeTab === t && <div className="bnav-dot"/>}
          </button>
        ))}
        <button className={`bnav-btn${isMoreActive ? " active" : ""}`} onClick={() => setShowMore(m => !m)}>
          <span className="bnav-icon">•••</span>
          <span className="bnav-label">More</span>
          {isMoreActive && <div className="bnav-dot"/>}
        </button>
      </nav>

      {/* FAB */}
      <button onClick={() => setShowAddTx(true)} id="fab" style={{ display: "none", position: "fixed", bottom: 76, right: 18, width: 52, height: 52, borderRadius: "50%", background: C.blue, border: "none", cursor: "pointer", fontSize: 26, color: "white", alignItems: "center", justifyContent: "center", zIndex: 89 }}>+</button>
      <style>{`@media(max-width:640px){#fab{display:flex!important}}`}</style>

      {/* ── MODALS ── */}

      {showSettings && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="modal">
            <MTitle>Settings</MTitle>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 22, lineHeight: 1.5 }}>These settings apply across your whole account.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
              <div><label>Tax Set-Aside Rate (%)</label><input className="inp" type="number" placeholder="25" value={settingsForm.tax_rate} onChange={e => setSettingsForm(f => ({ ...f, tax_rate: e.target.value }))}/><div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>% of profit to set aside</div></div>
              <div><label>Monthly Revenue Goal ($)</label><input className="inp" type="number" placeholder="2000" value={settingsForm.monthly_goal} onChange={e => setSettingsForm(f => ({ ...f, monthly_goal: e.target.value }))}/></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn-p" onClick={saveSettings}>{saving ? "Saving..." : "Save Settings"}</button>
            </div>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowSaveConfirm(false)}>
          <div className="modal">
            <MTitle>Save Live Sales?</MTitle>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>This will log your sales as income transactions and add them to Best Sellers history.</div>
            <div style={{ background: C.slateLight, borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.slate, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Saving to: {breakEvenEventId === "all" ? events[0]?.name : events.find(e => String(e.id) === breakEvenEventId)?.name}</div>
              {Object.entries(liveSales).filter(([,qty])=>qty>0).map(([pid,qty]) => { const p = products.find(p => String(p.id) === String(pid)); if (!p) return null; return <div key={pid} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${C.border}` }}><span style={{ fontSize: 13, fontWeight: 500 }}>{qty} x {p.name}</span><div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{fmt(qty*p.price)}</div><div style={{ fontSize: 11, color: C.purple }}>{fmt(qty*(p.price-(p.cogs||0)))} profit</div></div></div>; })}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}><span style={{ color: C.navy }}>Total</span><span style={{ color: C.green }}>{fmt(beMetrics.liveRevenue)}</span></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setShowSaveConfirm(false)}>Cancel</button>
              <button className="btn-p" style={{ background: C.green }} onClick={saveLiveSales}>{saving ? "Saving..." : "Save and Track"}</button>
            </div>
          </div>
        </div>
      )}

      {showAddTx && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAddTx(false)}>
          <div className="modal">
            <MTitle>Add Transaction</MTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label>Type</label><select className="sel" value={txForm.type} onChange={e => setTxForm(f => ({ ...f, type: e.target.value, category: e.target.value === "income" ? INCOME_CATEGORIES[0] : CATEGORIES[0], source: e.target.value === "income" ? INCOME_SOURCES[0] : EXPENSE_SOURCES[0], isOwnerFunded: false }))}><option value="expense">Expense</option><option value="income">Income</option></select></div>
              <div><label>Amount ($)</label><input className="inp" type="number" placeholder="0.00" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}/></div>
            </div>
            <div style={{ marginBottom: 14 }}><label>Description</label><input className="inp" placeholder="What was this for?" value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}/></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label>Category</label><select className="sel" value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}>{(txForm.type === "income" ? INCOME_CATEGORIES : CATEGORIES).map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label>{txForm.type === "income" ? "Received Via" : "Paid With"}</label><select className="sel" value={txForm.source} onChange={e => setTxForm(f => ({ ...f, source: e.target.value }))}>{(txForm.type === "income" ? INCOME_SOURCES : EXPENSE_SOURCES).map(s => <option key={s}>{s}</option>)}</select></div>
            </div>
            {txForm.type === "expense" && (
              <div style={{ marginBottom: 14, background: txForm.isOwnerFunded ? C.purpleBg : C.slateLight, borderRadius: 12, padding: "12px 16px", border: `1.5px solid ${txForm.isOwnerFunded ? "#DDD6FE" : "transparent"}`, cursor: "pointer" }} onClick={() => setTxForm(f => ({ ...f, isOwnerFunded: !f.isOwnerFunded }))}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: txForm.isOwnerFunded ? C.purple : C.text }}>★ Owner Funded</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>This came out of your personal money</div></div>
                  <div style={{ width: 40, height: 22, borderRadius: 11, background: txForm.isOwnerFunded ? C.purple : C.border, position: "relative", flexShrink: 0, transition: "background 0.2s" }}><div style={{ position: "absolute", top: 3, left: txForm.isOwnerFunded ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}/></div>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
              <div><label>Event</label><select className="sel" value={txForm.eventId} onChange={e => setTxForm(f => ({ ...f, eventId: e.target.value }))}>{events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}</select></div>
              <div><label>Date</label><input className="inp" type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}/></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setShowAddTx(false)}>Cancel</button>
              <button className="btn-p" onClick={addTransaction}>{saving ? "Saving..." : "Add Transaction"}</button>
            </div>
          </div>
        </div>
      )}

      {showAddEvent && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAddEvent(false)}>
          <div className="modal">
            <MTitle>New Event</MTitle>
            <div style={{ marginBottom: 14 }}><label>Event Name</label><input className="inp" placeholder="e.g. Canton Farmers Market — June" value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}/></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label>Date (optional)</label><input className="inp" type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}/></div>
              <div><label>Revenue Goal ($)</label><input className="inp" type="number" placeholder="e.g. 500" value={eventForm.goalRevenue} onChange={e => setEventForm(f => ({ ...f, goalRevenue: e.target.value }))}/></div>
            </div>
            <div style={{ marginBottom: 14 }}><label>Miles Driven (round trip)</label><input className="inp" type="number" placeholder="e.g. 24" value={eventForm.milesDriven} onChange={e => setEventForm(f => ({ ...f, milesDriven: e.target.value }))}/><div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Mileage tax deduction at $0.67/mile</div></div>

            {products.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <label>Products at this event</label>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Pick which products you'll sell. They'll show in the Live Sales Tracker.</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 10, background: C.slateLight, borderRadius: 10, maxHeight: 140, overflowY: "auto" }}>
                  <button onClick={() => setEventForm(f => ({ ...f, productIds: f.productIds.length === products.length ? [] : products.map(p => p.id) }))}
                    style={{ background: eventForm.productIds.length === products.length ? C.navy : "white", color: eventForm.productIds.length === products.length ? "white" : C.navy, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "5px 12px", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    {eventForm.productIds.length === products.length ? "✓ All Selected" : "Select All"}
                  </button>
                  {products.map(p => {
                    const selected = eventForm.productIds.includes(p.id);
                    return (
                      <button key={p.id} onClick={() => setEventForm(f => ({ ...f, productIds: selected ? f.productIds.filter(id => id !== p.id) : [...f.productIds, p.id] }))}
                        style={{ background: selected ? C.green : "white", color: selected ? "white" : C.text, border: `1.5px solid ${selected ? C.green : C.border}`, borderRadius: 16, padding: "5px 12px", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>
                        {selected ? "✓ " : "+ "}{p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 22 }}>
              <label>Notes (optional)</label>
              <textarea className="inp" rows="3" placeholder="Booth location, weather, things to remember..." value={eventForm.notes}
                onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))}
                style={{ resize: "vertical", fontFamily: "'Inter',sans-serif" }}/>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setShowAddEvent(false)}>Cancel</button>
              <button className="btn-p" onClick={addEvent}>{saving ? "Saving..." : "Create Event"}</button>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfile && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="modal">
            <MTitle>👤 My Profile</MTitle>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>Tell us about your business so we can personalize your experience.</div>
            <div style={{ marginBottom: 14 }}><label>Business Name</label><input className="inp" placeholder="e.g. Blue Mountain Candles" value={profileForm.business_name} onChange={e => setProfileForm(f => ({ ...f, business_name: e.target.value }))}/></div>
            <div style={{ marginBottom: 14 }}><label>Vendor Type</label>
              <select className="sel" value={profileForm.vendor_type} onChange={e => setProfileForm(f => ({ ...f, vendor_type: e.target.value }))}>
                <option value="craft">🎨 Craft / Handmade</option>
                <option value="food">🍲 Food / Beverage</option>
                <option value="service">💼 Service</option>
                <option value="mixed">🌟 Mixed</option>
              </select>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Food vendors will get extra features like batch tracking and expiration dates (coming soon).</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label>Phone (optional)</label><input className="inp" placeholder="(555) 555-5555" value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}/></div>
              <div><label>City/Region</label><input className="inp" placeholder="Detroit, MI" value={profileForm.location} onChange={e => setProfileForm(f => ({ ...f, location: e.target.value }))}/></div>
            </div>
            <div style={{ marginBottom: 22 }}><label>Default Tax Rate (%)</label><input className="inp" type="number" placeholder="25" value={profileForm.default_tax_rate} onChange={e => setProfileForm(f => ({ ...f, default_tax_rate: e.target.value }))}/><div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Used for tax estimates. Most small businesses set aside 25-30%.</div></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setShowProfile(false)}>Cancel</button>
              <button className="btn-p" onClick={saveProfile}>{saving ? "Saving..." : "Save Profile"}</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EVENT MODAL */}
      {editEvent && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setEditEvent(null)}>
          <div className="modal">
            <MTitle>Edit Event</MTitle>
            <div style={{ marginBottom: 14 }}><label>Event Name</label><input className="inp" value={editEvent.name || ""} onChange={e => setEditEvent(ev => ({ ...ev, name: e.target.value }))}/></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label>Date</label><input className="inp" type="date" value={editEvent.date || ""} onChange={e => setEditEvent(ev => ({ ...ev, date: e.target.value }))}/></div>
              <div><label>Revenue Goal ($)</label><input className="inp" type="number" value={editEvent.goal_revenue || ""} onChange={e => setEditEvent(ev => ({ ...ev, goal_revenue: e.target.value }))}/></div>
            </div>
            <div style={{ marginBottom: 14 }}><label>Miles Driven</label><input className="inp" type="number" value={editEvent.miles_driven || ""} onChange={e => setEditEvent(ev => ({ ...ev, miles_driven: e.target.value }))}/></div>
            <div style={{ marginBottom: 22 }}><label>Notes</label><textarea className="inp" rows="3" value={editEvent.notes || ""} onChange={e => setEditEvent(ev => ({ ...ev, notes: e.target.value }))} style={{ resize: "vertical", fontFamily: "'Inter',sans-serif" }}/></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setEditEvent(null)}>Cancel</button>
              <button className="btn-p" onClick={updateEvent}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editProduct && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setEditProduct(null)}>
          <div className="modal">
            <MTitle>Edit Product</MTitle>
            <div style={{ marginBottom: 14 }}><label>Product Name</label><input className="inp" value={editProduct.name || ""} onChange={e => setEditProduct(p => ({ ...p, name: e.target.value }))}/></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label>Sale Price ($)</label><input className="inp" type="number" value={editProduct.price || ""} onChange={e => setEditProduct(p => ({ ...p, price: e.target.value }))}/></div>
              <div><label>Cost (COGS)</label><input className="inp" type="number" value={editProduct.cogs || ""} onChange={e => setEditProduct(p => ({ ...p, cogs: e.target.value }))}/></div>
              <div><label>Stock</label><input className="inp" type="number" value={editProduct.stock || ""} onChange={e => setEditProduct(p => ({ ...p, stock: e.target.value }))}/></div>
            </div>
            {(parseFloat(editProduct.price) > 0 && parseFloat(editProduct.cogs) > 0) && (() => {
              const margin = ((parseFloat(editProduct.price) - parseFloat(editProduct.cogs)) / parseFloat(editProduct.price)) * 100;
              return <div style={{ background: margin >= 30 ? C.greenBg : margin > 0 ? C.amberBg : C.redBg, borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: margin >= 30 ? C.green : margin > 0 ? C.amber : C.red, fontWeight: 600 }}>
                {margin >= 30 ? "✓ " : margin > 0 ? "⚠ " : "⚠ "}Margin: {margin.toFixed(1)}% · Profit per sale: {fmt(parseFloat(editProduct.price) - parseFloat(editProduct.cogs))}
              </div>;
            })()}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setEditProduct(null)}>Cancel</button>
              <button className="btn-p" onClick={updateProduct}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SUPPLY MODAL */}
      {editSupply && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setEditSupply(null)}>
          <div className="modal">
            <MTitle>Edit Supply</MTitle>
            <div style={{ marginBottom: 14 }}><label>Supply Name</label><input className="inp" value={editSupply.name || ""} onChange={e => setEditSupply(s => ({ ...s, name: e.target.value }))}/></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div><label>Bulk Cost ($)</label><input className="inp" type="number" value={editSupply.bulk_cost || ""} onChange={e => setEditSupply(s => ({ ...s, bulk_cost: e.target.value }))}/></div>
              <div><label>Bulk Qty</label><input className="inp" type="number" value={editSupply.bulk_qty || ""} onChange={e => setEditSupply(s => ({ ...s, bulk_qty: e.target.value }))}/></div>
              <div><label>Unit</label>
                <select className="sel" value={editSupply.unit || "lb"} onChange={e => setEditSupply(s => ({ ...s, unit: e.target.value }))}>
                  {["lb", "oz", "g", "kg", "ml", "L", "count", "ft", "yd", "in"].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
              <div><label>Current On Hand</label><input className="inp" type="number" value={editSupply.current_qty || ""} onChange={e => setEditSupply(s => ({ ...s, current_qty: e.target.value }))}/></div>
              <div><label>Low Stock Alert</label><input className="inp" type="number" value={editSupply.low_stock_threshold || ""} onChange={e => setEditSupply(s => ({ ...s, low_stock_threshold: e.target.value }))}/></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setEditSupply(null)}>Cancel</button>
              <button className="btn-p" onClick={updateSupply}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editTx && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setEditTx(null)}>
          <div className="modal">
            <MTitle>Edit Transaction</MTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label>Type</label>
                <select className="sel" value={editTx.type} onChange={e => setEditTx(t => ({ ...t, type: e.target.value, category: e.target.value === "income" ? INCOME_CATEGORIES[0] : CATEGORIES[0], source: e.target.value === "income" ? INCOME_SOURCES[0] : EXPENSE_SOURCES[0] }))}>
                  <option value="expense">Expense</option><option value="income">Income</option>
                </select>
              </div>
              <div><label>Amount ($)</label><input className="inp" type="number" value={editTx.amount || ""} onChange={e => setEditTx(t => ({ ...t, amount: e.target.value }))}/></div>
            </div>
            <div style={{ marginBottom: 14 }}><label>Description</label><input className="inp" value={editTx.description || ""} onChange={e => setEditTx(t => ({ ...t, description: e.target.value }))}/></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label>Category</label>
                <select className="sel" value={editTx.category} onChange={e => setEditTx(t => ({ ...t, category: e.target.value }))}>
                  {(editTx.type === "income" ? INCOME_CATEGORIES : CATEGORIES).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label>{editTx.type === "income" ? "Received Via" : "Paid With"}</label>
                <select className="sel" value={editTx.source} onChange={e => setEditTx(t => ({ ...t, source: e.target.value }))}>
                  {(editTx.type === "income" ? INCOME_SOURCES : EXPENSE_SOURCES).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 22 }}>
              <div><label>Event</label>
                <select className="sel" value={editTx.event_id || ""} onChange={e => setEditTx(t => ({ ...t, event_id: Number(e.target.value) }))}>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
              </div>
              <div><label>Date</label><input className="inp" type="date" value={editTx.date || ""} onChange={e => setEditTx(t => ({ ...t, date: e.target.value }))}/></div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setEditTx(null)}>Cancel</button>
              <button className="btn-p" onClick={updateTransaction}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ENTRY MODAL */}
      {showQuickEntry && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowQuickEntry(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <MTitle>⚡ Quick Entry</MTitle>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>Enter how many of each product you sold. Perfect for after the event when things have calmed down.</div>
            <div style={{ marginBottom: 14 }}><label>Event</label>
              <select className="sel" value={quickEntryEventId} onChange={e => setQuickEntryEventId(e.target.value)}>
                <option value="">— Select an event —</option>
                {events.filter(e => e.name !== "General Operations" && !e.archived).map(ev => <option key={ev.id} value={ev.id}>{ev.name}{ev.date ? ` (${ev.date})` : ""}</option>)}
              </select>
            </div>
            {products.length === 0 ? (
              <div style={{ background: C.amberBg, borderRadius: 10, padding: "12px 14px", color: C.amber, fontSize: 13, marginBottom: 18 }}>You need to add products first before you can track sales.</div>
            ) : (() => {
              const eventForFilter = events.find(e => String(e.id) === quickEntryEventId);
              const evProductIds = eventForFilter?.product_ids ? eventForFilter.product_ids.split(",").filter(Boolean).map(Number) : null;
              const visibleProds = evProductIds && evProductIds.length > 0 ? products.filter(p => evProductIds.includes(p.id)) : products;
              return (
                <>
                  <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Products Sold</div>
                  <div style={{ display: "grid", gap: 8, marginBottom: 14, maxHeight: 320, overflowY: "auto", padding: 4 }}>
                    {visibleProds.map(p => {
                      const qty = parseInt(quickEntryData[p.id] || 0) || 0;
                      const subtotal = qty * (p.price || 0);
                      return (
                        <div key={p.id} style={{ background: qty > 0 ? C.greenBg : C.slateLight, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{fmt(p.price)} each</div>
                          </div>
                          <input type="number" min="0" placeholder="0" value={quickEntryData[p.id] || ""} onChange={e => setQuickEntryData(prev => ({ ...prev, [p.id]: e.target.value }))}
                            style={{ width: 64, textAlign: "center", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 700 }}/>
                          {qty > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: C.green, minWidth: 60, textAlign: "right" }}>{fmt(subtotal)}</span>}
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const total = Object.entries(quickEntryData).reduce((sum, [pid, qty]) => {
                      const p = products.find(p => String(p.id) === String(pid));
                      return sum + ((parseInt(qty) || 0) * (p?.price || 0));
                    }, 0);
                    return total > 0 && <div style={{ background: C.navy, color: "white", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Total Revenue</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: "#5CC882" }}>{fmt(total)}</span>
                    </div>;
                  })()}
                </>
              );
            })()}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => { setShowQuickEntry(false); setQuickEntryData({}); }}>Cancel</button>
              <button className="btn-p" onClick={saveQuickEntry} disabled={saving || !quickEntryEventId}>{saving ? "Saving..." : "Save Sales"}</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV IMPORT MODAL */}
      {showCsvImport && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowCsvImport(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <MTitle>📋 Import Sales from CSV</MTitle>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>Paste sales data from Square, Shopify, Etsy, or any platform that exports CSV. The app will try to match item names to your products automatically.</div>
            <div style={{ marginBottom: 14 }}><label>Event</label>
              <select className="sel" value={csvImportEventId} onChange={e => setCsvImportEventId(e.target.value)}>
                <option value="">— Select an event —</option>
                {events.filter(e => e.name !== "General Operations" && !e.archived).map(ev => <option key={ev.id} value={ev.id}>{ev.name}{ev.date ? ` (${ev.date})` : ""}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label>Paste CSV Data (with header row)</label>
              <textarea value={csvImportText} onChange={e => setCsvImportText(e.target.value)}
                placeholder={"item,quantity,price,date\nLavender Candle,2,18.00,2025-04-15\nVanilla Soap,1,8.50,2025-04-15"}
                rows="6"
                style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 10, fontFamily: "monospace", fontSize: 12, resize: "vertical", boxSizing: "border-box" }}/>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>The app looks for columns like "item/product", "quantity/qty", "price/amount", and "date". Most exports work automatically.</div>
            </div>
            <button className="btn-o" style={{ width: "100%", marginBottom: 14 }} onClick={previewCsvImport} disabled={!csvImportText.trim()}>Preview Import</button>
            {csvImportPreview.length > 0 && (
              <div style={{ background: C.slateLight, borderRadius: 10, padding: "12px 14px", marginBottom: 14, maxHeight: 240, overflowY: "auto" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{csvImportPreview.length} sales found</div>
                {csvImportPreview.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < csvImportPreview.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.qty} × {p.item}</div>
                      <div style={{ fontSize: 10, color: p.matchedProductName ? C.green : C.amber, marginTop: 2 }}>
                        {p.matchedProductName ? `✓ Matched to "${p.matchedProductName}"` : "⚠ No product match — will save as transaction only"}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: C.green, marginLeft: 12 }}>{fmt(p.price * p.qty)}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => { setShowCsvImport(false); setCsvImportText(""); setCsvImportPreview([]); }}>Cancel</button>
              <button className="btn-p" onClick={saveCsvImport} disabled={saving || !csvImportEventId || csvImportPreview.length === 0}>{saving ? "Importing..." : `Import ${csvImportPreview.length} Sales`}</button>
            </div>
          </div>
        </div>
      )}

      {showAddSupply && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAddSupply(false)}>
          <div className="modal">
            <MTitle>Add Supply</MTitle>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>Enter what you bought in bulk. You'll use this supply across multiple products.</div>
            <div style={{ marginBottom: 14 }}><label>Supply Name</label><input className="inp" placeholder="e.g. Soy wax, jars, fragrance oil" value={supplyForm.name} onChange={e => setSupplyForm(f => ({ ...f, name: e.target.value }))}/></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div><label>Bulk Cost ($)</label><input className="inp" type="number" placeholder="40.00" value={supplyForm.bulkCost} onChange={e => setSupplyForm(f => ({ ...f, bulkCost: e.target.value }))}/></div>
              <div><label>Bulk Qty</label><input className="inp" type="number" placeholder="5" value={supplyForm.bulkQty} onChange={e => setSupplyForm(f => ({ ...f, bulkQty: e.target.value }))}/></div>
              <div><label>Unit</label>
                <select className="sel" value={supplyForm.unit} onChange={e => setSupplyForm(f => ({ ...f, unit: e.target.value }))}>
                  {["lb", "oz", "g", "kg", "ml", "L", "count", "ft", "yd", "in"].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}><label>Low Stock Alert (optional)</label><input className="inp" type="number" placeholder="Alert when below this amount" value={supplyForm.lowStockThreshold} onChange={e => setSupplyForm(f => ({ ...f, lowStockThreshold: e.target.value }))}/></div>
            {supplyForm.bulkCost && supplyForm.bulkQty && parseFloat(supplyForm.bulkQty) > 0 && (
              <div style={{ background: C.greenBg, borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: C.green, fontWeight: 600 }}>
                Cost per {supplyForm.unit}: {fmt(parseFloat(supplyForm.bulkCost) / parseFloat(supplyForm.bulkQty))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setShowAddSupply(false)}>Cancel</button>
              <button className="btn-p" onClick={addSupply}>{saving ? "Saving..." : "Save Supply"}</button>
            </div>
          </div>
        </div>
      )}

      {showAddProduct && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAddProduct(false)}>
          <div className="modal">
            <MTitle>Add a Product</MTitle>

            {/* Name + Price + Stock */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}><label>Product Name</label><input className="inp" placeholder="e.g. Soy Candle" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}/></div>
              <div><label>Sale Price ($)</label><input className="inp" type="number" placeholder="18.00" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))}/></div>
              <div><label>Units in Stock</label><input className="inp" type="number" placeholder="30" value={productForm.stock} onChange={e => setProductForm(f => ({ ...f, stock: e.target.value }))}/></div>
            </div>

            {/* COGS mode toggle */}
            <div style={{ marginBottom: 16 }}>
              <label>Cost of Goods</label>
              <div style={{ display: "flex", background: C.slateLight, borderRadius: 10, padding: 4, gap: 4, flexWrap: "wrap" }}>
                {[["simple", "Simple"], ["detailed", "Detailed"], ["blueroots", "🌿 Blue Roots"]].map(([m, lbl]) => (
                  <button key={m} onClick={() => setProductForm(f => ({ ...f, cogsMode: m }))}
                    style={{ flex: 1, minWidth: 90, background: productForm.cogsMode === m ? C.surface : "transparent", border: "none", borderRadius: 8, padding: "8px 4px", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, color: productForm.cogsMode === m ? C.navy : C.muted, cursor: "pointer", transition: "all 0.15s" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* Blue Roots mode */}
            {productForm.cogsMode === "blueroots" && (
              <div style={{ marginBottom: 14 }}>
                {/* Description */}
                <div style={{ background: "#EAF3DE", border: "1px solid #C0DD97", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>🌿</span>
                    <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 14, color: C.navy }}>Blue Roots</div>
                  </div>
                  <p style={{ fontSize: 12, color: C.slate, lineHeight: 1.6, margin: 0 }}>
                    Get to the root of your real cost. Add each supply with what you <strong>paid in bulk</strong>, <strong>how much you got</strong>, and <strong>how much goes into one product</strong>. The app does the math and tells you the true cost per unit.
                  </p>
                  <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, margin: "8px 0 0", fontStyle: "italic" }}>
                    Example: Bought 5 lb of wax for $40. One candle uses 0.25 lb. → That's $2.00 of wax per candle.
                  </p>
                </div>

                {/* Supply rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {productForm.blueRoots.map((item, idx) => {
                    const bulkCost = parseFloat(item.bulkCost) || 0;
                    const bulkQty = parseFloat(item.bulkQty) || 0;
                    const usedPerUnit = parseFloat(item.usedPerUnit) || 0;
                    const perUnitCost = (bulkQty > 0 && usedPerUnit > 0) ? (bulkCost / bulkQty) * usedPerUnit : 0;
                    return (
                      <div key={item.id} style={{ background: C.slateLight, borderRadius: 12, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Supply #{idx + 1}</div>
                          {productForm.blueRoots.length > 1 && (
                            <button onClick={() => setProductForm(f => ({ ...f, blueRoots: f.blueRoots.filter(b => b.id !== item.id) }))}
                              style={{ background: "none", border: "none", color: C.red, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                              Remove
                            </button>
                          )}
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 11 }}>Supply</label>
                          {supplies.length > 0 ? (
                            <select className="sel" value={item.supplyId || ""}
                              onChange={e => {
                                const supId = e.target.value;
                                if (supId === "custom") {
                                  setProductForm(f => ({ ...f, blueRoots: f.blueRoots.map(b => b.id === item.id ? { ...b, supplyId: "custom", name: "", bulkCost: "", bulkQty: "", unit: "units" } : b) }));
                                } else if (supId === "") {
                                  setProductForm(f => ({ ...f, blueRoots: f.blueRoots.map(b => b.id === item.id ? { ...b, supplyId: null, name: "", bulkCost: "", bulkQty: "", unit: "units" } : b) }));
                                } else {
                                  const sup = supplies.find(s => String(s.id) === supId);
                                  if (sup) {
                                    setProductForm(f => ({ ...f, blueRoots: f.blueRoots.map(b => b.id === item.id ? { ...b, supplyId: sup.id, name: sup.name, bulkCost: String(sup.bulk_cost), bulkQty: String(sup.bulk_qty), unit: sup.unit } : b) }));
                                  }
                                }
                              }}>
                              <option value="">— Pick a supply —</option>
                              {supplies.map(sup => <option key={sup.id} value={sup.id}>{sup.name} ({fmt(sup.bulk_cost)} for {sup.bulk_qty} {sup.unit})</option>)}
                              <option value="custom">+ Custom (one-time)</option>
                            </select>
                          ) : (
                            <input className="inp" placeholder="e.g. Soy wax, jars, fragrance oil" value={item.name}
                              onChange={e => setProductForm(f => ({ ...f, blueRoots: f.blueRoots.map(b => b.id === item.id ? { ...b, name: e.target.value, supplyId: "custom" } : b) }))}/>
                          )}
                          {supplies.length === 0 && <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>💡 Save supplies in the Blue Roots tab to reuse them across products</div>}
                          {item.supplyId === "custom" && supplies.length > 0 && (
                            <input className="inp" placeholder="Supply name" value={item.name} style={{ marginTop: 8 }}
                              onChange={e => setProductForm(f => ({ ...f, blueRoots: f.blueRoots.map(b => b.id === item.id ? { ...b, name: e.target.value } : b) }))}/>
                          )}
                        </div>
                        {(item.supplyId === "custom" || supplies.length === 0) && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div>
                              <label style={{ fontSize: 11 }}>Bulk Cost ($)</label>
                              <input className="inp" type="number" placeholder="40.00" value={item.bulkCost}
                                onChange={e => setProductForm(f => ({ ...f, blueRoots: f.blueRoots.map(b => b.id === item.id ? { ...b, bulkCost: e.target.value } : b) }))}/>
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>What you paid total</div>
                            </div>
                            <div>
                              <label style={{ fontSize: 11 }}>Bulk Quantity</label>
                              <input className="inp" type="number" placeholder="5" value={item.bulkQty}
                                onChange={e => setProductForm(f => ({ ...f, blueRoots: f.blueRoots.map(b => b.id === item.id ? { ...b, bulkQty: e.target.value } : b) }))}/>
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>How much you got</div>
                            </div>
                          </div>
                        )}
                        {item.supplyId && item.supplyId !== "custom" && item.bulkCost && item.bulkQty && (
                          <div style={{ background: "#EAF3DE", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: C.green }}>
                            ✓ {fmt(parseFloat(item.bulkCost))} for {item.bulkQty} {item.unit} = <strong>{fmt(parseFloat(item.bulkCost)/parseFloat(item.bulkQty))} per {item.unit}</strong>
                          </div>
                        )}
                        <div>
                          <label style={{ fontSize: 11 }}>Amount Used Per Product ({item.unit || "units"})</label>
                          <input className="inp" type="number" placeholder="0.25" value={item.usedPerUnit}
                            onChange={e => setProductForm(f => ({ ...f, blueRoots: f.blueRoots.map(b => b.id === item.id ? { ...b, usedPerUnit: e.target.value } : b) }))}/>
                          <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>How much of this supply goes into ONE product</div>
                        </div>
                        {perUnitCost > 0 && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: C.slate, fontWeight: 600 }}>Cost per unit:</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>{fmt(perUnitCost)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button onClick={() => setProductForm(f => ({ ...f, blueRoots: [...f.blueRoots, { id: Date.now(), name: "", bulkCost: "", bulkQty: "", usedPerUnit: "", unit: "units" }] }))}
                  style={{ marginTop: 12, width: "100%", background: "white", color: C.navy, border: `1.5px dashed ${C.border}`, borderRadius: 10, padding: "10px", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  + Add Another Supply
                </button>
              </div>
            )}

            {/* Simple mode */}
            {productForm.cogsMode === "simple" && (
              <div style={{ marginBottom: 14 }}>
                <label>Total Cost to Make ($)</label>
                <input className="inp" type="number" placeholder="5.00" value={productForm.simpleCogs} onChange={e => setProductForm(f => ({ ...f, simpleCogs: e.target.value }))}/>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Materials + packaging + labor combined</div>
              </div>
            )}

            {/* Detailed mode */}
            {productForm.cogsMode === "detailed" && (
              <div style={{ marginBottom: 14 }}>
                {/* Vendor type */}
                <label>Vendor Type</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  {[["craft", "🕯️ Craft / Product"], ["food", "🍪 Food / Baked Goods"], ["service", "✂️ Service"]].map(([t, lbl]) => (
                    <button key={t} onClick={() => setProductForm(f => ({ ...f, vendorType: t }))}
                      style={{ background: productForm.vendorType === t ? C.navy : C.slateLight, color: productForm.vendorType === t ? "white" : C.slate, border: "none", borderRadius: 8, padding: "8px 14px", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {/* Craft lines */}
                {productForm.vendorType === "craft" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["materials", "Raw Materials ($)", "Wax, beads, fabric, etc."], ["packaging", "Packaging ($)", "Boxes, bags, labels"], ["labor", "Labor per unit ($)", "Your time making it"], ["overhead", "Overhead per unit ($)", "Equipment wear, utilities"], ["other", "Other ($)", "Anything else"]].map(([key, lbl, hint]) => (
                      <div key={key}><label>{lbl}</label><input className="inp" type="number" placeholder="0.00" value={productForm[key]} onChange={e => setProductForm(f => ({ ...f, [key]: e.target.value }))}/><div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{hint}</div></div>
                    ))}
                  </div>
                )}

                {/* Food lines */}
                {productForm.vendorType === "food" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["ingredients", "Ingredients ($)", "Per unit from recipe"], ["packaging", "Packaging ($)", "Containers, wrap, bags"], ["consumables", "Consumables ($)", "Parchment, gloves, etc."], ["labor", "Labor per unit ($)", "Baking + prep time"], ["permits", "Permits/Fees ($)", "License cost per unit"], ["other", "Other ($)", "Anything else"]].map(([key, lbl, hint]) => (
                      <div key={key}><label>{lbl}</label><input className="inp" type="number" placeholder="0.00" value={productForm[key]} onChange={e => setProductForm(f => ({ ...f, [key]: e.target.value }))}/><div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{hint}</div></div>
                    ))}
                  </div>
                )}

                {/* Service lines */}
                {productForm.vendorType === "service" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["supplies", "Supplies ($)", "Paint, thread, props"], ["equipment", "Equipment wear ($)", "Depreciation per job"], ["labor", "Labor ($)", "Your time per service"], ["other", "Other ($)", "Anything else"]].map(([key, lbl, hint]) => (
                      <div key={key}><label>{lbl}</label><input className="inp" type="number" placeholder="0.00" value={productForm[key]} onChange={e => setProductForm(f => ({ ...f, [key]: e.target.value }))}/><div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{hint}</div></div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Live profit preview */}
            {(() => {
              const price = parseFloat(productForm.price) || 0;
              const f = productForm;
              let cogs = 0;
              if (f.cogsMode === "simple") cogs = parseFloat(f.simpleCogs) || 0;
              else if (f.cogsMode === "blueroots") {
                cogs = f.blueRoots.reduce((sum, item) => {
                  const bc = parseFloat(item.bulkCost) || 0;
                  const bq = parseFloat(item.bulkQty) || 0;
                  const u = parseFloat(item.usedPerUnit) || 0;
                  return sum + ((bq > 0 && u > 0) ? (bc / bq) * u : 0);
                }, 0);
              }
              else if (f.vendorType === "craft") cogs = [f.materials, f.packaging, f.labor, f.overhead, f.other].reduce((s, v) => s + (parseFloat(v)||0), 0);
              else if (f.vendorType === "food") cogs = [f.ingredients, f.packaging, f.consumables, f.labor, f.permits, f.other].reduce((s, v) => s + (parseFloat(v)||0), 0);
              else cogs = [f.supplies, f.equipment, f.labor, f.other].reduce((s, v) => s + (parseFloat(v)||0), 0);
              const profit = price - cogs;
              const margin = price > 0 ? (profit / price) * 100 : 0;
              if (!price && !cogs) return null;
              return (
                <div style={{ background: margin >= 30 ? C.greenBg : margin > 0 ? C.amberBg : C.redBg, borderRadius: 12, padding: "14px 16px", marginBottom: 18, border: `1px solid ${margin >= 30 ? "#A7F3D0" : margin > 0 ? "#FDE68A" : "#FECACA"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Cost Per Unit</div>
                      <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 18, color: C.navy }}>{fmt(cogs)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Profit per sale</div>
                      <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 22, color: margin >= 30 ? C.green : margin > 0 ? C.amber : C.red }}>{fmt(profit)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Margin</div>
                      <div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 22, color: margin >= 30 ? C.green : margin > 0 ? C.amber : C.red }}>{pct(margin)}</div>
                    </div>
                    {f.cogsMode === "detailed" && (
                      <div style={{ width: "100%", paddingTop: 10, borderTop: `1px solid ${margin >= 30 ? "#A7F3D0" : margin > 0 ? "#FDE68A" : "#FECACA"}` }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Cost breakdown</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {Object.entries(f.vendorType === "craft" ? { Materials: f.materials, Packaging: f.packaging, Labor: f.labor, Overhead: f.overhead, Other: f.other } : f.vendorType === "food" ? { Ingredients: f.ingredients, Packaging: f.packaging, Consumables: f.consumables, Labor: f.labor, "Permits": f.permits, Other: f.other } : { Supplies: f.supplies, Equipment: f.equipment, Labor: f.labor, Other: f.other }).filter(([,v]) => parseFloat(v) > 0).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.6)", padding: "3px 10px", borderRadius: 20, color: C.slate }}>{k}: {fmt(parseFloat(v))}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {f.cogsMode === "blueroots" && (
                      <div style={{ width: "100%", paddingTop: 10, borderTop: `1px solid ${margin >= 30 ? "#A7F3D0" : margin > 0 ? "#FDE68A" : "#FECACA"}` }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>🌿 Cost breakdown by supply</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {f.blueRoots.filter(item => item.name && parseFloat(item.bulkCost) > 0 && parseFloat(item.bulkQty) > 0 && parseFloat(item.usedPerUnit) > 0).map(item => {
                            const c = (parseFloat(item.bulkCost) / parseFloat(item.bulkQty)) * parseFloat(item.usedPerUnit);
                            return <span key={item.id} style={{ fontSize: 11, fontWeight: 600, background: "rgba(255,255,255,0.6)", padding: "3px 10px", borderRadius: 20, color: C.slate }}>{item.name}: {fmt(c)}</span>;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {margin > 0 && margin < 30 && <div style={{ fontSize: 12, color: C.amber, marginTop: 10, fontWeight: 500 }}>⚠ Margin under 30% — consider raising your price or reducing costs.</div>}
                  {margin <= 0 && price > 0 && <div style={{ fontSize: 12, color: C.red, marginTop: 10, fontWeight: 500 }}>⚠ You are losing money on this product. Your costs exceed your sale price.</div>}
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-o" onClick={() => setShowAddProduct(false)}>Cancel</button>
              <button className="btn-p" onClick={addProduct}>{saving ? "Saving..." : "Add Product"}</button>
            </div>
          </div>
        </div>
      )}

      {showReport && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowReport(null)}>
          <div className="modal" style={{ width: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div><div style={{ fontFamily: "Georgia,serif", fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Event Report</div><div style={{ fontFamily: "'Clash Display','Inter',sans-serif", fontWeight: 700, fontSize: 20, color: C.navy }}>{showReport.ev.name}</div>{showReport.ev.date && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{showReport.ev.date}</div>}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="28" height="28" viewBox="0 0 80 80"><polygon points="40,8 72,64 8,64" fill="#5CC882"/><polygon points="40,8 53,32 27,32" fill="#F5F0E8"/></svg><div style={{ fontFamily: "Georgia,serif", fontSize: 13, color: C.navy }}>Blue Mountain Books</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[["Revenue", fmt(showReport.bd.income), C.green], ["Expenses", fmt(showReport.bd.expenses), C.red], ["Net", `${showReport.bd.net >= 0 ? "+" : ""}${fmt(showReport.bd.net)}`, showReport.bd.net >= 0 ? C.green : C.red]].map(([l,v,c]) => (
                <div key={l} style={{ background: C.slateLight, borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{l}</div><div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div></div>
              ))}
            </div>
            {showReport.bd.taxEstimate > 0 && <div style={{ background: C.amberBg, borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, color: C.amber, fontWeight: 600 }}>Tax estimate ({settings.tax_rate}%)</span><span style={{ fontSize: 13, color: C.amber, fontWeight: 700 }}>{fmt(showReport.bd.taxEstimate)}</span></div>}
            {showReport.bd.mileageDeduction > 0 && <div style={{ background: C.tealBg, borderRadius: 10, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 13, color: C.teal, fontWeight: 600 }}>Mileage ({showReport.ev.miles_driven} mi)</span><span style={{ fontSize: 13, color: C.teal, fontWeight: 700 }}>{fmt(showReport.bd.mileageDeduction)}</span></div>}
            {showReport.evSales && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Product Sales</div>{Object.entries(showReport.evSales.prods).map(([name, data]) => (<div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}><span style={{ fontWeight: 500 }}>{name}</span><span style={{ color: C.muted }}>{data.qty} sold · <span style={{ color: C.green, fontWeight: 600 }}>{fmt(data.revenue)}</span></span></div>))}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn-o" onClick={() => setShowReport(null)}>Close</button>
              <button className="btn-p" onClick={() => window.print()}>🖨 Print / Save PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
