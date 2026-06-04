"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-context";
import {
  Shield,
  Target,
  Search,
  AlertTriangle,
  Activity,
  Plus,
  Play,
  RefreshCw,
  Terminal,
  BarChart3,
  Settings,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Zap,
  Bug,
  Lock,
  Globe,
  Server,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Send,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Command,
  Sparkles,
  Wifi,
  Eye,
  EyeOff,
  FileText,
  Layers,
  LogOut,
  Users,
  Crown,
  ExternalLink,
  Share2,
  Wand2,
  LayoutDashboard,
  Crosshair,
  Radar,
  ScanLine,
  AlertOctagon,
  MessageSquare,
  Wrench,
  SlidersHorizontal,
  GitBranch,
  Puzzle,
  Network,
  FolderGit,
  LayoutGrid,
  MessageCircle,
  RotateCcw,
} from "lucide-react";

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Types
interface DashboardStats {
  targets: number;
  scans: {
    total: number;
    running: number;
    completed: number;
    failed: number;
  };
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
  };
  source_scans: {
    total: number;
    running: number;
    completed: number;
    findings: {
      total: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

interface Target {
  id: number;
  name: string;
  host: string;
  type: string;
  description: string;
  created_at: string;
}

interface Scan {
  id: number;
  target_id: number;
  scan_type: string;
  tool: string;
  status: string;
  started_at: string;
  completed_at?: string;
  duration?: number;
  output?: string;
  ai_summary?: string;
}

interface Vulnerability {
  id: number;
  title: string;
  severity: string;
  cve_id?: string;
  affected_component?: string;
  description?: string;
  is_fixed: boolean;
  created_at?: string;
  scan_id?: number;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

// ─── Severity color helpers ──────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", dot: "bg-orange-500" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20", dot: "bg-yellow-500" },
  low: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500" },
  info: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500" },
};

const SEVERITY_HEX: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#3b82f6",
};

function getSeverityColor(severity: string) {
  return SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
}

// ─── CSS Donut Chart ─────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="relative w-40 h-40 mx-auto">
        <div
          className="w-40 h-40 rounded-full"
          style={{ background: "conic-gradient(#374151 0deg 360deg)" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-[#12121a] flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#e4e4e7]">0</div>
              <div className="text-[10px] text-[#71717a]">Total</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  let cumulative = 0;
  const gradients: string[] = [];
  data.forEach((d) => {
    if (d.value === 0) return;
    const start = (cumulative / total) * 360;
    cumulative += d.value;
    const end = (cumulative / total) * 360;
    gradients.push(`${d.color} ${start}deg ${end}deg`);
  });

  return (
    <div className="relative w-40 h-40 mx-auto">
      <div
        className="w-40 h-40 rounded-full"
        style={{ background: `conic-gradient(${gradients.join(", ")})` }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full bg-[#12121a] flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-[#e4e4e7]">{total}</div>
            <div className="text-[10px] text-[#71717a]">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SVG Line Chart ──────────────────────────────────────────────────────────

function LineChart({
  data,
  color = "#14b8a6",
  secondaryData,
  secondaryColor = "#ef4444",
  height = 120,
}: {
  data: number[];
  color?: string;
  secondaryData?: number[];
  secondaryColor?: string;
  height?: number;
}) {
  const allValues = secondaryData ? [...data, ...secondaryData] : data;
  const max = Math.max(...allValues, 1);
  const w = 300;
  const h = height;
  const padding = 10;

  const points = data.map((v, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * (w - padding * 2);
    const y = h - padding - (v / max) * (h - padding * 2);
    return `${x},${y}`;
  });

  let secondaryPoints: string[] = [];
  if (secondaryData) {
    secondaryPoints = secondaryData.map((v, i) => {
      const x = padding + (i / Math.max(secondaryData.length - 1, 1)) * (w - padding * 2);
      const y = h - padding - (v / max) * (h - padding * 2);
      return `${x},${y}`;
    });
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line
          key={pct}
          x1={padding}
          y1={h - padding - pct * (h - padding * 2)}
          x2={w - padding}
          y2={h - padding - pct * (h - padding * 2)}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
      ))}
      {/* Primary line */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
      {data.map((v, i) => {
        const x = padding + (i / Math.max(data.length - 1, 1)) * (w - padding * 2);
        const y = h - padding - (v / max) * (h - padding * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
      {/* Secondary line */}
      {secondaryData && (
        <>
          <polyline
            fill="none"
            stroke={secondaryColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={secondaryPoints.join(" ")}
          />
          {secondaryData.map((v, i) => {
            const x = padding + (i / Math.max(secondaryData.length - 1, 1)) * (w - padding * 2);
            const y = h - padding - (v / max) * (h - padding * 2);
            return <circle key={`s-${i}`} cx={x} cy={y} r="3" fill={secondaryColor} />;
          })}
        </>
      )}
    </svg>
  );
}

// ─── Main Dashboard Component ────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { user, token, logout, isAuthenticated, canEdit, canScan, canChat, isAdmin, hasRole, authFetch } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [showScanModal, setShowScanModal] = useState<{ targetId: number; targetName: string } | null>(null);
  const [showNewPentest, setShowNewPentest] = useState(false);
  const [scanDetail, setScanDetail] = useState<Scan | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [issueFilter, setIssueFilter] = useState<"all" | "open" | "fixed">("all");
  const [detailTab, setDetailTab] = useState<"details" | "remediation">("details");
  const [dateRange, setDateRange] = useState("30d");

  const addToast = (message: string, type: Toast["type"] = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  // Fetch data
  useEffect(() => {
    fetchData();
    // Poll faster (every 5s) when scans are running, otherwise every 30s
    const hasRunning = scans.some((s: any) => s.status === "running");
    const interval = setInterval(fetchData, hasRunning ? 5000 : 30000);
    return () => clearInterval(interval);
  }, [token, scans.some((s: any) => s.status === "running")]);

  const fetchData = async () => {
    try {
      const [statsRes, targetsRes, scansRes, vulnsRes, issuesRes] = await Promise.all([
        authFetch(`${API_URL}/api/dashboard/stats`),
        authFetch(`${API_URL}/api/targets`),
        authFetch(`${API_URL}/api/scans?limit=50`),
        authFetch(`${API_URL}/api/vulnerabilities?limit=50`),
        authFetch(`${API_URL}/api/issues?limit=100`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (targetsRes.ok) setTargets(await targetsRes.json());
      if (scansRes.ok) setScans(await scansRes.json());
      if (vulnsRes.ok) setVulns(await vulnsRes.json());
      if (issuesRes.ok) setIssues(await issuesRes.json());

      // Handle 403 responses
      for (const res of [statsRes, targetsRes, scansRes, vulnsRes]) {
        if (res.status === 403) {
          addToast("Insufficient permissions", "error");
          break;
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTarget = async (data: { name: string; host: string; type: string; description: string }) => {
    try {
      const res = await authFetch(`${API_URL}/api/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 403) {
        addToast("Insufficient permissions", "error");
      } else if (res.ok) {
        fetchData();
        setShowAddTarget(false);
        addToast(`Target "${data.name}" added successfully`, "success");
      } else {
        addToast("Failed to add target", "error");
      }
    } catch (error) {
      addToast("Failed to add target — is the backend running?", "error");
    }
  };

  const startScan = async (targetId: number, scanType: string) => {
    try {
      // Optimistically add a "running" scan to the UI immediately
      const optimisticScan = {
        id: Date.now(), // temp ID
        target_id: targetId,
        scan_type: scanType,
        tool: null,
        status: "running",
        output: null,
        ai_summary: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        duration: null,
        _optimistic: true, // mark as optimistic
      };
      setScans((prev: any[]) => [optimisticScan, ...prev]);
      setShowScanModal(null);
      addToast(`${scanType} scan started`, "success");

      // Then make the actual API call
      const res = await authFetch(`${API_URL}/api/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId, scan_type: scanType }),
      });
      if (res.status === 403) {
        addToast("Insufficient permissions", "error");
        // Remove optimistic scan on error
        setScans((prev: any[]) => prev.filter((s: any) => !s._optimistic));
      } else if (res.ok) {
        // Replace optimistic scan with real data
        fetchData();
      } else {
        addToast("Failed to start scan", "error");
        setScans((prev: any[]) => prev.filter((s: any) => !s._optimistic));
      }
    } catch (error) {
      addToast("Failed to start scan", "error");
      setScans((prev: any[]) => prev.filter((s: any) => !s._optimistic));
    }
  };

  // Filter vulns - merge vulnerabilities + issues from API
  const allIssues = [
    ...vulns.map(v => ({ ...v, source: 'scan' })),
    ...issues.map(i => ({
      id: `issue-${i.id}`,
      title: i.title,
      severity: i.severity,
      cve_id: i.cve_id || null,
      affected_component: i.affected_url || 'Unknown',
      is_fixed: i.status === 'resolved',
      description: i.description,
      remediation: i.remediation,
      source: 'issue',
      status: i.status,
      assigned_to: i.assigned_to,
    }))
  ];
  
  const filteredVulns = allIssues.filter((v) => {
    if (issueFilter === "open" && v.is_fixed) return false;
    if (issueFilter === "fixed" && !v.is_fixed) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        v.title.toLowerCase().includes(q) ||
        v.cve_id?.toLowerCase().includes(q) ||
        v.affected_component?.toLowerCase().includes(q) ||
        v.severity.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Severity counts
  const severityCounts = {
    critical: allIssues.filter((v) => v.severity === "critical").length,
    high: allIssues.filter((v) => v.severity === "high").length,
    medium: allIssues.filter((v) => v.severity === "medium").length,
    low: allIssues.filter((v) => v.severity === "low").length,
    info: allIssues.filter((v) => v.severity === "info").length,
  };

  const openVulns = allIssues.filter((v) => !v.is_fixed).length;
  const fixedVulns = allIssues.filter((v) => v.is_fixed).length;

  // Security score calculation (0-100)
  const securityScore = (() => {
    if (vulns.length === 0) return 100;
    const penalty =
      severityCounts.critical * 15 +
      severityCounts.high * 8 +
      severityCounts.medium * 3 +
      severityCounts.low * 1;
    return Math.max(0, Math.min(100, 100 - penalty));
  })();

  // Sidebar nav items — new layout matching strix.ai
  const navItems = [
    { id: "dashboard", icon: LayoutGrid, label: "Dashboard" },
    { id: "pentests", icon: Search, label: "Pentests" },
    { id: "pr-reviews", icon: GitBranch, label: "PR Reviews" },
    { id: "issues", icon: AlertTriangle, label: "Issues" },
    ...(canChat ? [{ id: "chat", icon: MessageCircle, label: "Chat" }] : []),
    { id: "_separator", icon: null as any, label: "" },
    { id: "logs", icon: Terminal, label: "Logs" },
    { id: "repositories", icon: FolderGit, label: "Repositories" },
    { id: "source-code", icon: FileText, label: "Source Code" },
    { id: "domains", icon: Globe, label: "Domains" },
    { id: "networks", icon: Network, label: "Networks" },
    { id: "integrations", icon: Puzzle, label: "Integrations" },
    { id: "settings", icon: Settings, label: "Settings" },
  ] as { id: string; icon: any; label: string }[];

  const showDetailPanel = activeTab === "issues" && selectedVuln !== null;

  // Header titles
  const headerTitles: Record<string, string> = {
    dashboard: "Security Dashboard",
    pentests: "Pentests",
    "pr-reviews": "PR Reviews",
    issues: "Issues",
    chat: "AI Chat",
    logs: "System Logs",
    tools: "Tools",
    settings: "Settings",
    repositories: "Repositories",
    "source-code": "Source Code Scanning",
    domains: "Domains",
    networks: "Networks",
    integrations: "Integrations",
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
        <aside className="w-[60px] lg:w-[220px] bg-[#0e0e15] border-r border-white/[0.06] flex flex-col shrink-0">
          <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06]">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="hidden lg:block skeleton w-20 h-4" />
          </div>
          <div className="flex-1 p-2 space-y-1 mt-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton w-full h-9 rounded-md" />
            ))}
          </div>
        </aside>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      {/* ─── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-[60px] lg:w-[220px] bg-[#0e0e15] border-r border-white/[0.06] flex flex-col shrink-0 transition-all duration-200">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="hidden lg:block">
            <h1 className="text-sm font-semibold text-[#e4e4e7] tracking-tight">Strix Pro</h1>
            <p className="text-[9px] text-[#71717a] tracking-widest uppercase">Security Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 mt-1 overflow-auto">
          {navItems.map((item) => {
            if (item.id === "_separator") {
              return <div key="sep" className="my-2 mx-3 border-t border-white/[0.06]" />;
            }
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== "issues") setSelectedVuln(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 group ${
                  activeTab === item.id
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-white/[0.04]"
                }`}
                title={item.label}
              >
                <item.icon
                  className={`w-4 h-4 shrink-0 ${
                    activeTab === item.id ? "text-indigo-400" : "text-[#71717a] group-hover:text-[#a1a1aa]"
                  }`}
                />
                <span className="hidden lg:inline">{item.label}</span>
                {activeTab === item.id && (
                  <div className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-2 border-t border-white/[0.06]">
          <div className="hidden lg:block px-3 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                user?.role === "admin"
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : user?.role === "developer"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "bg-[#71717a]/10 text-[#a1a1aa] border border-white/[0.06]"
              }`}
            >
              {user?.role === "admin" && <Crown className="w-3 h-3" />}
              {user?.role}
            </span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#e4e4e7] truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-[#71717a] truncate">{user?.email || ""}</p>
            </div>
            <button
              onClick={logout}
              className="hidden lg:block p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Middle Panel (content) ────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-14 flex items-center justify-between px-5 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-[#e4e4e7] tracking-tight">
                {headerTitles[activeTab] || "Dashboard"}
              </h2>
              {stats?.scans.running ? (
                <span className="flex items-center gap-1.5 text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                  </span>
                  {stats.scans.running} running
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchData();
                  addToast("Data refreshed", "info");
                }}
                className="p-2 rounded-md text-[#71717a] hover:text-[#a1a1aa] hover:bg-white/[0.04] transition-all duration-200"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-md text-[#71717a] hover:text-[#a1a1aa] hover:bg-white/[0.04] transition-all duration-200 relative">
                <Bell className="w-4 h-4" />
                {stats?.vulnerabilities.critical ? (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                ) : null}
              </button>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto p-5 animate-fade-in">
            {/* ─── Dashboard Tab (redesigned) ───────────────────────── */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                {/* Dashboard header row */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#e4e4e7]">Security Dashboard</h3>
                    <p className="text-[12px] text-[#71717a] mt-0.5">Overview of your security posture</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-[#12121a] rounded-md border border-white/[0.06] overflow-hidden">
                      {(["7d", "30d", "90d"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setDateRange(r)}
                          className={`px-3 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                            dateRange === r ? "bg-indigo-500/10 text-indigo-400" : "text-[#71717a] hover:text-[#a1a1aa]"
                          }`}
                        >
                          {r === "7d" ? "Last 7 Days" : r === "30d" ? "Last 30 Days" : "Last 90 Days"}
                        </button>
                      ))}
                    </div>
                    {canScan && (
                      <button
                        onClick={() => setShowNewPentest(true)}
                        className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-500/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Pentest
                      </button>
                    )}
                  </div>
                </div>

                {/* Top metric row — 5 cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Security Score */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5">
                    <div className="text-[11px] text-[#71717a] font-medium mb-2 uppercase tracking-wider">Security Score</div>
                    <div className="text-3xl font-bold text-[#e4e4e7] tracking-tight">
                      {securityScore.toFixed(1)} <span className="text-base font-normal text-[#71717a]">/ 100</span>
                    </div>
                  </div>
                  {/* Vulnerabilities */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5">
                    <div className="text-[11px] text-[#71717a] font-medium mb-2 uppercase tracking-wider">Vulnerabilities</div>
                    <div className="text-3xl font-bold text-[#e4e4e7] tracking-tight">{vulns.length}</div>
                    {severityCounts.critical > 0 && (
                      <div className="text-[11px] text-red-400 mt-1">{severityCounts.critical} critical</div>
                    )}
                  </div>
                  {/* Open Issues */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5">
                    <div className="text-[11px] text-[#71717a] font-medium mb-2 uppercase tracking-wider">Open Issues</div>
                    <div className="text-3xl font-bold text-[#e4e4e7] tracking-tight">{openVulns}</div>
                  </div>
                  {/* Pentests */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5">
                    <div className="text-[11px] text-[#71717a] font-medium mb-2 uppercase tracking-wider">Pentests</div>
                    <div className="text-3xl font-bold text-[#e4e4e7] tracking-tight">{scans.length}</div>
                  </div>
                  {/* PRs Reviewed */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5">
                    <div className="text-[11px] text-[#71717a] font-medium mb-2 uppercase tracking-wider">PRs Reviewed</div>
                    <div className="text-3xl font-bold text-[#e4e4e7] tracking-tight">0</div>
                  </div>
                  {/* Source Code Findings */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => setActiveTab("source-code")}>
                    <div className="text-[11px] text-[#71717a] font-medium mb-2 uppercase tracking-wider">SAST Findings</div>
                    <div className="text-3xl font-bold text-[#e4e4e7] tracking-tight">{stats?.source_scans?.findings?.total || 0}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {(stats?.source_scans?.findings?.critical || 0) > 0 && <span className="text-[10px] text-red-400">{stats?.source_scans?.findings?.critical} crit</span>}
                      {(stats?.source_scans?.findings?.high || 0) > 0 && <span className="text-[10px] text-orange-400">{stats?.source_scans?.findings?.high} high</span>}
                      <span className="text-[10px] text-[#71717a]">{stats?.source_scans?.total || 0} scans</span>
                    </div>
                  </div>
                </div>

                {/* Middle 3 panels */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Top Issues */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                      <h3 className="text-[13px] font-semibold text-[#e4e4e7] tracking-tight">Top Issues</h3>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {vulns
                        .filter((v) => !v.is_fixed)
                        .sort((a, b) => {
                          const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
                          return (order[a.severity as keyof typeof order] ?? 5) - (order[b.severity as keyof typeof order] ?? 5);
                        })
                        .slice(0, 4)
                        .map((vuln) => {
                          const sevScore: Record<string, number> = { critical: 10, high: 8, medium: 5, low: 2, info: 0 };
                          const score = sevScore[vuln.severity] ?? 0;
                          return (
                            <div
                              key={vuln.id}
                              className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] cursor-pointer transition-colors"
                              onClick={() => {
                                setActiveTab("issues");
                                setSelectedVuln(vuln);
                              }}
                            >
                              <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                style={{ backgroundColor: SEVERITY_HEX[vuln.severity] || "#6b7280" }}
                              >
                                {score}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-[#e4e4e7] truncate">{vuln.title}</p>
                                <p className="text-[11px] text-[#71717a] truncate">{vuln.cve_id || vuln.affected_component || "—"}</p>
                              </div>
                            </div>
                          );
                        })}
                      {vulns.length === 0 && (
                        <div className="py-8 text-center text-[12px] text-[#71717a]">No issues found</div>
                      )}
                    </div>
                  </div>

                  {/* Top Affected Assets */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                      <h3 className="text-[13px] font-semibold text-[#e4e4e7] tracking-tight">Top Affected Assets</h3>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {targets.slice(0, 5).map((target) => {
                        // Find vulns associated with scans of this target
                        const targetScans = scans.filter((s) => s.target_id === target.id);
                        const targetScanIds = new Set(targetScans.map((s) => s.id));
                        const targetVulns = vulns.filter((v) => v.scan_id && targetScanIds.has(v.scan_id));
                        const hasCritical = targetVulns.some((v) => v.severity === "critical");
                        const hasHigh = targetVulns.some((v) => v.severity === "high");
                        const hasMedium = targetVulns.some((v) => v.severity === "medium");
                        const dotColor = hasCritical ? "bg-red-500" : hasHigh ? "bg-orange-500" : hasMedium ? "bg-yellow-500" : "bg-green-500";
                        return (
                          <div key={target.id} className="flex items-center gap-3 px-5 py-3">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-[#e4e4e7] truncate">{target.name}</p>
                              <p className="text-[11px] text-[#71717a] font-mono truncate">{target.host}</p>
                            </div>
                            <span className="text-[11px] text-[#71717a]">{targetVulns.length} vulns</span>
                          </div>
                        );
                      })}
                      {targets.length === 0 && (
                        <div className="py-8 text-center text-[12px] text-[#71717a]">No assets configured</div>
                      )}
                    </div>
                  </div>

                  {/* Severity Breakdown */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                      <h3 className="text-[13px] font-semibold text-[#e4e4e7] tracking-tight">Severity Breakdown</h3>
                    </div>
                    <div className="p-5">
                      <DonutChart
                        data={[
                          { label: "Critical", value: severityCounts.critical, color: "#ef4444" },
                          { label: "High", value: severityCounts.high, color: "#f97316" },
                          { label: "Medium", value: severityCounts.medium, color: "#eab308" },
                          { label: "Low", value: severityCounts.low, color: "#3b82f6" },
                        ]}
                      />
                      <div className="mt-4 space-y-2">
                        {[
                          { label: "Critical", count: severityCounts.critical, color: "#ef4444" },
                          { label: "High", count: severityCounts.high, color: "#f97316" },
                          { label: "Medium", count: severityCounts.medium, color: "#eab308" },
                          { label: "Low", count: severityCounts.low, color: "#3b82f6" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between text-[12px]">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-[#a1a1aa]">{item.label}</span>
                            </div>
                            <span className="text-[#e4e4e7] font-medium">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom 3 charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Security Score Trend */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5">
                    <h3 className="text-[13px] font-semibold text-[#e4e4e7] tracking-tight mb-4">Security Score Trend</h3>
                    <LineChart
                      data={[
                        Math.max(0, securityScore - 20),
                        Math.max(0, securityScore - 15),
                        Math.max(0, securityScore - 10),
                        Math.max(0, securityScore - 5),
                        securityScore,
                      ]}
                      color="#14b8a6"
                    />
                  </div>
                  {/* Open vs Fixed Issues */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5">
                    <h3 className="text-[13px] font-semibold text-[#e4e4e7] tracking-tight mb-4">Open vs Fixed Issues</h3>
                    <LineChart
                      data={[Math.max(0, openVulns - 8), Math.max(0, openVulns - 5), Math.max(0, openVulns - 3), Math.max(0, openVulns - 1), openVulns]}
                      color="#ef4444"
                      secondaryData={[0, Math.floor(fixedVulns * 0.2), Math.floor(fixedVulns * 0.5), Math.floor(fixedVulns * 0.8), fixedVulns]}
                      secondaryColor="#22c55e"
                    />
                    <div className="flex items-center gap-4 mt-3 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-[#71717a]">Open</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[#71717a]">Fixed</span>
                      </div>
                    </div>
                  </div>
                  {/* Mean Time to Remediate */}
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5">
                    <h3 className="text-[13px] font-semibold text-[#e4e4e7] tracking-tight mb-4">Mean Time to Remediate</h3>
                    <LineChart
                      data={[14, 12, 10, 8, 6]}
                      color="#14b8a6"
                    />
                    <div className="text-[11px] text-[#71717a] mt-3">Average days to fix vulnerabilities</div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Pentests Tab ─────────────────────────────────────── */}
            {activeTab === "pentests" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#e4e4e7]">Pentest History</h3>
                    <p className="text-[12px] text-[#71717a] mt-0.5">{scans.length} pentests recorded</p>
                  </div>
                  {canScan && (
                    <button
                      onClick={() => {
                        if (targets.length === 0) {
                          addToast("Add a target first before running a pentest", "error");
                          setActiveTab("domains");
                        } else {
                          setShowNewPentest(true);
                        }
                      }}
                      className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Pentest
                    </button>
                  )}
                </div>

                {/* Pentest stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
                    <div className="text-[11px] text-[#71717a] uppercase tracking-wider mb-1">Total</div>
                    <div className="text-xl font-bold text-[#e4e4e7]">{scans.length}</div>
                  </div>
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
                    <div className="text-[11px] text-[#71717a] uppercase tracking-wider mb-1">Running</div>
                    <div className="text-xl font-bold text-blue-400">{scans.filter(s => s.status === "running").length}</div>
                  </div>
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
                    <div className="text-[11px] text-[#71717a] uppercase tracking-wider mb-1">Completed</div>
                    <div className="text-xl font-bold text-green-400">{scans.filter(s => s.status === "completed").length}</div>
                  </div>
                  <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
                    <div className="text-[11px] text-[#71717a] uppercase tracking-wider mb-1">Failed</div>
                    <div className="text-xl font-bold text-red-400">{scans.filter(s => s.status === "failed").length}</div>
                  </div>
                </div>

                <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">ID</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Target</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Type</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Tool</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Status</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Duration</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {scans.map((scan) => {
                        const target = targets.find(t => t.id === scan.target_id);
                        const isRunning = scan.status === "running";
                        return (
                          <tr key={scan.id} className={`hover:bg-white/[0.02] transition-colors ${isRunning ? "bg-blue-500/[0.03]" : ""}`}>
                            <td className="px-5 py-3 text-[13px] text-[#a1a1aa]">
                              <div className="flex items-center gap-2">
                                {isRunning && (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                  </span>
                                )}
                                #{scan.id}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <div>
                                <p className="text-[13px] text-[#e4e4e7] font-medium">{target?.name || `Target #${scan.target_id}`}</p>
                                <p className="text-[11px] text-[#71717a] font-mono">{target?.host || ""}</p>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-[13px] text-[#e4e4e7] font-medium">{scan.scan_type}</span>
                            </td>
                            <td className="px-5 py-3 text-[13px] text-[#a1a1aa]">{scan.tool || "auto"}</td>
                            <td className="px-5 py-3">
                              <StatusBadge status={scan.status} />
                            </td>
                            <td className="px-5 py-3 text-[13px] text-[#71717a]">
                              {scan.duration ? `${scan.duration}s` : isRunning ? (
                                <span className="text-blue-400 flex items-center gap-1.5">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  running...
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => setScanDetail(scan)} className="text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                                  View
                                </button>
                                {scan.status === "running" && canScan && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const res = await authFetch(`${API_URL}/api/scans/${scan.id}/cancel`, { method: "POST" });
                                        if (res.ok) { fetchData(); addToast("Scan cancelled", "info"); }
                                      } catch { addToast("Failed to cancel scan", "error"); }
                                    }}
                                    className="text-[12px] text-red-400 hover:text-red-300 transition-colors font-medium"
                                  >
                                    Cancel
                                  </button>
                                )}
                                {(scan.status === "completed" || scan.status === "failed") && canScan && (
                                  <button
                                    onClick={() => startScan(scan.target_id, scan.scan_type)}
                                    className="text-[12px] text-emerald-400 hover:text-emerald-300 transition-colors font-medium flex items-center gap-1"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Retest
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {scans.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
                        <Search className="w-6 h-6 text-[#71717a]" />
                      </div>
                      <p className="text-[14px] font-medium text-[#a1a1aa] mb-1">No pentests yet</p>
                      <p className="text-[12px] text-[#71717a] max-w-sm mb-4">Add a target and run your first pentest to discover vulnerabilities</p>
                      {canScan && (
                        <button
                          onClick={() => { setActiveTab("domains"); }}
                          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          Add a Target First
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── PR Reviews Tab ───────────────────────────────────── */}
            {activeTab === "pr-reviews" && (
              <div className="space-y-4">
                <EmptyStateLarge icon={GitBranch} title="No PR reviews yet" message="Connect your repositories to start reviewing pull requests for security issues" />
              </div>
            )}

            {/* ─── Targets Tab ────────────────────────────────────── */}
            {activeTab === "targets" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#e4e4e7]">Targets</h3>
                    <p className="text-[12px] text-[#71717a] mt-0.5">{targets.length} monitored endpoints</p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowAddTarget(true)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Target
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {targets.map((target, i) => (
                    <TargetCard key={target.id} target={target} onScan={(id) => setShowScanModal({ targetId: id, targetName: target.name })} index={i} canScan={canScan} />
                  ))}
                  {targets.length === 0 && (
                    <div className="col-span-full">
                      <EmptyStateLarge icon={Target} title="No targets configured" message="Add your first target to begin security reconnaissance" action="Add Target" onAction={() => setShowAddTarget(true)} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Scans Tab ──────────────────────────────────────── */}
            {activeTab === "scans" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#e4e4e7]">Scan History</h3>
                    <p className="text-[12px] text-[#71717a] mt-0.5">{scans.length} scans recorded</p>
                  </div>
                </div>

                <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">ID</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Type</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Tool</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Status</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Duration</th>
                        <th className="text-left px-5 py-3 text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {scans.map((scan) => (
                        <tr key={scan.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3 text-[13px] text-[#a1a1aa]">#{scan.id}</td>
                          <td className="px-5 py-3">
                            <span className="text-[13px] text-[#e4e4e7] font-medium">{scan.scan_type}</span>
                          </td>
                          <td className="px-5 py-3 text-[13px] text-[#a1a1aa]">{scan.tool || "auto"}</td>
                          <td className="px-5 py-3">
                            <StatusBadge status={scan.status} />
                          </td>
                          <td className="px-5 py-3 text-[13px] text-[#71717a]">{scan.duration ? `${scan.duration}s` : "—"}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setScanDetail(scan)} className="text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                                View
                              </button>
                              {(scan.status === "completed" || scan.status === "failed") && canScan && (
                                <button
                                  onClick={() => startScan(scan.target_id, scan.scan_type)}
                                  className="text-[12px] text-emerald-400 hover:text-emerald-300 transition-colors font-medium flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Retest
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {scans.length === 0 && <EmptyStateLarge icon={Search} title="No scans yet" message="Scans will appear here once you start scanning your targets" />}
                </div>
              </div>
            )}

            {/* ─── Issues Tab (main view with 3-column detail) ────── */}
            {activeTab === "issues" && (
              <div className="space-y-4">
                {/* Severity Count Bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[12px] text-[#71717a] font-medium mr-1">Severity:</span>
                  {(["critical", "high", "medium", "low"] as const).map((sev) => {
                    const c = getSeverityColor(sev);
                    const count = severityCounts[sev];
                    return (
                      <span key={sev} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.bg} ${c.text} ${c.border} border`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}: {count}
                      </span>
                    );
                  })}
                </div>

                {/* Filter Tabs + Search */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center bg-[#12121a] rounded-md border border-white/[0.06] overflow-hidden">
                    {(["all", "open", "fixed"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setIssueFilter(f)}
                        className={`px-3.5 py-1.5 text-[12px] font-medium transition-all duration-150 ${
                          issueFilter === f ? "bg-indigo-500/10 text-indigo-400" : "text-[#71717a] hover:text-[#a1a1aa]"
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 min-w-[200px] max-w-md flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#12121a] border border-white/[0.06] text-[#71717a] text-[13px] focus-within:border-indigo-500/30 transition-colors">
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search issues..."
                      className="flex-1 bg-transparent text-[12px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-[#71717a] hover:text-[#a1a1aa]">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Issues List */}
                <div className="space-y-1">
                  {filteredVulns.map((vuln) => {
                    const c = getSeverityColor(vuln.severity);
                    const isSelected = selectedVuln?.id === vuln.id;
                    return (
                      <button
                        key={vuln.id}
                        onClick={() => {
                          setSelectedVuln(vuln);
                          setDetailTab("details");
                        }}
                        className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150 group ${
                          isSelected
                            ? "bg-indigo-500/10 border border-indigo-500/20"
                            : "hover:bg-white/[0.03] border border-transparent"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate ${isSelected ? "text-indigo-400" : "text-[#e4e4e7]"}`}>{vuln.title}</p>
                          <p className="text-[11px] text-[#71717a] truncate mt-0.5">
                            {vuln.cve_id || "No CVE"} · {vuln.affected_component || "Unknown component"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {vuln.is_fixed && (
                            <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">Fixed</span>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text} ${c.border} border`}>
                            {vuln.severity}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredVulns.length === 0 && (
                    <EmptyStateLarge icon={Lock} title="No issues found" message={searchQuery ? "Try adjusting your search query" : "No vulnerabilities match the current filter"} />
                  )}
                </div>
              </div>
            )}

            {/* ─── Repositories Tab ────────────────────────────────── */}
            {activeTab === "repositories" && (
              <RepositoriesTab addToast={addToast} authFetch={authFetch} canEdit={canEdit} canScan={canScan} />
            )}

            {/* ─── Logs Tab ────────────────────────────────────────── */}
            {activeTab === "logs" && (
              <LogsTab authFetch={authFetch} addToast={addToast} isAdmin={isAdmin} />
            )}

            {/* ─── Source Code Tab ──────────────────────────────────── */}
            {activeTab === "source-code" && (
              <SourceCodeTab addToast={addToast} authFetch={authFetch} canEdit={canEdit} canScan={canScan} />
            )}

            {/* ─── Domains Tab ─────────────────────────────────────── */}
            {activeTab === "domains" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#e4e4e7]">Domains & Targets</h3>
                    <p className="text-[12px] text-[#71717a] mt-0.5">{targets.length} targets configured</p>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setShowAddTarget(true)}
                      className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Target
                    </button>
                  )}
                </div>

                {/* Target cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {targets.map((target) => {
                    const targetScans = scans.filter(s => s.target_id === target.id);
                    const lastScan = targetScans[0];
                    const targetVulns = vulns.filter(v => targetScans.some(s => s.id === v.scan_id));
                    const typeIcons: Record<string, { icon: any; color: string }> = {
                      domain: { icon: Globe, color: "text-blue-400" },
                      ip: { icon: Server, color: "text-green-400" },
                      url: { icon: Globe, color: "text-purple-400" },
                    };
                    const t = typeIcons[target.type] || typeIcons.domain;
                    return (
                      <div key={target.id} className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.1] transition-all duration-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-md bg-white/[0.04]">
                              <t.icon className={`w-4 h-4 ${t.color}`} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-[13px] font-semibold text-[#e4e4e7] truncate">{target.name}</h4>
                              <p className="text-[11px] text-[#71717a] truncate font-mono">{target.host}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-[#71717a] bg-white/[0.04] px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {target.type}
                          </span>
                        </div>

                        <p className="text-[12px] text-[#71717a] mb-3 line-clamp-2">
                          {target.description || "No description"}
                        </p>

                        {/* Scan & vuln stats */}
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-[11px] text-[#71717a]">
                            <span className="text-[#e4e4e7] font-medium">{targetScans.length}</span> scans
                          </span>
                          {targetVulns.length > 0 && (
                            <span className="text-[11px] text-[#71717a]">
                              <span className="text-red-400 font-medium">{targetVulns.filter(v => v.severity === "critical").length}</span> critical
                            </span>
                          )}
                          {lastScan && (
                            <StatusBadge status={lastScan.status} />
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#71717a]">
                            Added {new Date(target.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-2">
                            {canScan && (() => {
                              const runningScan = targetScans.find(s => s.status === "running");
                              if (runningScan) {
                                return (
                                  <button
                                    disabled
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 cursor-wait"
                                  >
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Scanning...
                                  </button>
                                );
                              }
                              return (
                                <button
                                  onClick={() => setShowScanModal({ targetId: target.id, targetName: target.name })}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all duration-200"
                                >
                                  <Play className="w-3 h-3" />
                                  Scan
                                </button>
                              );
                            })()}
                            {canEdit && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete target "${target.name}"?`)) return;
                                  try {
                                    const res = await authFetch(`${API_URL}/api/targets/${target.id}`, { method: "DELETE" });
                                    if (res.ok) { fetchData(); addToast(`Target "${target.name}" deleted`, "success"); }
                                    else { addToast("Failed to delete target", "error"); }
                                  } catch { addToast("Failed to delete target", "error"); }
                                }}
                                className="p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Delete target"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {targets.length === 0 && (
                    <div className="col-span-full">
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
                          <Globe className="w-6 h-6 text-[#71717a]" />
                        </div>
                        <p className="text-[14px] font-medium text-[#a1a1aa] mb-1">No targets configured</p>
                        <p className="text-[12px] text-[#71717a] max-w-sm mb-4">Add a domain, IP, or URL to start monitoring for security issues</p>
                        {canEdit && (
                          <button
                            onClick={() => setShowAddTarget(true)}
                            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Your First Target
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Networks Tab ────────────────────────────────────── */}
            {activeTab === "networks" && (
              <NetworksTab addToast={addToast} authFetch={authFetch} canEdit={canEdit} canScan={canScan} />
            )}

            {/* ─── Integrations Tab ────────────────────────────────── */}
            {activeTab === "integrations" && (
              <IntegrationsTab addToast={addToast} authFetch={authFetch} isAdmin={isAdmin} />
            )}

            {/* ─── AI Chat Tab ────────────────────────────────────── */}
            {activeTab === "chat" && <AIChat addToast={addToast} authFetch={authFetch} />}

            {/* ─── Tools Tab ───────────────────────────────────────── */}
            {activeTab === "tools" && <ToolsList />}

            {/* ─── Settings Tab ────────────────────────────────────── */}
            {activeTab === "settings" && <SettingsPanel addToast={addToast} authFetch={authFetch} isAdmin={isAdmin} />}
          </div>
        </main>

        {/* ─── Detail Panel (right slide-in) ─────────────────────────── */}
        {showDetailPanel && selectedVuln && (
          <aside className="w-[380px] shrink-0 border-l border-white/[0.06] bg-[#0e0e15] flex flex-col overflow-hidden animate-slide-in-right">
            {/* Detail Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${getSeverityColor(selectedVuln.severity).dot}`} />
                <h3 className="text-[13px] font-semibold text-[#e4e4e7] truncate">{selectedVuln.title}</h3>
              </div>
              <button
                onClick={() => setSelectedVuln(null)}
                className="p-1.5 rounded text-[#71717a] hover:text-[#e4e4e7] hover:bg-white/[0.04] transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Detail Content */}
            <div className="flex-1 overflow-auto">
              {/* Severity Badge */}
              <div className="px-5 pt-4 pb-3">
                {(() => {
                  const c = getSeverityColor(selectedVuln.severity);
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wider ${c.bg} ${c.text} ${c.border} border`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {selectedVuln.severity}
                    </span>
                  );
                })()}
              </div>

              {/* Technical Details */}
              <div className="px-5 pb-3">
                <h4 className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider mb-2">Technical Details</h4>
                <p className="text-[12px] text-[#a1a1aa] leading-relaxed">
                  {selectedVuln.description || "No description available for this vulnerability."}
                </p>
              </div>

              {/* Locations */}
              <div className="px-5 pb-3">
                <h4 className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider mb-2">Locations</h4>
                <div className="space-y-1.5">
                  {selectedVuln.cve_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#71717a] w-24 shrink-0">CVE ID</span>
                      <span className="text-[12px] text-indigo-400 font-mono">{selectedVuln.cve_id}</span>
                    </div>
                  )}
                  {selectedVuln.affected_component && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#71717a] w-24 shrink-0">Component</span>
                      <span className="text-[12px] text-[#e4e4e7] font-mono">{selectedVuln.affected_component}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#71717a] w-24 shrink-0">Status</span>
                    <span className={`text-[12px] font-medium ${selectedVuln.is_fixed ? "text-green-400" : "text-red-400"}`}>
                      {selectedVuln.is_fixed ? "Fixed" : "Open"}
                    </span>
                  </div>
                  {selectedVuln.created_at && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#71717a] w-24 shrink-0">Detected</span>
                      <span className="text-[12px] text-[#a1a1aa]">{new Date(selectedVuln.created_at).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedVuln.scan_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#71717a] w-24 shrink-0">Scan ID</span>
                      <span className="text-[12px] text-[#a1a1aa] font-mono">#{selectedVuln.scan_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs: Details | Remediation */}
              <div className="px-5 pt-2">
                <div className="flex border-b border-white/[0.06]">
                  {(["details", "remediation"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={`px-4 py-2.5 text-[12px] font-medium transition-all duration-150 border-b-2 -mb-px ${
                        detailTab === tab
                          ? "border-indigo-400 text-indigo-400"
                          : "border-transparent text-[#71717a] hover:text-[#a1a1aa]"
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="px-5 py-4">
                {detailTab === "details" && (
                  <div className="space-y-4">
                    {/* Code block with syntax-like highlighting */}
                    <div className="bg-[#0a0a0f] rounded-lg border border-white/[0.06] overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                        </div>
                        <span className="text-[10px] text-[#71717a] font-mono ml-2">vulnerability.json</span>
                      </div>
                      <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto">
                        <code>
                          <span className="text-purple-400">{"{"}{"\n"}</span>
                          <span className="text-[#71717a]">  "id"</span>
                          <span className="text-[#a1a1aa]">: </span>
                          <span className="text-green-400">{selectedVuln.id}</span>
                          <span className="text-[#a1a1aa]">,{"\n"}</span>
                          <span className="text-[#71717a]">  "title"</span>
                          <span className="text-[#a1a1aa]">: </span>
                          <span className="text-amber-300">"{selectedVuln.title}"</span>
                          <span className="text-[#a1a1aa]">,{"\n"}</span>
                          <span className="text-[#71717a]">  "severity"</span>
                          <span className="text-[#a1a1aa]">: </span>
                          <span className={`${getSeverityColor(selectedVuln.severity).text}`}>"{selectedVuln.severity}"</span>
                          <span className="text-[#a1a1aa]">,{"\n"}</span>
                          {selectedVuln.cve_id && (
                            <>
                              <span className="text-[#71717a]">  "cve_id"</span>
                              <span className="text-[#a1a1aa]">: </span>
                              <span className="text-blue-400">"{selectedVuln.cve_id}"</span>
                              <span className="text-[#a1a1aa]">,{"\n"}</span>
                            </>
                          )}
                          {selectedVuln.affected_component && (
                            <>
                              <span className="text-[#71717a]">  "component"</span>
                              <span className="text-[#a1a1aa]">: </span>
                              <span className="text-amber-300">"{selectedVuln.affected_component}"</span>
                              <span className="text-[#a1a1aa]">,{"\n"}</span>
                            </>
                          )}
                          <span className="text-[#71717a]">  "is_fixed"</span>
                          <span className="text-[#a1a1aa]">: </span>
                          <span className={selectedVuln.is_fixed ? "text-green-400" : "text-red-400"}>{selectedVuln.is_fixed ? "true" : "false"}</span>
                          <span className="text-[#a1a1aa]">{"\n"}</span>
                          <span className="text-purple-400">{"}"}</span>
                        </code>
                      </pre>
                    </div>
                  </div>
                )}

                {detailTab === "remediation" && (
                  <div className="space-y-4">
                    {/* Show actual remediation from issue if available */}
                    {selectedVuln.remediation ? (
                      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
                        <h4 className="text-[12px] font-semibold text-[#e4e4e7] mb-2 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          Remediation
                        </h4>
                        <div className="text-[12px] text-[#a1a1aa] leading-relaxed whitespace-pre-wrap">
                          {selectedVuln.remediation}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
                        <h4 className="text-[12px] font-semibold text-[#e4e4e7] mb-2 flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          Recommended Actions
                        </h4>
                        <ul className="space-y-2 text-[12px] text-[#a1a1aa] leading-relaxed">
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">1.</span>
                            <span>Update {selectedVuln.affected_component || "the affected component"} to the latest stable version.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">2.</span>
                            <span>Review and apply the latest security patches from the vendor.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">3.</span>
                            <span>Verify the fix by re-running a vulnerability scan on this target.</span>
                          </li>
                          {selectedVuln.severity === "critical" && (
                            <li className="flex items-start gap-2">
                              <span className="text-red-400 mt-0.5">!</span>
                              <span className="text-red-400">Critical severity — consider isolating the affected system until patched.</span>
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {selectedVuln.cve_id && (
                      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
                        <h4 className="text-[12px] font-semibold text-[#e4e4e7] mb-2">References</h4>
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${selectedVuln.cve_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          NVD — {selectedVuln.cve_id}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-t border-white/[0.06] bg-[#0e0e15] shrink-0">
              <button
                onClick={() => addToast("AI Fix — coming soon", "info")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
              >
                <Wand2 className="w-3.5 h-3.5" />
                AI Fix
              </button>
              <button
                onClick={() => addToast("Share — coming soon", "info")}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium text-[#a1a1aa] bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
              {selectedVuln.cve_id && (
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${selectedVuln.cve_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium text-[#a1a1aa] bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </a>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ─── Add Target Modal ─────────────────────────────────────────── */}
      {showAddTarget && <AddTargetModal onClose={() => setShowAddTarget(false)} onSubmit={addTarget} />}

      {/* ─── Scan Modal ───────────────────────────────────────────────── */}
      {showScanModal && (
        <ScanModal
          targetName={showScanModal.targetName}
          onClose={() => setShowScanModal(null)}
          onStart={(type) => startScan(showScanModal.targetId, type)}
        />
      )}

      {/* ─── New Pentest Modal (target + scan type selector) ─────────── */}
      {showNewPentest && (
        <NewPentestModal
          targets={targets}
          onClose={() => setShowNewPentest(false)}
          onStart={(targetId, scanType) => {
            setShowNewPentest(false);
            startScan(targetId, scanType);
          }}
          onAddTarget={() => {
            setShowNewPentest(false);
            setShowAddTarget(true);
          }}
        />
      )}

      {/* ─── Scan Detail Modal ────────────────────────────────────────── */}
      {scanDetail && <ScanDetailModal scan={scanDetail} onClose={() => setScanDetail(null)} authFetch={authFetch} />}

      {/* ─── Toast Notifications ──────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} />
        ))}
      </div>
    </div>
  );
}

// ─── Scan Row ────────────────────────────────────────────────────────────────

function ScanRow({ scan, onClick }: { scan: Scan; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-3 min-w-0">
        <StatusIcon status={scan.status} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#e4e4e7] truncate">{scan.scan_type}</p>
          <p className="text-[11px] text-[#71717a] truncate">
            {scan.tool || "auto"} · {new Date(scan.started_at || scan.completed_at || Date.now()).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {scan.duration && <span className="text-[11px] text-[#71717a]">{scan.duration}s</span>}
        <StatusBadge status={scan.status} />
      </div>
    </div>
  );
}

// ─── Vuln Row ────────────────────────────────────────────────────────────────

function VulnRow({ vuln, onClick }: { vuln: Vulnerability; onClick?: () => void }) {
  const c = getSeverityColor(vuln.severity);
  return (
    <div
      className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#e4e4e7] truncate">{vuln.title}</p>
          <p className="text-[11px] text-[#71717a] truncate">
            {vuln.cve_id || "No CVE"} · {vuln.affected_component || "Unknown"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {vuln.is_fixed && <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">Fixed</span>}
        <SeverityBadge severity={vuln.severity} />
      </div>
    </div>
  );
}

// ─── Target Card ─────────────────────────────────────────────────────────────

function TargetCard({
  target,
  onScan,
  index,
  canScan: canScanProp,
}: {
  target: Target;
  onScan: (id: number) => void;
  index: number;
  canScan: boolean;
}) {
  const typeIcons: Record<string, { icon: any; color: string }> = {
    domain: { icon: Globe, color: "text-blue-400" },
    ip: { icon: Server, color: "text-green-400" },
    url: { icon: Globe, color: "text-purple-400" },
  };
  const t = typeIcons[target.type] || typeIcons.domain;

  return (
    <div
      className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.1] hover:scale-[1.01] transition-all duration-200 group"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-white/[0.04]">
            <t.icon className={`w-4 h-4 ${t.color}`} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-semibold text-[#e4e4e7] truncate">{target.name}</h4>
            <p className="text-[11px] text-[#71717a] truncate font-mono">{target.host}</p>
          </div>
        </div>
        <span className="text-[10px] text-[#71717a] bg-white/[0.04] px-1.5 py-0.5 rounded uppercase tracking-wider">{target.type}</span>
      </div>

      <p className="text-[12px] text-[#71717a] mb-4 line-clamp-2">{target.description || "No description provided"}</p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#71717a]">Added {new Date(target.created_at).toLocaleDateString()}</span>
        {canScanProp && (
          <button
            onClick={() => onScan(target.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all duration-200"
          >
            <Play className="w-3 h-3" />
            Scan
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────────────

function AddTargetModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; host: string; type: string; description: string }) => void;
}) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [type, setType] = useState("domain");
  const [description, setDescription] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] w-full max-w-md mx-4 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-[#e4e4e7]">Add New Target</h3>
          <button onClick={onClose} className="text-[#71717a] hover:text-[#e4e4e7] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production API"
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">Host</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="e.g., 192.168.1.1 or example.com"
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">Type</label>
            <div className="flex gap-2">
              {[
                { value: "domain", label: "Domain", icon: Globe },
                { value: "ip", label: "IP Address", icon: Server },
                { value: "url", label: "URL", icon: Globe },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-[12px] font-medium border transition-all duration-200 ${
                    type === t.value ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-white/[0.02] border-white/[0.06] text-[#71717a] hover:border-white/[0.1]"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-3.5 py-2 rounded-md text-[13px] font-medium text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-white/[0.04] transition-all">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ name, host, type, description })}
            disabled={!name || !host}
            className="px-3.5 py-2 rounded-md text-[13px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
          >
            Add Target
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanModal({
  targetName,
  onClose,
  onStart,
}: {
  targetName: string;
  onClose: () => void;
  onStart: (type: string) => void;
}) {
  const [selected, setSelected] = useState("port_scan");

  const scanTypes = [
    { id: "full_scan", label: "Full Scan", desc: "Comprehensive scan — ports, subdomains, web, vulnerabilities", icon: Radar, color: "text-indigo-400" },
    { id: "port_scan", label: "Port Scan", desc: "Discover open ports and services", icon: Wifi, color: "text-blue-400" },
    { id: "subdomain", label: "Subdomain Scan", desc: "Enumerate subdomains", icon: Globe, color: "text-purple-400" },
    { id: "web_scan", label: "Web Scan", desc: "Analyze web application", icon: Eye, color: "text-green-400" },
    { id: "vulnerability", label: "Vulnerability Scan", desc: "Detect known vulnerabilities", icon: Bug, color: "text-red-400" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] w-full max-w-md mx-4 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-semibold text-[#e4e4e7]">Start Scan</h3>
            <p className="text-[11px] text-[#71717a] mt-0.5">Target: {targetName}</p>
          </div>
          <button onClick={onClose} className="text-[#71717a] hover:text-[#e4e4e7] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {scanTypes.map((st) => (
            <button
              key={st.id}
              onClick={() => setSelected(st.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 text-left ${
                selected === st.id ? "bg-indigo-500/10 border-indigo-500/30" : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
              }`}
            >
              <div className={`p-1.5 rounded-md ${selected === st.id ? "bg-indigo-500/20" : "bg-white/[0.04]"}`}>
                <st.icon className={`w-4 h-4 ${selected === st.id ? "text-indigo-400" : st.color}`} />
              </div>
              <div className="flex-1">
                <p className={`text-[13px] font-medium ${selected === st.id ? "text-indigo-400" : "text-[#e4e4e7]"}`}>{st.label}</p>
                <p className="text-[11px] text-[#71717a]">{st.desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected === st.id ? "border-indigo-400" : "border-white/20"}`}>
                {selected === st.id && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-3.5 py-2 rounded-md text-[13px] font-medium text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-white/[0.04] transition-all">
            Cancel
          </button>
          <button onClick={() => onStart(selected)} className="flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20">
            <Play className="w-3.5 h-3.5" />
            Start Scan
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPentestModal({
  targets,
  onClose,
  onStart,
  onAddTarget,
}: {
  targets: Target[];
  onClose: () => void;
  onStart: (targetId: number, scanType: string) => void;
  onAddTarget: () => void;
}) {
  const [selectedTarget, setSelectedTarget] = useState<number | null>(targets.length > 0 ? targets[0].id : null);
  const [selectedScan, setSelectedScan] = useState("vulnerability");

  const scanTypes = [
    { id: "full_scan", label: "Full Scan", desc: "Comprehensive scan — ports, subdomains, web, vulnerabilities", icon: Radar, color: "text-indigo-400" },
    { id: "vulnerability", label: "Vulnerability Scan", desc: "Detect known vulnerabilities", icon: Bug, color: "text-red-400" },
    { id: "port_scan", label: "Port Scan", desc: "Discover open ports and services", icon: Wifi, color: "text-blue-400" },
    { id: "subdomain", label: "Subdomain Scan", desc: "Enumerate subdomains", icon: Globe, color: "text-purple-400" },
    { id: "web_scan", label: "Web Scan", desc: "Analyze web application security", icon: Eye, color: "text-green-400" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] w-full max-w-lg mx-4 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-semibold text-[#e4e4e7]">New Pentest</h3>
            <p className="text-[11px] text-[#71717a] mt-0.5">Select a target and scan type to begin</p>
          </div>
          <button onClick={onClose} className="text-[#71717a] hover:text-[#e4e4e7] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Target selector */}
          <div>
            <label className="block text-[11px] font-medium text-[#71717a] uppercase tracking-wider mb-2">Select Target</label>
            {targets.length > 0 ? (
              <div className="space-y-1.5 max-h-32 overflow-auto">
                {targets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTarget(t.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md border transition-all duration-150 text-left ${
                      selectedTarget === t.id
                        ? "bg-indigo-500/10 border-indigo-500/30"
                        : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
                    }`}
                  >
                    <Globe className={`w-4 h-4 shrink-0 ${selectedTarget === t.id ? "text-indigo-400" : "text-[#71717a]"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium truncate ${selectedTarget === t.id ? "text-indigo-400" : "text-[#e4e4e7]"}`}>{t.name}</p>
                      <p className="text-[11px] text-[#71717a] truncate font-mono">{t.host}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedTarget === t.id ? "border-indigo-400" : "border-white/20"}`}>
                      {selectedTarget === t.id && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-[13px] text-[#71717a] mb-2">No targets configured</p>
                <button onClick={onAddTarget} className="text-[12px] text-indigo-400 hover:text-indigo-300 font-medium">
                  + Add a target first
                </button>
              </div>
            )}
          </div>

          {/* Scan type selector */}
          <div>
            <label className="block text-[11px] font-medium text-[#71717a] uppercase tracking-wider mb-2">Scan Type</label>
            <div className="space-y-1.5">
              {scanTypes.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedScan(st.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md border transition-all duration-150 text-left ${
                    selectedScan === st.id
                      ? "bg-indigo-500/10 border-indigo-500/30"
                      : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
                  }`}
                >
                  <div className={`p-1.5 rounded-md ${selectedScan === st.id ? "bg-indigo-500/20" : "bg-white/[0.04]"}`}>
                    <st.icon className={`w-4 h-4 ${selectedScan === st.id ? "text-indigo-400" : st.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-[13px] font-medium ${selectedScan === st.id ? "text-indigo-400" : "text-[#e4e4e7]"}`}>{st.label}</p>
                    <p className="text-[11px] text-[#71717a]">{st.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedScan === st.id ? "border-indigo-400" : "border-white/20"}`}>
                    {selectedScan === st.id && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-3.5 py-2 rounded-md text-[13px] font-medium text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-white/[0.04] transition-all">
            Cancel
          </button>
          <button
            onClick={() => selectedTarget && onStart(selectedTarget, selectedScan)}
            disabled={!selectedTarget}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
          >
            <Play className="w-3.5 h-3.5" />
            Start Pentest
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanDetailModal({ scan, onClose, authFetch }: { scan: Scan; onClose: () => void; authFetch: (url: string, options?: RequestInit) => Promise<Response> }) {
  const [creatingIssues, setCreatingIssues] = useState(false);
  const [issuesCreated, setIssuesCreated] = useState<number | null>(null);

  const handleCreateIssues = async () => {
    setCreatingIssues(true);
    try {
      const res = await authFetch(`${API_URL}/api/scans/${scan.id}/extract-issues`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setIssuesCreated(data.created);
      }
    } catch (error) {
      console.error('Failed to create issues:', error);
    } finally {
      setCreatingIssues(false);
    }
  };
  // Simple markdown renderer
  function renderMarkdown(text: string) {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let listType: 'ol' | 'ul' | null = null;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        const Tag = listType;
        elements.push(
          <Tag key={`list-${elements.length}`} className={`ml-4 space-y-1 ${listType === 'ol' ? 'list-decimal' : 'list-disc'} list-inside text-[13px] text-[#a1a1aa]`}>
            {listItems.map((item, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            ))}
          </Tag>
        );
        listItems = [];
        listType = null;
      }
    };

    const inlineFormat = (s: string) => {
      return s
        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[#e4e4e7] font-semibold">$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/[0.06] text-indigo-300 text-[12px] font-mono">$1</code>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        flushList();
        continue;
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(<h4 key={i} className="text-[13px] font-semibold text-[#e4e4e7] mt-3 mb-1">{trimmed.slice(4)}</h4>);
      } else if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(<h3 key={i} className="text-[14px] font-semibold text-[#e4e4e7] mt-3 mb-1">{trimmed.slice(3)}</h3>);
      } else if (trimmed.startsWith('# ')) {
        flushList();
        elements.push(<h2 key={i} className="text-[15px] font-bold text-[#e4e4e7] mt-3 mb-1">{trimmed.slice(2)}</h2>);
      }
      // Ordered list
      else if (/^\d+\.\s/.test(trimmed)) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(trimmed.replace(/^\d+\.\s/, ''));
      }
      // Unordered list
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(trimmed.slice(2));
      }
      // Indented list item (sub-item)
      else if (/^\s+[-*]\s/.test(line)) {
        listItems.push('  ' + trimmed.replace(/^[-*]\s/, ''));
      }
      // Normal paragraph
      else {
        flushList();
        elements.push(<p key={i} className="text-[13px] text-[#a1a1aa] leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />);
      }
    }
    flushList();
    return elements;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] w-full max-w-lg mx-4 shadow-2xl animate-slide-up max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] sticky top-0 bg-[#12121a]">
          <div>
            <h3 className="text-sm font-semibold text-[#e4e4e7]">Scan #{scan.id}</h3>
            <p className="text-[11px] text-[#71717a] mt-0.5">{scan.scan_type}</p>
          </div>
          <button onClick={onClose} className="text-[#71717a] hover:text-[#e4e4e7] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
              <p className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">Status</p>
              <StatusBadge status={scan.status} />
            </div>
            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
              <p className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">Tool</p>
              <p className="text-[13px] text-[#e4e4e7]">{scan.tool || "auto"}</p>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
              <p className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">Duration</p>
              <p className="text-[13px] text-[#e4e4e7]">{scan.duration ? `${scan.duration}s` : "—"}</p>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
              <p className="text-[10px] text-[#71717a] uppercase tracking-wider mb-1">Started</p>
              <p className="text-[13px] text-[#e4e4e7]">{scan.started_at ? new Date(scan.started_at).toLocaleString() : "—"}</p>
            </div>
          </div>

          {scan.output && (
            <div>
              <p className="text-[11px] text-[#71717a] uppercase tracking-wider mb-2">Output</p>
              <pre className="bg-[#0a0a0f] rounded-lg p-4 text-[12px] text-[#a1a1aa] font-mono overflow-auto max-h-48 border border-white/[0.04]">{scan.output}</pre>
            </div>
          )}

          {scan.ai_summary && (
            <div>
              <p className="text-[11px] text-[#71717a] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> AI Analysis & Remediation
              </p>
              <div className="bg-indigo-500/5 rounded-lg p-4 border border-indigo-500/10 space-y-1">
                {renderMarkdown(scan.ai_summary)}
              </div>
              
              {/* Create Issues Button */}
              <div className="mt-3 flex items-center gap-3">
                {issuesCreated !== null ? (
                  <div className="flex items-center gap-2 text-[13px]">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">{issuesCreated} issues created and tracked</span>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateIssues}
                    disabled={creatingIssues}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-[13px] text-indigo-400 transition-colors disabled:opacity-50"
                  >
                    {creatingIssues ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating Issues...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        Create Issues from Findings
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Chat ─────────────────────────────────────────────────────────────────

function AIChat({ addToast, authFetch }: { addToast: (msg: string, type: Toast["type"]) => void; authFetch: (url: string, options?: RequestInit) => Promise<Response> }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          session_id: "default",
          provider,
          model,
        }),
      });

      if (res.status === 403) {
        addToast("Insufficient permissions — AI chat requires developer or admin role", "error");
      } else if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      }
    } catch (error) {
      addToast("Failed to get AI response", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-[13px] font-semibold text-[#e4e4e7]">AI Security Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => { setProvider(e.target.value); if (e.target.value === "custom") setModel("mimo-v2.5-pro"); }}
            className="text-[11px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[#a1a1aa] focus:outline-none focus:border-indigo-500/50"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
            <option value="custom">Custom (Xiaomi)</option>
          </select>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-[11px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[#a1a1aa] focus:outline-none focus:border-indigo-500/50"
          >
            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            <option value="gpt-4o">gpt-4o</option>
            <option value="claude-3.5-sonnet">claude-3.5-sonnet</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-3 rounded-xl bg-indigo-500/10 mb-4">
              <Sparkles className="w-6 h-6 text-indigo-400" />
            </div>
            <p className="text-[14px] font-medium text-[#e4e4e7] mb-1">AI Security Assistant</p>
            <p className="text-[12px] text-[#71717a] max-w-sm">
              Ask me anything about security — vulnerability analysis, remediation advice, threat intelligence, or scan interpretation.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`chat-message ${msg.role}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="chat-message assistant">
              <div className="flex gap-1.5 items-center">
                <span className="typing-dot w-1.5 h-1.5 bg-[#71717a] rounded-full inline-block">·</span>
                <span className="typing-dot w-1.5 h-1.5 bg-[#71717a] rounded-full inline-block">·</span>
                <span className="typing-dot w-1.5 h-1.5 bg-[#71717a] rounded-full inline-block">·</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/[0.06] shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask about security vulnerabilities, remediation, or threats..."
            className="flex-1 px-4 py-2.5 bg-[#0a0a0f] border border-white/[0.06] rounded-lg text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tools List ──────────────────────────────────────────────────────────────

function ToolsList() {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/tools`)
      .then((res) => res.json())
      .then(setTools)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-40 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[#e4e4e7]">Security Tools</h3>
        <p className="text-[12px] text-[#71717a] mt-0.5">{tools.length} tools available</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <div key={tool.name} className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.1] hover:scale-[1.01] transition-all duration-200 group">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-md bg-indigo-500/10">
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="flex items-center gap-1.5 text-[10px] text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Installed
              </span>
            </div>
            <h4 className="text-[13px] font-semibold text-[#e4e4e7] mb-1">{tool.name}</h4>
            <p className="text-[12px] text-[#71717a] mb-3 line-clamp-2">{tool.description || "Security tool"}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#71717a] bg-white/[0.04] px-1.5 py-0.5 rounded uppercase tracking-wider">{tool.category || "general"}</span>
              {tool.dangerous && (
                <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Dangerous</span>
              )}
            </div>
          </div>
        ))}
        {tools.length === 0 && (
          <div className="col-span-full">
            <EmptyStateLarge icon={Zap} title="No tools found" message="Security tools will appear here once configured" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── System Logs Tab (Grafana-like) ─────────────────────────────────────────

function LogsTab({ authFetch, addToast, isAdmin }: { authFetch: (url: string, options?: RequestInit) => Promise<Response>; addToast: (msg: string, type: Toast["type"]) => void; isAdmin: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, by_level: {}, by_source: {} });
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [search, setSearch] = useState("");
  const [liveTail, setLiveTail] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const pausedLogsRef = useRef<any[]>([]);

  // WebSocket connection for live tail
  useEffect(() => {
    if (!liveTail) return;

    const wsUrl = `ws://localhost:8000/ws/logs`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      addToast("Connected to log stream", "success");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "initial") {
          setLogs(data.logs || []);
          setStats(data.stats || {});
        } else if (data.type === "log") {
          if (isPaused) {
            pausedLogsRef.current.push(data.entry);
          } else {
            setLogs(prev => [data.entry, ...prev].slice(0, 500));
          }
          if (data.stats) setStats(data.stats);
        }
      } catch { }
    };

    ws.onclose = () => {
      // Reconnect after 3s
      setTimeout(() => {
        if (liveTail) {
          // Force re-render to trigger useEffect
          setLiveTail(false);
          setTimeout(() => setLiveTail(true), 100);
        }
      }, 3000);
    };

    ws.onerror = () => { };

    return () => {
      ws.close();
    };
  }, [liveTail, isPaused]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && !isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll, isPaused]);

  // Unpause and flush
  const handleUnpause = () => {
    setIsPaused(false);
    if (pausedLogsRef.current.length > 0) {
      setLogs(prev => [...pausedLogsRef.current, ...prev].slice(0, 500));
      pausedLogsRef.current = [];
    }
  };

  // Clear logs
  const handleClear = async () => {
    try {
      await authFetch(`${API_URL}/api/logs`, { method: "DELETE" });
      setLogs([]);
      addToast("Logs cleared", "success");
    } catch { addToast("Failed to clear logs", "error"); }
  };

  // Filter logs client-side
  const filteredLogs = logs.filter(log => {
    if (filterLevel !== "all" && log.level !== filterLevel) return false;
    if (filterSource !== "all" && log.source !== filterSource) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase()) && !log.component?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Level colors (Grafana-like)
  const levelStyles: Record<string, { bg: string; text: string; dot: string }> = {
    critical: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-500" },
    error: { bg: "bg-red-500/5", text: "text-red-400", dot: "bg-red-500" },
    warning: { bg: "bg-yellow-500/5", text: "text-yellow-400", dot: "bg-yellow-500" },
    info: { bg: "bg-blue-500/5", text: "text-blue-400", dot: "bg-blue-500" },
    debug: { bg: "bg-gray-500/5", text: "text-gray-400", dot: "bg-gray-500" },
  };

  const sourceIcons: Record<string, string> = {
    backend: "⚡",
    frontend: "🌐",
    scanner: "🔍",
    system: "⚙️",
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "." + String(d.getMilliseconds()).padStart(3, "0");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Level filter */}
        <div className="flex items-center bg-[#12121a] rounded-md border border-white/[0.06] overflow-hidden">
          {(["all", "critical", "error", "warning", "info", "debug"] as const).map((l) => (
            <button key={l} onClick={() => setFilterLevel(l)}
              className={`px-2.5 py-1.5 text-[11px] font-medium transition-all ${filterLevel === l ? (l === "error" || l === "critical" ? "bg-red-500/10 text-red-400" : l === "warning" ? "bg-yellow-500/10 text-yellow-400" : l === "info" ? "bg-blue-500/10 text-blue-400" : "bg-white/[0.06] text-[#e4e4e7]") : "text-[#71717a] hover:text-[#a1a1aa]"}`}>
              {l === "all" ? "All" : l.charAt(0).toUpperCase() + l.slice(1)}
              {l !== "all" && stats.by_level?.[l] > 0 && <span className="ml-1 text-[10px] opacity-70">({stats.by_level[l]})</span>}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="px-2.5 py-1.5 bg-[#12121a] border border-white/[0.06] rounded-md text-[11px] text-[#e4e4e7] focus:outline-none focus:border-indigo-500/50">
          <option value="all">All Sources</option>
          <option value="backend">⚡ Backend</option>
          <option value="frontend">🌐 Frontend</option>
          <option value="scanner">🔍 Scanner</option>
          <option value="system">⚙️ System</option>
        </select>

        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#12121a] border border-white/[0.06] text-[#71717a] focus-within:border-indigo-500/30 transition-colors">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..."
            className="flex-1 bg-transparent text-[11px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none" />
          {search && <button onClick={() => setSearch("")} className="text-[#71717a] hover:text-[#a1a1aa]"><X className="w-3 h-3" /></button>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => { if (isPaused) handleUnpause(); else setIsPaused(true); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${isPaused ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
            {isPaused ? <><Play className="w-3 h-3" /> Resume ({pausedLogsRef.current.length} buffered)</> : <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Live</>}
          </button>
          <label className="flex items-center gap-1.5 text-[11px] text-[#71717a] cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="rounded" />
            Auto-scroll
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-[#71717a] cursor-pointer">
            <input type="checkbox" checked={showHistory} onChange={e => { setShowHistory(e.target.checked); if (e.target.checked) { /* fetch from DB */ authFetch(`${API_URL}/api/logs?history=true&limit=200`).then(r => r.json()).then(d => { if (d.logs) setLogs(d.logs); }); } }} className="rounded" />
            History (DB)
          </label>
          {isAdmin && (
            <button onClick={handleClear} className="p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Clear logs">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-2 text-[10px] text-[#71717a]">
        <span>Total: <span className="text-[#e4e4e7] font-medium">{stats.total || 0}</span></span>
        <span>Stored: <span className="text-[#e4e4e7] font-medium">{stats.stored || 0}</span></span>
        <span>Errors: <span className="text-red-400 font-medium">{(stats.by_level?.error || 0) + (stats.by_level?.critical || 0)}</span></span>
        <span>Warnings: <span className="text-yellow-400 font-medium">{stats.by_level?.warning || 0}</span></span>
        <span>Showing: <span className="text-indigo-400 font-medium">{filteredLogs.length}</span></span>
        {stats.total_persisted > 0 && <span>Persisted: <span className="text-green-400 font-medium">{stats.total_persisted}</span></span>}
        <span className="ml-auto text-[9px] text-[#52525b]">Loki webhook: POST /api/logs/webhook/loki · Retention: {stats.retention_days || 90}d</span>
      </div>

      {/* Log Viewer (Grafana-style) */}
      <div ref={logContainerRef} className="flex-1 overflow-auto bg-[#0a0a0f] rounded-lg border border-white/[0.06] font-mono text-[12px]">
        {filteredLogs.length > 0 ? (
          <table className="w-full">
            <tbody>
              {filteredLogs.map((log, i) => {
                const style = levelStyles[log.level] || levelStyles.info;
                return (
                  <tr key={log.id || i} className={`${style.bg} hover:bg-white/[0.03] transition-colors border-b border-white/[0.02]`}>
                    <td className="px-3 py-1.5 text-[10px] text-[#71717a] whitespace-nowrap align-top w-[100px]">{formatTime(log.timestamp)}</td>
                    <td className="px-2 py-1.5 align-top w-[20px]">
                      <span className={`w-1.5 h-1.5 rounded-full inline-block mt-1 ${style.dot}`} />
                    </td>
                    <td className={`px-2 py-1.5 font-semibold uppercase text-[10px] whitespace-nowrap align-top w-[60px] ${style.text}`}>{log.level}</td>
                    <td className="px-2 py-1.5 text-[10px] text-[#71717a] whitespace-nowrap align-top w-[80px]">
                      {sourceIcons[log.source] || "📄"} {log.source}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-indigo-400/70 whitespace-nowrap align-top w-[80px]">{log.component || "—"}</td>
                    <td className="px-3 py-1.5 text-[#e4e4e7] break-all">{log.message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Terminal className="w-8 h-8 text-[#71717a] mb-3" />
            <p className="text-[13px] text-[#a1a1aa]">No logs yet</p>
            <p className="text-[11px] text-[#71717a]">Logs from backend and frontend will appear here in real-time</p>
          </div>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

// ─── Source Code Scanning Tab ────────────────────────────────────────────────

function SourceCodeTab({ addToast, authFetch, canEdit, canScan }: { addToast: (msg: string, type: Toast["type"]) => void; authFetch: (url: string, options?: RequestInit) => Promise<Response>; canEdit: boolean; canScan: boolean }) {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanModal, setShowScanModal] = useState(false);
  const [form, setForm] = useState({ tool: "trivy", target: ".", project_key: "", server_url: "http://localhost:9000", language: "javascript" });
  const [scanning, setScanning] = useState(false);

  const fetchScans = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/source-scans`);
      if (res.ok) setScans(await res.json());
    } catch { } finally { setLoading(false); }
  };
  useEffect(() => { fetchScans(); }, []);

  const handleScan = async () => {
    if (!form.target) { addToast("Target path required", "error"); return; }
    setScanning(true);
    try {
      const body: any = { tool: form.tool, target: form.target };
      if (form.tool === "sonar-scanner") {
        body.project_key = form.project_key || `strix-${Date.now()}`;
        body.server_url = form.server_url;
      }
      if (form.tool === "codeql") {
        body.language = form.language;
      }
      const res = await authFetch(`${API_URL}/api/source-scans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        addToast(`Source scan started with ${form.tool}`, "success");
        setShowScanModal(false);
        fetchScans();
      } else { addToast("Failed to start scan", "error"); }
    } catch { addToast("Failed to start scan", "error"); }
    finally { setScanning(false); }
  };

  const handleDelete = async (scanId: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/source-scans/${scanId}`, { method: "DELETE" });
      if (res.ok) { addToast("Scan deleted", "success"); fetchScans(); }
    } catch { addToast("Failed to delete", "error"); }
  };

  const toolInfo: Record<string, { icon: string; color: string; desc: string }> = {
    trivy: { icon: "🛡️", color: "text-blue-400", desc: "Filesystem vulnerability scanner — CVEs, secrets, misconfigs" },
    "sonar-scanner": { icon: "📊", color: "text-purple-400", desc: "SonarQube static analysis — bugs, code smells, security hotspots" },
    codeql: { icon: "🔬", color: "text-green-400", desc: "GitHub CodeQL semantic analysis — deep vulnerability detection" },
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-lg" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#e4e4e7]">Source Code Scanning</h3>
          <p className="text-[12px] text-[#71717a] mt-0.5">SAST analysis with Trivy, SonarQube & CodeQL</p>
        </div>
        {canScan && (
          <button onClick={() => setShowScanModal(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-500/20">
            <ScanLine className="w-3.5 h-3.5" /> New Source Scan
          </button>
        )}
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(toolInfo).map(([key, val]) => (
          <div key={key} className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{val.icon}</span>
              <div>
                <h4 className="text-[13px] font-semibold text-[#e4e4e7]">{key}</h4>
                <p className="text-[11px] text-[#71717a]">{val.desc}</p>
              </div>
            </div>
            <button onClick={() => { setForm({ ...form, tool: key }); setShowScanModal(true); }}
              className="w-full mt-2 px-3 py-1.5 text-[12px] font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-md transition-all">
              Scan with {key}
            </button>
          </div>
        ))}
      </div>

      {/* Scan Modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowScanModal(false)}>
          <div className="bg-[#12121a] rounded-xl border border-white/[0.08] w-full max-w-lg p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#e4e4e7] mb-4">New Source Code Scan</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#71717a] mb-1 block">Scanner Tool</label>
                <select value={form.tool} onChange={e => setForm({ ...form, tool: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] focus:outline-none focus:border-indigo-500/50">
                  <option value="trivy">🛡️ Trivy — Vulnerability, Secret & Misconfig Scanner</option>
                  <option value="sonar-scanner">📊 SonarQube — Static Code Analysis</option>
                  <option value="codeql">🔬 CodeQL — Semantic Code Analysis (GitHub)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[#71717a] mb-1 block">Target Path</label>
                <input value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} placeholder="/path/to/source or ." className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50" />
              </div>
              {form.tool === "sonar-scanner" && (
                <>
                  <div>
                    <label className="text-[11px] text-[#71717a] mb-1 block">SonarQube Project Key</label>
                    <input value={form.project_key} onChange={e => setForm({ ...form, project_key: e.target.value })} placeholder="my-project" className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#71717a] mb-1 block">SonarQube Server URL</label>
                    <input value={form.server_url} onChange={e => setForm({ ...form, server_url: e.target.value })} placeholder="http://localhost:9000" className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50" />
                  </div>
                </>
              )}
              {form.tool === "codeql" && (
                <div>
                  <label className="text-[11px] text-[#71717a] mb-1 block">Language</label>
                  <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] focus:outline-none focus:border-indigo-500/50">
                    <option value="javascript">JavaScript / TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="go">Go</option>
                    <option value="csharp">C#</option>
                    <option value="cpp">C / C++</option>
                    <option value="ruby">Ruby</option>
                    <option value="swift">Swift</option>
                  </select>
                </div>
              )}
              <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                <p className="text-[11px] text-[#71717a]">{toolInfo[form.tool]?.desc}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowScanModal(false)} className="px-4 py-2 text-[13px] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors">Cancel</button>
              <button onClick={handleScan} disabled={scanning} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all disabled:opacity-50">
                {scanning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...</> : <><ScanLine className="w-3.5 h-3.5" /> Start Scan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan History */}
      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h4 className="text-[13px] font-semibold text-[#e4e4e7]">Scan History</h4>
        </div>
        {scans.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="text-[11px] text-[#71717a] uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Tool</th>
                <th className="text-left px-4 py-2.5 font-medium">Target</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-center px-4 py-2.5 font-medium">Critical</th>
                <th className="text-center px-4 py-2.5 font-medium">High</th>
                <th className="text-center px-4 py-2.5 font-medium">Medium</th>
                <th className="text-center px-4 py-2.5 font-medium">Low</th>
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan) => {
                const t = toolInfo[scan.tool] || { icon: "🔍", color: "text-gray-400" };
                return (
                  <tr key={scan.id} className="text-[12px] border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{t.icon}</span>
                        <span className="text-[#e4e4e7] font-medium">{scan.tool}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#71717a] font-mono truncate max-w-[200px]">{scan.target}</td>
                    <td className="px-4 py-3"><StatusBadge status={scan.status} /></td>
                    <td className="px-4 py-3 text-center"><span className={`font-medium ${scan.critical_count > 0 ? 'text-red-400' : 'text-[#71717a]'}`}>{scan.critical_count}</span></td>
                    <td className="px-4 py-3 text-center"><span className={`font-medium ${scan.high_count > 0 ? 'text-orange-400' : 'text-[#71717a]'}`}>{scan.high_count}</span></td>
                    <td className="px-4 py-3 text-center"><span className={`font-medium ${scan.medium_count > 0 ? 'text-yellow-400' : 'text-[#71717a]'}`}>{scan.medium_count}</span></td>
                    <td className="px-4 py-3 text-center"><span className={`font-medium ${scan.low_count > 0 ? 'text-blue-400' : 'text-[#71717a]'}`}>{scan.low_count}</span></td>
                    <td className="px-4 py-3 text-[#71717a]">{new Date(scan.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {canEdit && (
                        <button onClick={() => handleDelete(scan.id)} className="p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4"><ScanLine className="w-6 h-6 text-[#71717a]" /></div>
            <p className="text-[14px] font-medium text-[#a1a1aa] mb-1">No source scans yet</p>
            <p className="text-[12px] text-[#71717a] max-w-sm mb-4">Run SAST analysis on your source code with Trivy, SonarQube, or CodeQL</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Repositories Tab ─────────────────────────────────────────────────────

function RepositoriesTab({ addToast, authFetch, canEdit, canScan }: { addToast: (msg: string, type: Toast["type"]) => void; authFetch: (url: string, options?: RequestInit) => Promise<Response>; canEdit: boolean; canScan: boolean }) {
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", provider: "github", description: "" });
  const [scanning, setScanning] = useState<Set<number>>(new Set());

  const fetchRepos = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/repositories`);
      if (res.ok) setRepos(await res.json());
    } catch { } finally { setLoading(false); }
  };
  useEffect(() => { fetchRepos(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.url) { addToast("Name and URL required", "error"); return; }
    try {
      const res = await authFetch(`${API_URL}/api/repositories`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { addToast(`Repository "${form.name}" added`, "success"); setShowAdd(false); setForm({ name: "", url: "", provider: "github", description: "" }); fetchRepos(); }
      else { addToast("Failed to add repository", "error"); }
    } catch { addToast("Failed to add repository", "error"); }
  };

  const handleScan = async (repoId: number) => {
    setScanning(prev => new Set(prev).add(repoId));
    try {
      const res = await authFetch(`${API_URL}/api/repositories/${repoId}/scan`, { method: "POST" });
      if (res.ok) { addToast("Secret scan started", "success"); setTimeout(() => { fetchRepos(); setScanning(prev => { const s = new Set(prev); s.delete(repoId); return s; }); }, 3000); }
      else { addToast("Scan failed", "error"); setScanning(prev => { const s = new Set(prev); s.delete(repoId); return s; }); }
    } catch { addToast("Scan failed", "error"); setScanning(prev => { const s = new Set(prev); s.delete(repoId); return s; }); }
  };

  const handleDelete = async (repoId: number, name: string) => {
    if (!confirm(`Delete repository "${name}"?`)) return;
    try {
      const res = await authFetch(`${API_URL}/api/repositories/${repoId}`, { method: "DELETE" });
      if (res.ok) { addToast(`Repository "${name}" deleted`, "success"); fetchRepos(); }
      else { addToast("Failed to delete", "error"); }
    } catch { addToast("Failed to delete", "error"); }
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-lg" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#e4e4e7]">Repositories</h3>
          <p className="text-[12px] text-[#71717a] mt-0.5">{repos.length} repositories connected</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-500/20">
            <Plus className="w-3.5 h-3.5" /> Add Repository
          </button>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-[#12121a] rounded-xl border border-white/[0.08] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#e4e4e7] mb-4">Add Repository</h3>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Repository name" className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50" />
              <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://github.com/org/repo" className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50" />
              <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] focus:outline-none focus:border-indigo-500/50">
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="bitbucket">Bitbucket</option>
              </select>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50 resize-none" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-[13px] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all">Add Repository</button>
            </div>
          </div>
        </div>
      )}

      {/* Repo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {repos.map((repo) => {
          const providerIcons: Record<string, string> = { github: "🐙", gitlab: "🦊", bitbucket: "🪣" };
          const isScanning = scanning.has(repo.id) || repo.status === "scanning";
          return (
            <div key={repo.id} className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.1] transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-white/[0.04] text-lg">{providerIcons[repo.provider] || "📁"}</div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-semibold text-[#e4e4e7] truncate">{repo.name}</h4>
                    <p className="text-[11px] text-[#71717a] truncate font-mono">{repo.url}</p>
                  </div>
                </div>
                <span className="text-[10px] text-[#71717a] bg-white/[0.04] px-1.5 py-0.5 rounded uppercase tracking-wider">{repo.provider}</span>
              </div>
              <p className="text-[12px] text-[#71717a] mb-3 line-clamp-2">{repo.description || "No description"}</p>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] text-[#71717a]">Secrets: <span className={`font-medium ${repo.secrets_found > 0 ? 'text-red-400' : 'text-green-400'}`}>{repo.secrets_found}</span></span>
                {repo.last_scanned_at && <span className="text-[11px] text-[#71717a]">Last scan: {new Date(repo.last_scanned_at).toLocaleDateString()}</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#71717a]">Added {new Date(repo.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  {canScan && (
                    isScanning ? (
                      <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 cursor-wait">
                        <Loader2 className="w-3 h-3 animate-spin" /> Scanning...
                      </button>
                    ) : (
                      <button onClick={() => handleScan(repo.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all">
                        <Search className="w-3 h-3" /> Scan Secrets
                      </button>
                    )
                  )}
                  {canEdit && (
                    <button onClick={() => handleDelete(repo.id, repo.name)} className="p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {repos.length === 0 && (
          <div className="col-span-full">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4"><FolderGit className="w-6 h-6 text-[#71717a]" /></div>
              <p className="text-[14px] font-medium text-[#a1a1aa] mb-1">No repositories connected</p>
              <p className="text-[12px] text-[#71717a] max-w-sm mb-4">Link your GitHub, GitLab, or Bitbucket repos for automated secret scanning</p>
              {canEdit && (
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20">
                  <Plus className="w-3.5 h-3.5" /> Add Your First Repository
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Networks Tab ─────────────────────────────────────────────────────────

function NetworksTab({ addToast, authFetch, canEdit, canScan }: { addToast: (msg: string, type: Toast["type"]) => void; authFetch: (url: string, options?: RequestInit) => Promise<Response>; canEdit: boolean; canScan: boolean }) {
  const [networks, setNetworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", cidr: "", description: "" });
  const [scanning, setScanning] = useState<Set<number>>(new Set());

  const fetchNetworks = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/networks`);
      if (res.ok) setNetworks(await res.json());
    } catch { } finally { setLoading(false); }
  };
  useEffect(() => { fetchNetworks(); }, []);

  const handleAdd = async () => {
    if (!form.name || !form.cidr) { addToast("Name and CIDR required", "error"); return; }
    try {
      const res = await authFetch(`${API_URL}/api/networks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { addToast(`Network "${form.name}" added`, "success"); setShowAdd(false); setForm({ name: "", cidr: "", description: "" }); fetchNetworks(); }
      else { addToast("Failed to add network", "error"); }
    } catch { addToast("Failed to add network", "error"); }
  };

  const handleDiscover = async (networkId: number) => {
    setScanning(prev => new Set(prev).add(networkId));
    try {
      const res = await authFetch(`${API_URL}/api/networks/${networkId}/discover`, { method: "POST" });
      if (res.ok) { addToast("Host discovery started", "success"); setTimeout(() => { fetchNetworks(); setScanning(prev => { const s = new Set(prev); s.delete(networkId); return s; }); }, 5000); }
      else { addToast("Discovery failed", "error"); setScanning(prev => { const s = new Set(prev); s.delete(networkId); return s; }); }
    } catch { addToast("Discovery failed", "error"); setScanning(prev => { const s = new Set(prev); s.delete(networkId); return s; }); }
  };

  const handleDelete = async (networkId: number, name: string) => {
    if (!confirm(`Delete network "${name}"?`)) return;
    try {
      const res = await authFetch(`${API_URL}/api/networks/${networkId}`, { method: "DELETE" });
      if (res.ok) { addToast(`Network "${name}" deleted`, "success"); fetchNetworks(); }
      else { addToast("Failed to delete", "error"); }
    } catch { addToast("Failed to delete", "error"); }
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-lg" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#e4e4e7]">Networks</h3>
          <p className="text-[12px] text-[#71717a] mt-0.5">{networks.length} network ranges configured</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-500/20">
            <Plus className="w-3.5 h-3.5" /> Add Network
          </button>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-[#12121a] rounded-xl border border-white/[0.08] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#e4e4e7] mb-4">Add Network Range</h3>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Network name (e.g., Office LAN)" className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50" />
              <input value={form.cidr} onChange={e => setForm({ ...form, cidr: e.target.value })} placeholder="CIDR (e.g., 192.168.1.0/24)" className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50 resize-none" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-[13px] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all">Add Network</button>
            </div>
          </div>
        </div>
      )}

      {/* Network Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {networks.map((net) => {
          const isScanning = scanning.has(net.id) || net.status === "scanning";
          return (
            <div key={net.id} className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.1] transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-white/[0.04]"><Network className="w-4 h-4 text-green-400" /></div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-semibold text-[#e4e4e7] truncate">{net.name}</h4>
                    <p className="text-[11px] text-[#71717a] truncate font-mono">{net.cidr}</p>
                  </div>
                </div>
                {isScanning && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
              </div>
              <p className="text-[12px] text-[#71717a] mb-3 line-clamp-2">{net.description || "No description"}</p>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] text-[#71717a]">Hosts: <span className="font-medium text-green-400">{net.hosts_discovered}</span></span>
                {net.last_scanned_at && <span className="text-[11px] text-[#71717a]">Last scan: {new Date(net.last_scanned_at).toLocaleDateString()}</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#71717a]">Added {new Date(net.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  {canScan && (
                    isScanning ? (
                      <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 cursor-wait">
                        <Loader2 className="w-3 h-3 animate-spin" /> Discovering...
                      </button>
                    ) : (
                      <button onClick={() => handleDiscover(net.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 transition-all">
                        <Radar className="w-3 h-3" /> Discover Hosts
                      </button>
                    )
                  )}
                  {canEdit && (
                    <button onClick={() => handleDelete(net.id, net.name)} className="p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {networks.length === 0 && (
          <div className="col-span-full">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4"><Network className="w-6 h-6 text-[#71717a]" /></div>
              <p className="text-[14px] font-medium text-[#a1a1aa] mb-1">No networks configured</p>
              <p className="text-[12px] text-[#71717a] max-w-sm mb-4">Add network ranges for automated host discovery and monitoring</p>
              {canEdit && (
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20">
                  <Plus className="w-3.5 h-3.5" /> Add Your First Network
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────

function IntegrationsTab({ addToast, authFetch, isAdmin }: { addToast: (msg: string, type: Toast["type"]) => void; authFetch: (url: string, options?: RequestInit) => Promise<Response>; isAdmin: boolean }) {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "slack", config: "{}" });

  const fetchIntegrations = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/integrations`);
      if (res.ok) setIntegrations(await res.json());
    } catch { } finally { setLoading(false); }
  };
  useEffect(() => { fetchIntegrations(); }, []);

  const handleAdd = async () => {
    if (!form.name) { addToast("Name required", "error"); return; }
    let config = {};
    try { config = JSON.parse(form.config); } catch { addToast("Invalid JSON config", "error"); return; }
    try {
      const res = await authFetch(`${API_URL}/api/integrations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, config }) });
      if (res.ok) { addToast(`Integration "${form.name}" added`, "success"); setShowAdd(false); setForm({ name: "", type: "slack", config: "{}" }); fetchIntegrations(); }
      else { addToast("Failed to add integration", "error"); }
    } catch { addToast("Failed to add integration", "error"); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete integration "${name}"?`)) return;
    try {
      const res = await authFetch(`${API_URL}/api/integrations/${id}`, { method: "DELETE" });
      if (res.ok) { addToast(`Integration "${name}" deleted`, "success"); fetchIntegrations(); }
      else { addToast("Failed to delete", "error"); }
    } catch { addToast("Failed to delete", "error"); }
  };

  const handleTest = async (id: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/integrations/${id}/test`, { method: "POST" });
      if (res.ok) { addToast("Test notification sent!", "success"); fetchIntegrations(); }
      else { addToast("Test failed", "error"); }
    } catch { addToast("Test failed", "error"); }
  };

  const integrationTypes: Record<string, { icon: string; color: string; desc: string }> = {
    slack: { icon: "💬", color: "text-purple-400", desc: "Send alerts to Slack channels" },
    jira: { icon: "📋", color: "text-blue-400", desc: "Create Jira tickets for vulnerabilities" },
    webhook: { icon: "🔗", color: "text-green-400", desc: "Send HTTP webhooks on events" },
    pagerduty: { icon: "📟", color: "text-yellow-400", desc: "Trigger PagerDuty incidents" },
    email: { icon: "📧", color: "text-red-400", desc: "Send email notifications" },
  };

  if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-40 rounded-lg" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#e4e4e7]">Integrations</h3>
          <p className="text-[12px] text-[#71717a] mt-0.5">{integrations.length} integrations connected</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-500/20">
            <Plus className="w-3.5 h-3.5" /> Add Integration
          </button>
        )}
      </div>

      {/* Available Integrations */}
      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-4">
        <h4 className="text-[13px] font-semibold text-[#e4e4e7] mb-3">Available Integrations</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(integrationTypes).map(([key, val]) => (
            <button key={key} onClick={() => { setForm({ name: `${key.charAt(0).toUpperCase() + key.slice(1)} Integration`, type: key, config: "{}" }); setShowAdd(true); }}
              className="flex flex-col items-center gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group">
              <span className="text-xl">{val.icon}</span>
              <span className="text-[12px] font-medium text-[#a1a1aa] group-hover:text-indigo-400 capitalize">{key}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-[#12121a] rounded-xl border border-white/[0.08] w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#e4e4e7] mb-4">Add Integration</h3>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Integration name" className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-indigo-500/50" />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] focus:outline-none focus:border-indigo-500/50">
                {Object.entries(integrationTypes).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {key.charAt(0).toUpperCase() + key.slice(1)} — {val.desc}</option>
                ))}
              </select>
              <div>
                <label className="text-[11px] text-[#71717a] mb-1 block">Configuration (JSON)</label>
                <textarea value={form.config} onChange={e => setForm({ ...form, config: e.target.value })} rows={4} className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] font-mono focus:outline-none focus:border-indigo-500/50 resize-none" />
                <p className="text-[10px] text-[#71717a] mt-1">
                  {form.type === "slack" && '{"webhook_url": "https://hooks.slack.com/services/..."}'}
                  {form.type === "jira" && '{"url": "https://your-domain.atlassian.net", "project_key": "SEC", "email": "...", "api_token": "..."}'}
                  {form.type === "webhook" && '{"url": "https://your-server.com/webhook", "method": "POST"}'}
                  {form.type === "pagerduty" && '{"routing_key": "...", "severity": "critical"}'}
                  {form.type === "email" && '{"smtp_host": "smtp.gmail.com", "smtp_port": 587, "to": "security@company.com"}'}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-[13px] text-[#a1a1aa] hover:text-[#e4e4e7] transition-colors">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all">Add Integration</button>
            </div>
          </div>
        </div>
      )}

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integ) => {
          const t = integrationTypes[integ.type] || { icon: "🔌", color: "text-gray-400", desc: "Custom integration" };
          return (
            <div key={integ.id} className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.1] transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-white/[0.04] text-lg">{t.icon}</div>
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-semibold text-[#e4e4e7] truncate">{integ.name}</h4>
                    <p className="text-[11px] text-[#71717a] capitalize">{integ.type}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 text-[10px] ${integ.enabled ? 'text-green-400' : 'text-[#71717a]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${integ.enabled ? 'bg-green-500' : 'bg-[#71717a]'}`} />
                  {integ.enabled ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="text-[12px] text-[#71717a] mb-3">{t.desc}</p>
              {integ.last_triggered_at && (
                <p className="text-[11px] text-[#71717a] mb-3">Last triggered: {new Date(integ.last_triggered_at).toLocaleString()}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#71717a]">Added {new Date(integ.created_at).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <button onClick={() => handleTest(integ.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 transition-all">
                        <Zap className="w-3 h-3" /> Test
                      </button>
                      <button onClick={() => handleDelete(integ.id, integ.name)} className="p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {integrations.length === 0 && (
          <div className="col-span-full">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4"><Puzzle className="w-6 h-6 text-[#71717a]" /></div>
              <p className="text-[14px] font-medium text-[#a1a1aa] mb-1">No integrations configured</p>
              <p className="text-[12px] text-[#71717a] max-w-sm mb-4">Connect Slack, Jira, PagerDuty or webhooks to streamline your security workflow</p>
              {isAdmin && (
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20">
                  <Plus className="w-3.5 h-3.5" /> Add Your First Integration
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Panel ──────────────────────────────────────────────────────────

function SettingsPanel({ addToast, authFetch, isAdmin }: { addToast: (msg: string, type: Toast["type"]) => void; authFetch: (url: string, options?: RequestInit) => Promise<Response>; isAdmin: boolean }) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Custom provider state
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customModels, setCustomModels] = useState("mimo-v2.5-pro");
  const [customProviderSaved, setCustomProviderSaved] = useState(false);
  const [customProviderStatus, setCustomProviderStatus] = useState({ base_url: "", api_key_set: false, models: [] as string[] });
  const [savingCustom, setSavingCustom] = useState(false);
  const [showCustomKey, setShowCustomKey] = useState(false);

  const providers = [
    { key: "GOOGLE_API_KEY", name: "Google (Gemini)", icon: "🔮" },
    { key: "OPENAI_API_KEY", name: "OpenAI (GPT-4)", icon: "🤖" },
    { key: "ANTHROPIC_API_KEY", name: "Anthropic (Claude)", icon: "🧠" },
    { key: "GROQ_API_KEY", name: "Groq (Llama)", icon: "⚡" },
    { key: "MISTRAL_API_KEY", name: "Mistral", icon: "💨" },
  ];

  const githubProvider = { key: "GITHUB_TOKEN", name: "GitHub Token", icon: "🐙" };

  useEffect(() => {
    authFetch(`${API_URL}/api/settings/api-keys`)
      .then((res) => res.json())
      .then(setKeyStatus)
      .catch(console.error);
    // Fetch custom provider settings
    authFetch(`${API_URL}/api/settings/custom-provider`)
      .then((res) => res.json())
      .then((data) => {
        setCustomProviderStatus(data);
        if (data.base_url) setCustomBaseUrl(data.base_url);
        if (data.models?.length) setCustomModels(data.models.join(","));
      })
      .catch(console.error);
  }, []);

  const saveKey = async (provider: string) => {
    const key = keys[provider];
    if (!key?.trim()) {
      addToast("Please enter an API key", "error");
      return;
    }
    setSaving(provider);
    try {
      const res = await authFetch(`${API_URL}/api/settings/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key: key.trim() }),
      });
      if (res.ok) {
        addToast(`${provider} saved successfully`, "success");
        setSavedKeys((prev) => new Set(prev).add(provider));
        setKeyStatus((prev) => ({ ...prev, [provider]: true }));
        setKeys((prev) => ({ ...prev, [provider]: "" }));
      } else {
        addToast("Failed to save API key", "error");
      }
    } catch {
      addToast("Failed to save — is the backend running?", "error");
    } finally {
      setSaving(null);
    }
  };

  const toggleShow = (provider: string) => {
    setShowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  const renderKeyRow = (provider: { key: string; name: string; icon: string }) => {
    const isConfigured = keyStatus[provider.key];
    const isShowing = showKeys.has(provider.key);

    return (
      <div key={provider.key} className="flex items-center gap-3 py-2">
        <span className="text-base">{provider.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[13px] text-[#e4e4e7] font-medium">{provider.name}</p>
            <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? "bg-green-500" : "bg-gray-600"}`} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type={isShowing ? "text" : "password"}
              value={keys[provider.key] || ""}
              onChange={(e) => setKeys((prev) => ({ ...prev, [provider.key]: e.target.value }))}
              placeholder={isConfigured ? "Key configured — enter new key to replace" : "Enter API key..."}
              className="flex-1 px-3 py-1.5 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[12px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
            <button
              onClick={() => toggleShow(provider.key)}
              className="p-1.5 rounded text-[#71717a] hover:text-[#a1a1aa] hover:bg-white/[0.04] transition-all"
              title={isShowing ? "Hide" : "Show"}
            >
              {isShowing ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => saveKey(provider.key)}
              disabled={saving === provider.key || !keys[provider.key]?.trim()}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
            >
              {saving === provider.key ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-[#e4e4e7]">Settings</h3>
        <p className="text-[12px] text-[#71717a] mt-0.5">Configure your Strix Pro instance</p>
      </div>

      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h4 className="text-[13px] font-semibold text-[#e4e4e7]">AI API Keys</h4>
          <p className="text-[11px] text-[#71717a] mt-0.5">Configure provider API keys for AI-powered features</p>
        </div>
        <div className="p-5 space-y-1 divide-y divide-white/[0.04]">
          {providers.map(renderKeyRow)}
        </div>
      </div>

      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h4 className="text-[13px] font-semibold text-[#e4e4e7]">GitHub Token</h4>
          <p className="text-[11px] text-[#71717a] mt-0.5">For GitHub integration features</p>
        </div>
        <div className="p-5">{renderKeyRow(githubProvider)}</div>
      </div>

      {/* Custom AI Provider (e.g. Xiaomi, DeepSeek) */}
      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-semibold text-[#e4e4e7]">Custom AI Provider</h4>
            {customProviderStatus.api_key_set && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            )}
          </div>
          <p className="text-[11px] text-[#71717a] mt-0.5">OpenAI-compatible API (Xiaomi, DeepSeek, etc.)</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">Base URL</label>
            <input
              type="text"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">API Key</label>
            <div className="flex items-center gap-2">
              <input
                type={showCustomKey ? "text" : "password"}
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder={customProviderStatus.api_key_set ? "Key configured — enter new key to replace" : "Enter API key..."}
                className="flex-1 px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
              <button
                onClick={() => setShowCustomKey(!showCustomKey)}
                className="p-2 rounded text-[#71717a] hover:text-[#a1a1aa] hover:bg-white/[0.04] transition-all"
              >
                {showCustomKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#a1a1aa] mb-1.5">Models (comma-separated)</label>
            <input
              type="text"
              value={customModels}
              onChange={(e) => setCustomModels(e.target.value)}
              placeholder="mimo-v2.5-pro, mimo-v2-flash"
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-white/[0.06] rounded-md text-[13px] text-[#e4e4e7] placeholder-[#71717a] font-mono focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <button
            onClick={async () => {
              if (!customBaseUrl.trim() || !customApiKey.trim()) {
                addToast("Base URL and API Key are required", "error");
                return;
              }
              setSavingCustom(true);
              try {
                const res = await authFetch(`${API_URL}/api/settings/custom-provider`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ base_url: customBaseUrl, api_key: customApiKey, models: customModels }),
                });
                if (res.ok) {
                  const data = await res.json();
                  addToast("Custom provider configured! Models: " + data.models?.join(", "), "success");
                  setCustomProviderSaved(true);
                  setCustomApiKey("");
                  // Refresh status
                  const statusRes = await authFetch(`${API_URL}/api/settings/custom-provider`);
                  if (statusRes.ok) setCustomProviderStatus(await statusRes.json());
                } else {
                  addToast("Failed to save custom provider", "error");
                }
              } catch {
                addToast("Failed to save — is the backend running?", "error");
              } finally {
                setSavingCustom(false);
              }
            }}
            disabled={savingCustom || !customBaseUrl.trim() || !customApiKey.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
          >
            {savingCustom ? "Saving..." : "Save Custom Provider"}
          </button>
          {customProviderStatus.api_key_set && (
            <div className="flex items-center gap-2 text-[12px] text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Provider configured: {customProviderStatus.base_url}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tool Manager (Admin Only) */}
      {isAdmin && <ToolManager authFetch={authFetch} addToast={addToast} />}

      <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h4 className="text-[13px] font-semibold text-[#e4e4e7]">About</h4>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#e4e4e7]">Strix Pro v1.0.0</p>
              <p className="text-[11px] text-[#71717a]">AI-Powered Security Platform</p>
            </div>
          </div>
          <p className="text-[12px] text-[#71717a] leading-relaxed">
            Based on Strix Open Source (MIT License). Advanced penetration testing and vulnerability management platform powered by AI.
          </p>
        </div>
      </div>

      {/* User Management (Admin Only) */}
      {isAdmin && <UserManagement authFetch={authFetch} addToast={addToast} />}
    </div>
  );
}

// ─── Tool Manager Component ──────────────────────────────────────────────────

function ToolManager({ authFetch, addToast }: { authFetch: (url: string, options?: RequestInit) => Promise<Response>; addToast: (msg: string, type: Toast["type"]) => void }) {
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<Set<string>>(new Set());
  const [installingAll, setInstallingAll] = useState(false);

  const fetchTools = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/tools/status`);
      if (res.ok) setTools(await res.json());
    } catch { } finally { setLoading(false); }
  };
  useEffect(() => { fetchTools(); }, []);

  const handleInstall = async (toolId: string) => {
    setInstalling(prev => new Set(prev).add(toolId));
    try {
      const res = await authFetch(`${API_URL}/api/tools/${toolId}/install`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        addToast(`${toolId} installed successfully!`, "success");
        fetchTools();
      } else {
        addToast(`Failed to install ${toolId}: ${data.message}`, "error");
      }
    } catch { addToast(`Failed to install ${toolId}`, "error"); }
    finally { setInstalling(prev => { const s = new Set(prev); s.delete(toolId); return s; }); }
  };

  const handleInstallAll = async () => {
    setInstallingAll(true);
    try {
      const res = await authFetch(`${API_URL}/api/tools/install-all`, { method: "POST" });
      const data = await res.json();
      const installed = data.results?.filter((r: any) => r.success && !r.skipped).length || 0;
      const skipped = data.results?.filter((r: any) => r.skipped).length || 0;
      const failed = data.results?.filter((r: any) => !r.success).length || 0;
      addToast(`Tools: ${installed} installed, ${skipped} already ok, ${failed} failed`, failed > 0 ? "error" : "success");
      fetchTools();
    } catch { addToast("Failed to install tools", "error"); }
    finally { setInstallingAll(false); }
  };

  if (loading) return null;

  const installedCount = tools.filter(t => t.installed).length;
  const missingCount = tools.filter(t => !t.installed).length;

  return (
    <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h4 className="text-[13px] font-semibold text-[#e4e4e7]">🔧 Tool Manager</h4>
          <p className="text-[11px] text-[#71717a] mt-0.5">{installedCount}/{tools.length} tools installed · Install & update security tools at runtime</p>
        </div>
        {missingCount > 0 && (
          <button
            onClick={handleInstallAll}
            disabled={installingAll}
            className="flex items-center gap-2 px-3.5 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md text-[12px] font-medium hover:bg-green-500/20 transition-all disabled:opacity-50"
          >
            {installingAll ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Installing...</> : <><Wrench className="w-3.5 h-3.5" /> Install All Missing</>}
          </button>
        )}
      </div>
      <div className="divide-y divide-white/[0.03]">
        {tools.map((tool) => {
          const isInstalling = installing.has(tool.id);
          return (
            <div key={tool.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
              <div className={`w-2 h-2 rounded-full shrink-0 ${tool.installed ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#e4e4e7]">{tool.name}</span>
                  <span className="text-[10px] text-[#71717a] bg-white/[0.04] px-1.5 py-0.5 rounded">{tool.repo}</span>
                </div>
                <p className="text-[11px] text-[#71717a] truncate">{tool.description}</p>
              </div>
              <div className="text-right shrink-0">
                {tool.installed ? (
                  <span className="text-[11px] text-green-400 font-mono">{tool.version.split('\n')[0]}</span>
                ) : (
                  <span className="text-[11px] text-red-400">Not installed</span>
                )}
              </div>
              <button
                onClick={() => handleInstall(tool.id)}
                disabled={isInstalling}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all shrink-0 ${
                  tool.installed
                    ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20'
                    : 'text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20'
                } disabled:opacity-50`}
              >
                {isInstalling ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Installing...</>
                ) : tool.installed ? (
                  <><RefreshCw className="w-3 h-3" /> Update</>
                ) : (
                  <><Wrench className="w-3 h-3" /> Install</>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]">
        <p className="text-[10px] text-[#71717a]">
          💡 Tools are installed at runtime into the Docker container. After container rebuild, use "Install All Missing" to restore all tools. GitHub downloads run from the container network, not Docker build.
        </p>
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "scan-running",
    completed: "scan-completed",
    failed: "scan-failed",
    pending: "scan-pending",
    cancelled: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${styles[status] || "bg-white/[0.04] text-[#71717a]"}`}>
      {status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium severity-${severity}`}>
      {severity?.toUpperCase()}
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
    info: "bg-blue-500",
  };

  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[severity] || "bg-gray-500"}`} />;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    default:
      return <Clock className="w-4 h-4 text-yellow-400 shrink-0" />;
  }
}

function EmptyState({ icon: Icon, message, submessage }: { icon: any; message: string; submessage?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <Icon className="w-5 h-5 text-[#71717a] mb-2" />
      <p className="text-[13px] text-[#71717a]">{message}</p>
      {submessage && <p className="text-[11px] text-[#71717a]/60 mt-0.5">{submessage}</p>}
    </div>
  );
}

function EmptyStateLarge({
  icon: Icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: any;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-4">
        <Icon className="w-6 h-6 text-[#71717a]" />
      </div>
      <p className="text-[14px] font-medium text-[#a1a1aa] mb-1">{title}</p>
      <p className="text-[12px] text-[#71717a] max-w-sm mb-4">{message}</p>
      {action && onAction && (
        <button onClick={onAction} className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20">
          <Plus className="w-3.5 h-3.5" />
          {action}
        </button>
      )}
    </div>
  );
}

function UserManagement({ authFetch, addToast }: { authFetch: (url: string, opts?: RequestInit) => Promise<Response>; addToast: (msg: string, type: Toast["type"]) => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${API_URL}/api/auth/users`)
      .then((res) => res.json())
      .then(setUsers)
      .catch(() => addToast("Failed to load users", "error"))
      .finally(() => setLoading(false));
  }, []);

  const changeRole = async (userId: number, role: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/auth/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
        addToast("Role updated", "success");
      } else {
        addToast("Failed to update role", "error");
      }
    } catch {
      addToast("Failed to update role", "error");
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      const res = await authFetch(`${API_URL}/api/auth/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        addToast("User deleted", "success");
      } else {
        addToast("Failed to delete user", "error");
      }
    } catch {
      addToast("Failed to delete user", "error");
    }
  };

  if (loading) return <div className="skeleton h-48 rounded-lg" />;

  return (
    <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <h4 className="text-[13px] font-semibold text-[#e4e4e7]">User Management</h4>
        </div>
        <p className="text-[11px] text-[#71717a] mt-0.5">Manage user accounts and roles</p>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-semibold text-white">
                {(u.name || u.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#e4e4e7]">{u.name || "—"}</p>
                <p className="text-[11px] text-[#71717a]">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={u.role}
                onChange={(e) => changeRole(u.id, e.target.value)}
                className="text-[11px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[#a1a1aa] focus:outline-none focus:border-indigo-500/50"
              >
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => deleteUser(u.id)}
                className="p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Delete user"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="py-8 text-center text-[13px] text-[#71717a]">No users found</div>}
      </div>
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons: Record<string, any> = {
    success: CheckCircle2,
    error: XCircle,
    info: Bell,
  };
  const colors: Record<string, string> = {
    success: "border-green-500/20 bg-green-500/5",
    error: "border-red-500/20 bg-red-500/5",
    info: "border-white/[0.06] bg-[#12121a]",
  };
  const iconColors: Record<string, string> = {
    success: "text-green-400",
    error: "text-red-400",
    info: "text-indigo-400",
  };

  const Icon = icons[toast.type] || Bell;

  return (
    <div className={`toast-enter flex items-center gap-3 px-4 py-3 rounded-lg border ${colors[toast.type]} shadow-xl min-w-[280px]`}>
      <Icon className={`w-4 h-4 ${iconColors[toast.type]} shrink-0`} />
      <span className="text-[13px] text-[#e4e4e7] flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="text-[#71717a] hover:text-[#e4e4e7] transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
