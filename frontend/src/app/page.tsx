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
  is_fixed: boolean;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function Dashboard() {
  const router = useRouter();
  const { user, token, logout, isAuthenticated, canEdit, canScan, canChat, isAdmin, hasRole, authFetch } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [showScanModal, setShowScanModal] = useState<{ targetId: number; targetName: string } | null>(null);
  const [scanDetail, setScanDetail] = useState<Scan | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const [statsRes, targetsRes, scansRes, vulnsRes] = await Promise.all([
        authFetch(`${API_URL}/api/dashboard/stats`),
        authFetch(`${API_URL}/api/targets`),
        authFetch(`${API_URL}/api/scans?limit=10`),
        authFetch(`${API_URL}/api/vulnerabilities?limit=10`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (targetsRes.ok) setTargets(await targetsRes.json());
      if (scansRes.ok) setScans(await scansRes.json());
      if (vulnsRes.ok) setVulns(await vulnsRes.json());

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
      const res = await authFetch(`${API_URL}/api/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId, scan_type: scanType }),
      });
      if (res.status === 403) {
        addToast("Insufficient permissions", "error");
      } else if (res.ok) {
        fetchData();
        setShowScanModal(null);
        addToast(`${scanType} scan started`, "success");
      } else {
        addToast("Failed to start scan", "error");
      }
    } catch (error) {
      addToast("Failed to start scan", "error");
    }
  };

  const tabLabels: Record<string, string> = {
    dashboard: "Overview",
    targets: "Targets",
    scans: "Scans",
    vulns: "Vulnerabilities",
    chat: "AI Assistant",
    tools: "Tools",
    settings: "Settings",
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex min-h-screen">
        <aside className="w-64 bg-[#0e0e15] border-r border-white/[0.06] p-4">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="skeleton w-9 h-9 rounded-lg" />
            <div className="skeleton w-24 h-5" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton w-full h-9 rounded-md" />
            ))}
          </div>
        </aside>
        <main className="flex-1 p-6">
          <div className="skeleton w-48 h-8 mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-32 rounded-lg" />
            ))}
          </div>
          <div className="skeleton h-64 rounded-lg mb-6" />
          <div className="skeleton h-48 rounded-lg" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen relative">
      {/* Sidebar */}
      <aside className="w-[260px] bg-[#0e0e15] border-r border-white/[0.06] flex flex-col shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[#e4e4e7] tracking-tight">Strix Pro</h1>
            <p className="text-[10px] text-[#71717a] tracking-wide uppercase">Security Platform</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {([
            { id: "dashboard", icon: BarChart3, label: "Overview" },
            { id: "targets", icon: Target, label: "Targets" },
            { id: "scans", icon: Search, label: "Scans" },
            { id: "vulns", icon: Bug, label: "Vulnerabilities" },
            ...(canChat ? [{ id: "chat", icon: Sparkles, label: "AI Assistant" }] : []),
            { id: "tools", icon: Zap, label: "Tools" },
            ...(isAdmin ? [{ id: "settings", icon: Settings, label: "Settings" }] : []),
          ] as { id: string; icon: any; label: string }[]).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-200 group ${
                activeTab === item.id
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-white/[0.04]"
              }`}
            >
              <item.icon className={`w-4 h-4 ${
                activeTab === item.id ? "text-indigo-400" : "text-[#71717a] group-hover:text-[#a1a1aa]"
              }`} />
              <span>{item.label}</span>
              {activeTab === item.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-white/[0.06]">
          {/* Role badge */}
          <div className="px-3 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
              user?.role === "admin"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : user?.role === "developer"
                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                : "bg-[#71717a]/10 text-[#a1a1aa] border border-white/[0.06]"
            }`}>
              {user?.role === "admin" && <Crown className="w-3 h-3" />}
              {user?.role}
            </span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-semibold text-white">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#e4e4e7] truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-[#71717a] truncate">{user?.email || ""}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded text-[#71717a] hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[#e4e4e7] tracking-tight">{tabLabels[activeTab]}</h2>
            {stats?.scans.running ? (
              <span className="flex items-center gap-1.5 text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
                </span>
                {stats.scans.running} running
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {/* Search bar */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[#71717a] text-[13px] hover:border-white/[0.1] transition-colors cursor-pointer min-w-[200px]">
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1">Search...</span>
              <kbd className="text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded text-[#71717a]">⌘K</kbd>
            </div>

            <button
              onClick={() => { fetchData(); addToast("Data refreshed", "info"); }}
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

        {/* Content */}
        <div className="p-6 animate-fade-in">
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Getting Started Guide - shown when no targets */}
              {targets.length === 0 && (
                <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-6">
                  <h3 className="text-sm font-semibold text-[#e4e4e7] mb-4">Getting Started</h3>
                  <div className="flex items-stretch gap-0">
                    {[
                      { step: 1, title: "Add a Target", desc: "Add a domain, IP, or URL to monitor" },
                      { step: 2, title: "Run a Scan", desc: "Choose from port scan, subdomain, web scan, or vulnerability scan" },
                      { step: 3, title: "Review Results", desc: "View vulnerabilities, get AI analysis, and generate reports" },
                    ].map((s, i) => (
                      <div key={s.step} className="flex items-center flex-1">
                        <div className="flex flex-col items-center text-center flex-1 px-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[13px] font-bold text-indigo-400 mb-2">
                            {s.step}
                          </div>
                          <p className="text-[13px] font-semibold text-[#e4e4e7] mb-0.5">{s.title}</p>
                          <p className="text-[11px] text-[#71717a] leading-snug max-w-[180px]">{s.desc}</p>
                        </div>
                        {i < 2 && (
                          <ChevronRight className="w-4 h-4 text-[#71717a]/40 shrink-0 -mx-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  icon={Target}
                  title="Targets"
                  value={stats?.targets || 0}
                  subtitle="Monitored endpoints"
                  color="indigo"
                  trend={null}
                />
                <StatsCard
                  icon={Search}
                  title="Total Scans"
                  value={stats?.scans.total || 0}
                  subtitle={`${stats?.scans.running || 0} running`}
                  color="blue"
                  trend={stats?.scans.completed ? { value: stats.scans.completed, label: "completed" } : null}
                />
                <StatsCard
                  icon={Bug}
                  title="Vulnerabilities"
                  value={stats?.vulnerabilities.total || 0}
                  subtitle={`${stats?.vulnerabilities.high || 0} high severity`}
                  color="orange"
                  trend={null}
                />
                <StatsCard
                  icon={AlertTriangle}
                  title="Critical Issues"
                  value={stats?.vulnerabilities.critical || 0}
                  subtitle="Immediate attention"
                  color="red"
                  trend={null}
                />
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Scans */}
                <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <h3 className="text-[13px] font-semibold text-[#e4e4e7] tracking-tight">Recent Scans</h3>
                    <button
                      onClick={() => setActiveTab("scans")}
                      className="text-[12px] text-[#71717a] hover:text-indigo-400 transition-colors flex items-center gap-1"
                    >
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {scans.slice(0, 5).map((scan) => (
                      <ScanRow key={scan.id} scan={scan} onClick={() => setScanDetail(scan)} />
                    ))}
                    {scans.length === 0 && (
                      <EmptyState
                        icon={Search}
                        message="No scans yet"
                        submessage="Add a target and run your first scan"
                      />
                    )}
                  </div>
                </div>

                {/* Recent Vulnerabilities */}
                <div className="bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <h3 className="text-[13px] font-semibold text-[#e4e4e7] tracking-tight">Recent Vulnerabilities</h3>
                    <button
                      onClick={() => setActiveTab("vulns")}
                      className="text-[12px] text-[#71717a] hover:text-indigo-400 transition-colors flex items-center gap-1"
                    >
                      View all <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {vulns.slice(0, 5).map((vuln) => (
                      <VulnRow key={vuln.id} vuln={vuln} />
                    ))}
                    {vulns.length === 0 && (
                      <EmptyState
                        icon={Lock}
                        message="No vulnerabilities found"
                        submessage="Your systems look clean"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Targets Tab */}
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {targets.map((target, i) => (
                  <TargetCard
                    key={target.id}
                    target={target}
                    onScan={(id) => setShowScanModal({ targetId: id, targetName: target.name })}
                    index={i}
                    canScan={canScan}
                  />
                ))}
                {targets.length === 0 && (
                  <div className="col-span-full">
                    <EmptyStateLarge
                      icon={Target}
                      title="No targets configured"
                      message="Add your first target to begin security reconnaissance"
                      action="Add Target"
                      onAction={() => setShowAddTarget(true)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scans Tab */}
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
                        <td className="px-5 py-3 text-[13px] text-[#71717a]">
                          {scan.duration ? `${scan.duration}s` : "—"}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setScanDetail(scan)}
                            className="text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {scans.length === 0 && (
                  <EmptyStateLarge
                    icon={Search}
                    title="No scans yet"
                    message="Scans will appear here once you start scanning your targets"
                  />
                )}
              </div>
            </div>
          )}

          {/* Vulnerabilities Tab */}
          {activeTab === "vulns" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#e4e4e7]">Vulnerabilities</h3>
                <p className="text-[12px] text-[#71717a] mt-0.5">{vulns.length} vulnerabilities detected</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vulns.map((vuln, i) => (
                  <VulnCard key={vuln.id} vuln={vuln} index={i} />
                ))}
                {vulns.length === 0 && (
                  <div className="col-span-full">
                    <EmptyStateLarge
                      icon={Lock}
                      title="No vulnerabilities detected"
                      message="Run vulnerability scans on your targets to identify security issues"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Chat Tab */}
          {activeTab === "chat" && <AIChat addToast={addToast} authFetch={authFetch} />}

          {/* Tools Tab */}
          {activeTab === "tools" && <ToolsList />}

          {/* Settings Tab */}
          {activeTab === "settings" && <SettingsPanel addToast={addToast} authFetch={authFetch} isAdmin={isAdmin} />}
        </div>
      </main>

      {/* Add Target Modal */}
      {showAddTarget && (
        <AddTargetModal
          onClose={() => setShowAddTarget(false)}
          onSubmit={addTarget}
        />
      )}

      {/* Scan Modal */}
      {showScanModal && (
        <ScanModal
          targetName={showScanModal.targetName}
          onClose={() => setShowScanModal(null)}
          onStart={(type) => startScan(showScanModal.targetId, type)}
        />
      )}

      {/* Scan Detail Modal */}
      {scanDetail && (
        <ScanDetailModal scan={scanDetail} onClose={() => setScanDetail(null)} />
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} />
        ))}
      </div>
    </div>
  );
}

// ─── Stats Card ────────────────────────────────────────────────────────────────

function StatsCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
  trend,
}: {
  icon: any;
  title: string;
  value: number;
  subtitle: string;
  color: string;
  trend: { value: number; label: string } | null;
}) {
  const colorMap: Record<string, { bg: string; text: string; icon: string; glow: string }> = {
    indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", icon: "text-indigo-400", glow: "shadow-indigo-500/5" },
    blue: { bg: "bg-blue-500/10", text: "text-blue-400", icon: "text-blue-400", glow: "shadow-blue-500/5" },
    orange: { bg: "bg-orange-500/10", text: "text-orange-400", icon: "text-orange-400", glow: "shadow-orange-500/5" },
    red: { bg: "bg-red-500/10", text: "text-red-400", icon: "text-red-400", glow: "shadow-red-500/5" },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.1] hover:scale-[1.01] transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 rounded-md ${c.bg}`}>
          <Icon className={`w-4 h-4 ${c.icon}`} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
            <TrendingUp className="w-3 h-3" />
            {trend.value}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-[#e4e4e7] tracking-tight mb-1">{value.toLocaleString()}</div>
      <div className="text-[12px] text-[#71717a]">{subtitle}</div>
    </div>
  );
}

// ─── Scan Row ──────────────────────────────────────────────────────────────────

function ScanRow({ scan, onClick }: { scan: Scan; onClick: () => void }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
      onClick={onClick}
    >
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
        {scan.duration && (
          <span className="text-[11px] text-[#71717a]">{scan.duration}s</span>
        )}
        <StatusBadge status={scan.status} />
      </div>
    </div>
  );
}

// ─── Vuln Row ──────────────────────────────────────────────────────────────────

function VulnRow({ vuln }: { vuln: Vulnerability }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <SeverityDot severity={vuln.severity} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#e4e4e7] truncate">{vuln.title}</p>
          <p className="text-[11px] text-[#71717a] truncate">
            {vuln.cve_id || "No CVE"} · {vuln.affected_component || "Unknown"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {vuln.is_fixed && (
          <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">Fixed</span>
        )}
        <SeverityBadge severity={vuln.severity} />
      </div>
    </div>
  );
}

// ─── Target Card ───────────────────────────────────────────────────────────────

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
        <span className="text-[10px] text-[#71717a] bg-white/[0.04] px-1.5 py-0.5 rounded uppercase tracking-wider">
          {target.type}
        </span>
      </div>

      <p className="text-[12px] text-[#71717a] mb-4 line-clamp-2">
        {target.description || "No description provided"}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#71717a]">
          Added {new Date(target.created_at).toLocaleDateString()}
        </span>
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

// ─── Vuln Card ─────────────────────────────────────────────────────────────────

function VulnCard({ vuln, index }: { vuln: Vulnerability; index: number }) {
  const severityColors: Record<string, string> = {
    critical: "border-l-red-500",
    high: "border-l-orange-500",
    medium: "border-l-yellow-500",
    low: "border-l-green-500",
    info: "border-l-blue-500",
  };

  return (
    <div
      className={`bg-[#12121a] rounded-lg border border-white/[0.06] border-l-2 ${severityColors[vuln.severity] || "border-l-gray-500"} p-5 hover:border-white/[0.1] hover:scale-[1.01] transition-all duration-200`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <SeverityBadge severity={vuln.severity} />
        {vuln.cve_id && (
          <span className="text-[10px] font-mono text-[#71717a] bg-white/[0.04] px-1.5 py-0.5 rounded">
            {vuln.cve_id}
          </span>
        )}
      </div>
      <h4 className="text-[13px] font-semibold text-[#e4e4e7] mb-2 line-clamp-2">{vuln.title}</h4>
      <p className="text-[12px] text-[#71717a] mb-3">
        {vuln.affected_component || "Unknown component"}
      </p>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] ${vuln.is_fixed ? "text-green-400" : "text-red-400"}`}>
          {vuln.is_fixed ? "● Fixed" : "● Open"}
        </span>
      </div>
    </div>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────────

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
      <div
        className="bg-[#12121a] rounded-lg border border-white/[0.06] w-full max-w-md mx-4 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
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
                    type === t.value
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                      : "bg-white/[0.02] border-white/[0.06] text-[#71717a] hover:border-white/[0.1]"
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
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-md text-[13px] font-medium text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-white/[0.04] transition-all"
          >
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
    { id: "port_scan", label: "Port Scan", desc: "Discover open ports and services", icon: Wifi, color: "text-blue-400" },
    { id: "subdomain", label: "Subdomain Scan", desc: "Enumerate subdomains", icon: Globe, color: "text-purple-400" },
    { id: "web_scan", label: "Web Scan", desc: "Analyze web application", icon: Eye, color: "text-green-400" },
    { id: "vulnerability", label: "Vulnerability Scan", desc: "Detect known vulnerabilities", icon: Bug, color: "text-red-400" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div
        className="bg-[#12121a] rounded-lg border border-white/[0.06] w-full max-w-md mx-4 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
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
                selected === st.id
                  ? "bg-indigo-500/10 border-indigo-500/30"
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]"
              }`}
            >
              <div className={`p-1.5 rounded-md ${selected === st.id ? "bg-indigo-500/20" : "bg-white/[0.04]"}`}>
                <st.icon className={`w-4 h-4 ${selected === st.id ? "text-indigo-400" : st.color}`} />
              </div>
              <div className="flex-1">
                <p className={`text-[13px] font-medium ${selected === st.id ? "text-indigo-400" : "text-[#e4e4e7]"}`}>{st.label}</p>
                <p className="text-[11px] text-[#71717a]">{st.desc}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                selected === st.id ? "border-indigo-400" : "border-white/20"
              }`}>
                {selected === st.id && <div className="w-2 h-2 rounded-full bg-indigo-400" />}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-md text-[13px] font-medium text-[#a1a1aa] hover:text-[#e4e4e7] hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(selected)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md text-[13px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
          >
            <Play className="w-3.5 h-3.5" />
            Start Scan
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanDetailModal({ scan, onClose }: { scan: Scan; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onClick={onClose}>
      <div
        className="bg-[#12121a] rounded-lg border border-white/[0.06] w-full max-w-lg mx-4 shadow-2xl animate-slide-up max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
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
              <pre className="bg-[#0a0a0f] rounded-lg p-4 text-[12px] text-[#a1a1aa] font-mono overflow-auto max-h-48 border border-white/[0.04]">
                {scan.output}
              </pre>
            </div>
          )}

          {scan.ai_summary && (
            <div>
              <p className="text-[11px] text-[#71717a] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> AI Summary
              </p>
              <div className="bg-indigo-500/5 rounded-lg p-4 text-[13px] text-[#e4e4e7] leading-relaxed border border-indigo-500/10">
                {scan.ai_summary}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Chat ───────────────────────────────────────────────────────────────────

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
    <div className="flex flex-col h-[calc(100vh-120px)] bg-[#12121a] rounded-lg border border-white/[0.06] overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-[13px] font-semibold text-[#e4e4e7]">AI Security Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="text-[11px] bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[#a1a1aa] focus:outline-none focus:border-indigo-500/50"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
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
      <div className="p-4 border-t border-white/[0.06]">
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

// ─── Tools List ────────────────────────────────────────────────────────────────

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
          <div
            key={tool.name}
            className="bg-[#12121a] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.1] hover:scale-[1.01] transition-all duration-200 group"
          >
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
            <p className="text-[12px] text-[#71717a] mb-3 line-clamp-2">
              {tool.description || "Security tool"}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#71717a] bg-white/[0.04] px-1.5 py-0.5 rounded uppercase tracking-wider">
                {tool.category || "general"}
              </span>
              {tool.dangerous && (
                <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                  Dangerous
                </span>
              )}
            </div>
          </div>
        ))}
        {tools.length === 0 && (
          <div className="col-span-full">
            <EmptyStateLarge
              icon={Zap}
              title="No tools found"
              message="Security tools will appear here once configured"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Panel ────────────────────────────────────────────────────────────

function SettingsPanel({ addToast, authFetch, isAdmin }: { addToast: (msg: string, type: Toast["type"]) => void; authFetch: (url: string, options?: RequestInit) => Promise<Response>; isAdmin: boolean }) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

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
    const isSaved = savedKeys.has(provider.key);

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
        <div className="p-5">
          {renderKeyRow(githubProvider)}
        </div>
      </div>

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

// ─── Shared Components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "scan-running",
    completed: "scan-completed",
    failed: "scan-failed",
    pending: "scan-pending",
    cancelled: "bg-gray-500/10 text-gray-400 border border-gray-500/20",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${styles[status] || "bg-white/[0.04] text-[#71717a]"}`}>
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

  return (
    <span className={`w-2 h-2 rounded-full shrink-0 ${colors[severity] || "bg-gray-500"}`} />
  );
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

function EmptyState({
  icon: Icon,
  message,
  submessage,
}: {
  icon: any;
  message: string;
  submessage?: string;
}) {
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
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500 text-white rounded-md text-[13px] font-medium hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
        >
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
        {users.length === 0 && (
          <div className="py-8 text-center text-[13px] text-[#71717a]">No users found</div>
        )}
      </div>
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
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
