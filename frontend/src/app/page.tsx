"use client";

import { useState, useEffect } from "react";
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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Fetch data
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, targetsRes, scansRes, vulnsRes] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/stats`),
        fetch(`${API_URL}/api/targets`),
        fetch(`${API_URL}/api/scans?limit=10`),
        fetch(`${API_URL}/api/vulnerabilities?limit=10`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (targetsRes.ok) setTargets(await targetsRes.json());
      if (scansRes.ok) setScans(await scansRes.json());
      if (vulnsRes.ok) setVulns(await vulnsRes.json());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTarget = async () => {
    const name = prompt("Target name:");
    const host = prompt("Target host (IP or domain):");
    if (!name || !host) return;

    try {
      const res = await fetch(`${API_URL}/api/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, host, type: "domain" }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to add target:", error);
    }
  };

  const startScan = async (targetId: number, scanType: string) => {
    try {
      const res = await fetch(`${API_URL}/api/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId, scan_type: scanType }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to start scan:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border p-4">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-xl font-bold">Strix Pro</h1>
        </div>

        <nav className="space-y-2">
          {[
            { id: "dashboard", icon: BarChart3, label: "Dashboard" },
            { id: "targets", icon: Target, label: "Targets" },
            { id: "scans", icon: Search, label: "Scans" },
            { id: "vulns", icon: Bug, label: "Vulnerabilities" },
            { id: "chat", icon: Terminal, label: "AI Chat" },
            { id: "tools", icon: Zap, label: "Tools" },
            { id: "settings", icon: Settings, label: "Settings" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === item.id
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-secondary"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
            <p className="text-muted-foreground">
              AI-Powered Security Platform
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchData}
              className="p-2 rounded-lg hover:bg-secondary"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-secondary relative">
              <Bell className="w-5 h-5" />
              {stats?.scans.running ? (
                <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
              ) : null}
            </button>
          </div>
        </header>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                icon={Target}
                title="Targets"
                value={stats?.targets || 0}
                description="Monitored targets"
                color="text-blue-500"
              />
              <StatsCard
                icon={Search}
                title="Total Scans"
                value={stats?.scans.total || 0}
                description={`${stats?.scans.running || 0} running`}
                color="text-green-500"
              />
              <StatsCard
                icon={Bug}
                title="Vulnerabilities"
                value={stats?.vulnerabilities.total || 0}
                description={`${stats?.vulnerabilities.critical || 0} critical`}
                color="text-orange-500"
              />
              <StatsCard
                icon={AlertTriangle}
                title="Critical Issues"
                value={stats?.vulnerabilities.critical || 0}
                description="Immediate attention"
                color="text-red-500"
              />
            </div>

            {/* Recent Scans */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-lg font-semibold mb-4">Recent Scans</h3>
              <div className="space-y-3">
                {scans.slice(0, 5).map((scan) => (
                  <ScanItem key={scan.id} scan={scan} />
                ))}
                {scans.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No scans yet. Start by adding a target.
                  </p>
                )}
              </div>
            </div>

            {/* Recent Vulnerabilities */}
            <div className="bg-card rounded-lg border border-border p-4">
              <h3 className="text-lg font-semibold mb-4">
                Recent Vulnerabilities
              </h3>
              <div className="space-y-3">
                {vulns.slice(0, 5).map((vuln) => (
                  <VulnItem key={vuln.id} vuln={vuln} />
                ))}
                {vulns.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">
                    No vulnerabilities detected yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Targets Tab */}
        {activeTab === "targets" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Targets</h3>
              <button
                onClick={addTarget}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Add Target
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {targets.map((target) => (
                <TargetCard
                  key={target.id}
                  target={target}
                  onScan={startScan}
                />
              ))}
              {targets.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No targets added yet</p>
                  <button
                    onClick={addTarget}
                    className="mt-4 text-primary hover:underline"
                  >
                    Add your first target
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scans Tab */}
        {activeTab === "scans" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Scan History</h3>
            </div>

            <div className="bg-card rounded-lg border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4">ID</th>
                    <th className="text-left p-4">Type</th>
                    <th className="text-left p-4">Tool</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Duration</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan) => (
                    <tr key={scan.id} className="border-b border-border">
                      <td className="p-4">#{scan.id}</td>
                      <td className="p-4">{scan.scan_type}</td>
                      <td className="p-4">{scan.tool || "auto"}</td>
                      <td className="p-4">
                        <StatusBadge status={scan.status} />
                      </td>
                      <td className="p-4">
                        {scan.duration ? `${scan.duration}s` : "-"}
                      </td>
                      <td className="p-4">
                        <button className="text-primary hover:underline">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scans.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No scans yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vulnerabilities Tab */}
        {activeTab === "vulns" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Vulnerabilities</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vulns.map((vuln) => (
                <VulnCard key={vuln.id} vuln={vuln} />
              ))}
              {vulns.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No vulnerabilities detected</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Chat Tab */}
        {activeTab === "chat" && <AIChat />}

        {/* Tools Tab */}
        {activeTab === "tools" && <ToolsList />}

        {/* Settings Tab */}
        {activeTab === "settings" && <SettingsPanel />}
      </main>
    </div>
  );
}

// Components

function StatsCard({
  icon: Icon,
  title,
  value,
  description,
  color,
}: {
  icon: any;
  title: string;
  value: number;
  description: string;
  color: string;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg bg-secondary ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-3xl font-bold">{value}</span>
      </div>
      <h4 className="font-medium">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ScanItem({ scan }: { scan: Scan }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
      <div className="flex items-center gap-3">
        <StatusIcon status={scan.status} />
        <div>
          <p className="font-medium">{scan.scan_type}</p>
          <p className="text-sm text-muted-foreground">
            {scan.tool || "auto"} • {new Date(scan.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      <StatusBadge status={scan.status} />
    </div>
  );
}

function VulnItem({ vuln }: { vuln: Vulnerability }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
      <div className="flex items-center gap-3">
        <SeverityIcon severity={vuln.severity} />
        <div>
          <p className="font-medium">{vuln.title}</p>
          <p className="text-sm text-muted-foreground">
            {vuln.cve_id || "No CVE"} • {vuln.affected_component || "Unknown"}
          </p>
        </div>
      </div>
      <SeverityBadge severity={vuln.severity} />
    </div>
  );
}

function TargetCard({
  target,
  onScan,
}: {
  target: Target;
  onScan: (id: number, type: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            {target.type === "domain" ? (
              <Globe className="w-5 h-5 text-blue-500" />
            ) : (
              <Server className="w-5 h-5 text-green-500" />
            )}
          </div>
          <div>
            <h4 className="font-medium">{target.name}</h4>
            <p className="text-sm text-muted-foreground">{target.host}</p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-secondary"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  onScan(target.id, "port_scan");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-secondary"
              >
                Port Scan
              </button>
              <button
                onClick={() => {
                  onScan(target.id, "subdomain");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-secondary"
              >
                Subdomain Scan
              </button>
              <button
                onClick={() => {
                  onScan(target.id, "web_scan");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-secondary"
              >
                Web Scan
              </button>
              <button
                onClick={() => {
                  onScan(target.id, "vulnerability");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-secondary"
              >
                Vulnerability Scan
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {target.description || "No description"}
      </p>
      <p className="text-xs text-muted-foreground">
        Added {new Date(target.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}

function VulnCard({ vuln }: { vuln: Vulnerability }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-start justify-between mb-2">
        <SeverityBadge severity={vuln.severity} />
        {vuln.cve_id && (
          <span className="text-xs bg-secondary px-2 py-1 rounded">
            {vuln.cve_id}
          </span>
        )}
      </div>
      <h4 className="font-medium mb-2">{vuln.title}</h4>
      <p className="text-sm text-muted-foreground mb-4">
        {vuln.affected_component || "Unknown component"}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {vuln.is_fixed ? "✅ Fixed" : "⚠️ Open"}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "scan-running",
    completed: "scan-completed",
    failed: "scan-failed",
    pending: "scan-pending",
    cancelled: "bg-gray-500/20 text-gray-500",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs ${styles[status] || "bg-secondary"}`}>
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`px-2 py-1 rounded text-xs severity-${severity}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Clock className="w-5 h-5 text-yellow-500" />;
  }
}

function SeverityIcon({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "text-red-500",
    high: "text-orange-500",
    medium: "text-yellow-500",
    low: "text-blue-500",
    info: "text-gray-500",
  };

  return <AlertTriangle className={`w-5 h-5 ${colors[severity] || "text-gray-500"}`} />;
}

function AIChat() {
  const [messages, setMessages] = useState<
    { role: string; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
          provider: "gemini",
          model: "gemini-2.5-flash",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.response },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-message ${msg.role === "user" ? "user" : "assistant"}`}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {loading && (
          <div className="chat-message assistant">
            <div className="flex gap-1">
              <span className="typing-dot">•</span>
              <span className="typing-dot">•</span>
              <span className="typing-dot">•</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask Strix Pro anything about security..."
            className="flex-1 px-4 py-2 bg-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolsList() {
  const [tools, setTools] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/tools`)
      .then((res) => res.json())
      .then(setTools)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Security Tools</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className="bg-card rounded-lg border border-border p-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-primary" />
              <h4 className="font-medium">{tool.name}</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {tool.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs bg-secondary px-2 py-1 rounded">
                {tool.category}
              </span>
              {tool.dangerous && (
                <span className="text-xs bg-red-500/20 text-red-500 px-2 py-1 rounded">
                  ⚠️ Dangerous
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Settings</h3>

      <div className="bg-card rounded-lg border border-border p-6">
        <h4 className="font-medium mb-4">AI Providers</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Configure API keys in ~/Strix/.env
        </p>
        <div className="space-y-2 text-sm">
          <p>• GOOGLE_API_KEY (Gemini)</p>
          <p>• OPENAI_API_KEY (GPT-4)</p>
          <p>• ANTHROPIC_API_KEY (Claude)</p>
          <p>• GROQ_API_KEY (Llama)</p>
          <p>• MISTRAL_API_KEY (Mistral)</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <h4 className="font-medium mb-4">About</h4>
        <p className="text-sm text-muted-foreground">
          Strix Pro v1.0.0
          <br />
          Based on Strix Open Source (MIT License)
          <br />
          AI-Powered Security Platform
        </p>
      </div>
    </div>
  );
}
