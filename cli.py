#!/usr/bin/env python3
"""
Strix Pro CLI - Command Line Interface
Enhanced version of Strix Open Source with more features

Commands:
  strix-pro                               # Interactive chat mode
  strix-pro --scan <target> [type]        # Quick scan
  strix-pro --tools                       # List available tools
  strix-pro --web                         # Start web server

  strix-pro login                         # Authenticate with email/password
  strix-pro register                      # Register a new account
  strix-pro whoami                        # Show current user info
  strix-pro logout                        # Clear saved credentials

  strix-pro schedule list                 # List scheduled scans
  strix-pro schedule add <target> <type> --cron '0 2 * * *'
  strix-pro schedule remove <id>          # Remove a schedule
  strix-pro schedule pause <id>           # Pause a schedule
  strix-pro schedule resume <id>          # Resume a schedule

  strix-pro github connect <token>        # Connect GitHub account
  strix-pro github repos                  # List connected repos
  strix-pro github scan-pr <repo> <pr>    # Scan a pull request
  strix-pro github fix <repo> <pr>        # Auto-fix PR vulnerabilities

  strix-pro report generate <target> --type full
  strix-pro report list                   # List generated reports
  strix-pro report download <id>          # Download a report
"""

import os
import sys
import json
import argparse
import asyncio
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.markdown import Markdown
from rich.live import Live
from rich.spinner import Spinner
from rich import box

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

console = Console()

API_BASE_URL = os.getenv("STRIX_API_URL", "http://localhost:8000")
TOKEN_DIR = Path.home() / ".strix"
TOKEN_FILE = TOKEN_DIR / "token"

BANNER = """
 ███████╗████████╗██████╗ ██╗██╗  ██╗
 ██╔════╝╚══██╔══╝██╔══██╗██║╚██╗██╔╝
 ███████╗   ██║   ██████╔╝██║ ╚███╔╝
 ╚════██║   ██║   ██╔══██╗██║ ██╔██╗
 ███████║   ██║   ██║  ██║██║██╔╝ ██╗
 ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝

 AI-Powered Security Platform v1.0 (Pro)
"""

# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _save_token(token: str) -> None:
    """Persist JWT token to ~/.strix/token"""
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(token)
    TOKEN_FILE.chmod(0o600)


def _load_token() -> str | None:
    """Load saved JWT token, or None"""
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text().strip()
    return None


def _clear_token() -> None:
    """Remove saved token"""
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()


def _auth_headers() -> dict:
    """Return Authorization header if token exists"""
    token = _load_token()
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


# ---------------------------------------------------------------------------
# HTTP helper (thin wrapper around httpx)
# ---------------------------------------------------------------------------

def _api_request(method: str, path: str, **kwargs) -> dict:
    """Make an authenticated API request and return parsed JSON."""
    import httpx

    url = f"{API_BASE_URL}{path}"
    headers = {**_auth_headers(), **kwargs.pop("headers", {})}

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.request(method, url, headers=headers, **kwargs)
    except httpx.ConnectError:
        console.print(f"[red]✖ Cannot connect to Strix Pro API at {API_BASE_URL}[/red]")
        console.print("[dim]  Is the backend running? Start it with: strix-pro --web[/dim]")
        sys.exit(1)

    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail", resp.text)
        except Exception:
            detail = resp.text
        console.print(f"[red]✖ API error ({resp.status_code}): {detail}[/red]")
        sys.exit(1)

    if resp.status_code == 204 or not resp.content:
        return {}
    return resp.json()

# ═══════════════════════════════════════════════════════════════════════════
#  Banner & provider helpers (original)
# ═══════════════════════════════════════════════════════════════════════════

def show_banner():
    """Show startup banner"""
    console.print(Panel(BANNER, style="bold cyan"))
    console.print("[dim]Based on Strix Open Source (MIT License)[/dim]\n")


def show_providers(ai_router):
    """Show available AI providers"""
    providers = ai_router.get_available_providers()

    if not providers:
        console.print("[red]No AI providers available. Set API keys in ~/Strix/.env[/red]")
        return None, None

    table = Table(title="Available AI Providers")
    table.add_column("#", style="cyan")
    table.add_column("Provider", style="green")
    table.add_column("Models", style="yellow")

    provider_list = []
    for i, (provider, models) in enumerate(providers.items(), 1):
        table.add_row(str(i), provider, ", ".join(models[:3]) + ("..." if len(models) > 3 else ""))
        provider_list.append(provider)

    console.print(table)

    choice = Prompt.ask(
        "Select provider",
        choices=[str(i) for i in range(1, len(provider_list) + 1)],
        default="1"
    )

    provider = provider_list[int(choice) - 1]
    models = providers[provider]

    model_table = Table(title=f"{provider} Models")
    model_table.add_column("#", style="cyan")
    model_table.add_column("Model", style="green")

    for i, model in enumerate(models, 1):
        model_table.add_row(str(i), model)

    console.print(model_table)

    model_choice = Prompt.ask(
        "Select model",
        choices=[str(i) for i in range(1, len(models) + 1)],
        default="1"
    )

    model = models[int(model_choice) - 1]
    return provider, model


# ═══════════════════════════════════════════════════════════════════════════
#  Interactive chat mode (original, lightly touched)
# ═══════════════════════════════════════════════════════════════════════════

def interactive_mode(ai_router, tool_engine, auto_save=False):
    """Run interactive chat mode"""
    from src.ai.router import AIMessage

    show_banner()

    provider, model = show_providers(ai_router)
    if not provider:
        return

    console.print(f"\n[green]Using {provider}/{model}[/green]")
    console.print("[dim]Type '!exit' to quit, '!tools' to list tools, '!scan' to scan target[/dim]\n")

    system_prompt = """You are Strix Pro, an advanced AI-powered security assistant.
You help with penetration testing, vulnerability analysis, and security assessments.

Available tools: nmap, subfinder, gobuster, nikto, nuclei, httpx, whois, dig, sslscan, hydra, sqlmap

When asked to scan or test something:
1. Use the appropriate tool directly
2. Analyze the results
3. Provide security recommendations

Be technical, precise, and always prioritize security.
Report findings with severity levels: CRITICAL, HIGH, MEDIUM, LOW, INFO."""

    messages = [AIMessage(role="system", content=system_prompt)]
    tools = tool_engine.get_tools_for_ai()

    while True:
        try:
            user_input = console.input("\n[bold cyan]> [/bold cyan]")

            if not user_input.strip():
                continue

            if user_input.lower() in ['!exit', 'quit', 'exit']:
                console.print("[yellow]Goodbye![/yellow]")
                break

            if user_input.lower() == '!tools':
                show_tools(tool_engine)
                continue

            if user_input.lower().startswith('!scan'):
                parts = user_input.split()
                if len(parts) > 1:
                    target = parts[1]
                    scan_type = parts[2] if len(parts) > 2 else "port_scan"
                    run_scan(tool_engine, target, scan_type, auto_save)
                else:
                    console.print("[red]Usage: !scan <target> [scan_type][/red]")
                continue

            messages.append(AIMessage(role="user", content=user_input))

            with console.status("[bold green]Thinking...", spinner="dots"):
                response = ai_router.chat(
                    provider=provider,
                    model=model,
                    messages=messages,
                    tools=tools,
                    temperature=0.7,
                    max_tokens=4096
                )

            if response.tool_calls:
                for tool_call in response.tool_calls:
                    func = tool_call["function"]
                    tool_name = func["name"]

                    if isinstance(func["arguments"], str):
                        args = json.loads(func["arguments"])
                    else:
                        args = func["arguments"]

                    console.print(f"\n[yellow]⚡ Executing: {tool_name}({args})[/yellow]")
                    result = tool_engine.execute(tool_name, args, auto_save)

                    if result.success:
                        console.print(Panel(result.output[:2000], title=f"{tool_name} Output", style="green"))
                    else:
                        console.print(Panel(result.error, title=f"{tool_name} Error", style="red"))

                    messages.append(AIMessage(
                        role="assistant",
                        content=response.content or "",
                        tool_calls=response.tool_calls
                    ))
                    messages.append(AIMessage(
                        role="tool",
                        content=result.output if result.success else result.error,
                        tool_call_id=tool_call["id"]
                    ))

                with console.status("[bold green]Analyzing results...", spinner="dots"):
                    final_response = ai_router.chat(
                        provider=provider,
                        model=model,
                        messages=messages,
                        temperature=0.7,
                        max_tokens=4096
                    )

                console.print(Panel(Markdown(final_response.content), title="Strix Pro", style="cyan"))
                messages.append(AIMessage(role="assistant", content=final_response.content))
            else:
                console.print(Panel(Markdown(response.content), title="Strix Pro", style="cyan"))
                messages.append(AIMessage(role="assistant", content=response.content))

        except KeyboardInterrupt:
            console.print("\n[yellow]Use '!exit' to quit[/yellow]")
        except Exception as e:
            console.print(f"[red]Error: {e}[/red]")


# ═══════════════════════════════════════════════════════════════════════════
#  Tools & scan helpers (original)
# ═══════════════════════════════════════════════════════════════════════════

def show_tools(tool_engine):
    """Show available tools"""
    tools = tool_engine.get_tools_list()

    table = Table(title="Available Security Tools")
    table.add_column("Tool", style="cyan")
    table.add_column("Category", style="green")
    table.add_column("Description", style="yellow")
    table.add_column("Dangerous", style="red")

    for tool in tools:
        table.add_row(
            tool["name"],
            tool["category"],
            tool["description"],
            "⚠️ Yes" if tool["dangerous"] else "No"
        )

    console.print(table)


def run_scan(tool_engine, target: str, scan_type: str, auto_save: bool = False):
    """Run a scan"""
    scan_map = {
        "port_scan": ("nmap", {"target": target, "flags": "-sV -p-"}),
        "subdomain": ("subfinder", {"domain": target}),
        "web_scan": ("nikto", {"target": target}),
        "vuln_scan": ("nuclei", {"target": target}),
        "dir_scan": ("gobuster", {"url": f"http://{target}", "wordlist": "/usr/share/wordlists/dirb/common.txt", "threads": "50"}),
        "ssl": ("sslscan", {"target": target}),
        "whois": ("whois", {"domain": target}),
        "dns": ("dig", {"domain": target, "type": "ANY"})
    }

    if scan_type not in scan_map:
        console.print(f"[red]Unknown scan type: {scan_type}[/red]")
        console.print(f"[yellow]Available: {', '.join(scan_map.keys())}[/yellow]")
        return

    tool_name, args = scan_map[scan_type]

    console.print(f"\n[bold]Running {scan_type} on {target}...[/bold]")

    with console.status(f"[bold green]Scanning with {tool_name}...", spinner="dots"):
        result = tool_engine.execute(tool_name, args, auto_save)

    if result.success:
        console.print(Panel(result.output[:3000], title=f"{scan_type} Results", style="green"))
        console.print(f"[dim]Completed in {result.duration:.1f}s[/dim]")
    else:
        console.print(Panel(result.error, title=f"{scan_type} Error", style="red"))


# ═══════════════════════════════════════════════════════════════════════════
#  Web mode (original)
# ═══════════════════════════════════════════════════════════════════════════

def web_mode(host: str = "0.0.0.0", port: int = 8000):
    """Run web server"""
    import uvicorn
    console.print(f"\n[bold green]Starting Strix Pro API server...[/bold green]")
    console.print(f"[dim]API: http://{host}:{port}[/dim]")
    console.print(f"[dim]Docs: http://{host}:{port}/docs[/dim]\n")
    uvicorn.run("src.main:app", host=host, port=port, reload=True)


# ═══════════════════════════════════════════════════════════════════════════
#  AUTH commands
# ═══════════════════════════════════════════════════════════════════════════

def cmd_login(_args):
    """Login with email/password and save JWT token."""
    email = Prompt.ask("[cyan]Email[/cyan]")
    password = Prompt.ask("[cyan]Password[/cyan]", password=True)

    with console.status("[bold green]Authenticating...", spinner="dots"):
        data = _api_request("POST", "/api/auth/login", json={
            "email": email,
            "password": password,
        })

    token = data.get("access_token") or data.get("token")
    if not token:
        console.print("[red]✖ Server did not return a token.[/red]")
        sys.exit(1)

    _save_token(token)
    console.print(f"[green]✔ Logged in as [bold]{email}[/bold][/green]")


def cmd_register(_args):
    """Register a new user account."""
    email = Prompt.ask("[cyan]Email[/cyan]")
    password = Prompt.ask("[cyan]Password[/cyan]", password=True)
    confirm = Prompt.ask("[cyan]Confirm password[/cyan]", password=True)

    if password != confirm:
        console.print("[red]✖ Passwords do not match.[/red]")
        sys.exit(1)

    name = Prompt.ask("[cyan]Full name (optional)[/cyan]", default="")

    with console.status("[bold green]Registering...", spinner="dots"):
        data = _api_request("POST", "/api/auth/register", json={
            "email": email,
            "password": password,
            "name": name or None,
        })

    console.print("[green]✔ Account created successfully![/green]")
    console.print("[dim]Run 'strix-pro login' to authenticate.[/dim]")


def cmd_whoami(_args):
    """Show current authenticated user info."""
    token = _load_token()
    if not token:
        console.print("[yellow]Not logged in. Run 'strix-pro login' first.[/yellow]")
        sys.exit(1)

    with console.status("[bold green]Fetching user info...", spinner="dots"):
        data = _api_request("GET", "/api/auth/me")

    table = Table(title="Current User", box=box.ROUNDED)
    table.add_column("Field", style="cyan", no_wrap=True)
    table.add_column("Value", style="green")
    for key in ("id", "email", "name", "role", "created_at"):
        if key in data:
            table.add_row(key.replace("_", " ").title(), str(data[key]))
    console.print(table)


def cmd_logout(_args):
    """Clear saved credentials."""
    token = _load_token()
    if not token:
        console.print("[dim]Already logged out.[/dim]")
        return
    _clear_token()
    console.print("[green]✔ Logged out. Token cleared.[/green]")


# ═══════════════════════════════════════════════════════════════════════════
#  SCHEDULE commands
# ═══════════════════════════════════════════════════════════════════════════

def cmd_schedule_list(_args):
    """List all scheduled scans."""
    with console.status("[bold green]Fetching schedules...", spinner="dots"):
        data = _api_request("GET", "/api/schedules")

    schedules = data if isinstance(data, list) else data.get("schedules", [])
    if not schedules:
        console.print("[dim]No scheduled scans found.[/dim]")
        return

    table = Table(title="Scheduled Scans", box=box.ROUNDED)
    table.add_column("ID", style="cyan")
    table.add_column("Target", style="green")
    table.add_column("Type", style="yellow")
    table.add_column("Cron", style="magenta")
    table.add_column("Status", style="bold")
    table.add_column("Next Run", style="dim")

    for s in schedules:
        status = s.get("status", "active")
        status_style = "green" if status == "active" else "yellow" if status == "paused" else "red"
        table.add_row(
            str(s.get("id", "")),
            s.get("target", ""),
            s.get("scan_type", ""),
            s.get("cron", ""),
            f"[{status_style}]{status}[/{status_style}]",
            s.get("next_run", "—"),
        )

    console.print(table)


def cmd_schedule_add(args):
    """Add a new scheduled scan."""
    payload = {
        "target": args.target,
        "scan_type": args.type,
        "cron": args.cron,
    }
    with console.status("[bold green]Creating schedule...", spinner="dots"):
        data = _api_request("POST", "/api/schedules", json=payload)

    sched_id = data.get("id", "?")
    console.print(f"[green]✔ Schedule [bold]#{sched_id}[/bold] created: {args.target} ({args.type}) → {args.cron}[/green]")


def cmd_schedule_remove(args):
    """Remove a scheduled scan."""
    with console.status("[bold green]Removing schedule...", spinner="dots"):
        _api_request("DELETE", f"/api/schedules/{args.id}")
    console.print(f"[green]✔ Schedule #{args.id} removed.[/green]")


def cmd_schedule_pause(args):
    """Pause a scheduled scan."""
    with console.status("[bold green]Pausing schedule...", spinner="dots"):
        _api_request("POST", f"/api/schedules/{args.id}/pause")
    console.print(f"[yellow]⏸ Schedule #{args.id} paused.[/yellow]")


def cmd_schedule_resume(args):
    """Resume a paused schedule."""
    with console.status("[bold green]Resuming schedule...", spinner="dots"):
        _api_request("POST", f"/api/schedules/{args.id}/resume")
    console.print(f"[green]▶ Schedule #{args.id} resumed.[/green]")


# ═══════════════════════════════════════════════════════════════════════════
#  GITHUB commands
# ═══════════════════════════════════════════════════════════════════════════

def cmd_github_connect(args):
    """Connect a GitHub personal access token."""
    with console.status("[bold green]Connecting GitHub...", spinner="dots"):
        _api_request("POST", "/api/github/connect", json={"token": args.token})
    console.print("[green]✔ GitHub account connected successfully.[/green]")


def cmd_github_repos(_args):
    """List connected GitHub repositories."""
    with console.status("[bold green]Fetching repos...", spinner="dots"):
        data = _api_request("GET", "/api/github/repos")

    repos = data if isinstance(data, list) else data.get("repos", [])
    if not repos:
        console.print("[dim]No repositories found. Connect GitHub first with 'strix-pro github connect <token>'[/dim]")
        return

    table = Table(title="GitHub Repositories", box=box.ROUNDED)
    table.add_column("#", style="cyan", no_wrap=True)
    table.add_column("Repository", style="green")
    table.add_column("Language", style="yellow")
    table.add_column("Visibility", style="bold")
    table.add_column("Default Branch", style="dim")

    for i, r in enumerate(repos, 1):
        vis = "🔒 Private" if r.get("private") else "🌐 Public"
        table.add_row(
            str(i),
            r.get("full_name", r.get("name", "")),
            r.get("language", "—"),
            vis,
            r.get("default_branch", "—"),
        )

    console.print(table)


def cmd_github_scan_pr(args):
    """Scan a GitHub pull request for vulnerabilities."""
    console.print(f"[bold]Scanning PR #{args.pr} in {args.repo}...[/bold]")
    with console.status("[bold green]Running security scan on PR...", spinner="dots"):
        data = _api_request("POST", f"/api/github/scan-pr", json={
            "repo": args.repo,
            "pr_number": args.pr,
        })

    findings = data.get("findings", [])
    if not findings:
        console.print("[green]✔ No vulnerabilities found in PR #{args.pr}.[/green]")
        return

    table = Table(title=f"PR #{args.pr} Scan Results", box=box.ROUNDED)
    table.add_column("Severity", style="bold")
    table.add_column("File", style="cyan")
    table.add_column("Line", style="yellow")
    table.add_column("Description")

    severity_style = {"CRITICAL": "red", "HIGH": "red", "MEDIUM": "yellow", "LOW": "cyan", "INFO": "dim"}
    for f in findings:
        sev = f.get("severity", "INFO")
        table.add_row(
            f"[{severity_style.get(sev, 'white')}]{sev}[/{severity_style.get(sev, 'white')}]",
            f.get("file", ""),
            str(f.get("line", "")),
            f.get("description", ""),
        )
    console.print(table)
    console.print(f"\n[dim]Total findings: {len(findings)}[/dim]")


def cmd_github_fix(args):
    """Auto-fix vulnerabilities in a PR by creating a fix PR."""
    console.print(f"[bold]Generating fix PR for #{args.pr} in {args.repo}...[/bold]")
    with console.status("[bold green]Creating fix PR...", spinner="dots"):
        data = _api_request("POST", f"/api/github/fix", json={
            "repo": args.repo,
            "pr_number": args.pr,
        })

    fix_pr_url = data.get("pr_url") or data.get("url", "")
    if fix_pr_url:
        console.print(f"[green]✔ Fix PR created: [link={fix_pr_url}]{fix_pr_url}[/link][/green]")
    else:
        console.print("[green]✔ Fix PR created.[/green]")
        if data.get("message"):
            console.print(f"[dim]{data['message']}[/dim]")


# ═══════════════════════════════════════════════════════════════════════════
#  REPORT commands
# ═══════════════════════════════════════════════════════════════════════════

def cmd_report_generate(args):
    """Generate a security report for a target."""
    report_type = getattr(args, "type", None) or "full"
    console.print(f"[bold]Generating {report_type} report for {args.target}...[/bold]")

    with console.status("[bold green]Generating report...", spinner="dots"):
        data = _api_request("POST", "/api/reports/generate", json={
            "target": args.target,
            "report_type": report_type,
        })

    report_id = data.get("id", "?")
    console.print(f"[green]✔ Report [bold]#{report_id}[/bold] generated for {args.target}.[/green]")
    console.print(f"[dim]Download with: strix-pro report download {report_id}[/dim]")


def cmd_report_list(_args):
    """List all generated reports."""
    with console.status("[bold green]Fetching reports...", spinner="dots"):
        data = _api_request("GET", "/api/reports")

    reports = data if isinstance(data, list) else data.get("reports", [])
    if not reports:
        console.print("[dim]No reports found.[/dim]")
        return

    table = Table(title="Security Reports", box=box.ROUNDED)
    table.add_column("ID", style="cyan")
    table.add_column("Target", style="green")
    table.add_column("Type", style="yellow")
    table.add_column("Status", style="bold")
    table.add_column("Created", style="dim")

    for r in reports:
        status = r.get("status", "unknown")
        status_style = "green" if status == "completed" else "yellow"
        table.add_row(
            str(r.get("id", "")),
            r.get("target", ""),
            r.get("report_type", ""),
            f"[{status_style}]{status}[/{status_style}]",
            r.get("created_at", "—"),
        )

    console.print(table)


def cmd_report_download(args):
    """Download a report by ID."""
    console.print(f"[bold]Downloading report #{args.id}...[/bold]")

    import httpx
    url = f"{API_BASE_URL}/api/reports/{args.id}/download"
    headers = _auth_headers()

    try:
        with httpx.Client(timeout=60.0, follow_redirects=True) as client:
            resp = client.get(url, headers=headers)
    except httpx.ConnectError:
        console.print(f"[red]✖ Cannot connect to Strix Pro API at {API_BASE_URL}[/red]")
        sys.exit(1)

    if resp.status_code >= 400:
        console.print(f"[red]✖ Failed to download report (HTTP {resp.status_code}).[/red]")
        sys.exit(1)

    # Determine filename from Content-Disposition or fallback
    cd = resp.headers.get("content-disposition", "")
    if "filename=" in cd:
        filename = cd.split("filename=")[-1].strip('" ')
    else:
        content_type = resp.headers.get("content-type", "")
        ext = ".pdf" if "pdf" in content_type else ".html" if "html" in content_type else ".json"
        filename = f"strix-report-{args.id}{ext}"

    out_path = Path.cwd() / filename
    out_path.write_bytes(resp.content)
    console.print(f"[green]✔ Report saved to [bold]{out_path}[/bold] ({len(resp.content):,} bytes)[/green]")


# ═══════════════════════════════════════════════════════════════════════════
#  Argument parser
# ═══════════════════════════════════════════════════════════════════════════

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="strix-pro",
        description="Strix Pro - AI-Powered Security Platform",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  strix-pro                               Interactive chat mode
  strix-pro --scan example.com            Quick port scan
  strix-pro --scan example.com subdomain  Subdomain scan
  strix-pro --web                         Start web server (API)
  strix-pro --tools                       List available tools

  strix-pro login                         Authenticate
  strix-pro schedule add example.com vuln_scan --cron '0 2 * * *'
  strix-pro github scan-pr owner/repo 42
  strix-pro report generate example.com --type full
        """,
    )

    # ── Legacy / global flags ────────────────────────────────────────────
    parser.add_argument('--scan', nargs='+', metavar=('TARGET', 'TYPE'),
                        help='Quick scan: --scan <target> [port_scan|subdomain|web_scan|vuln_scan]')
    parser.add_argument('--web', action='store_true', help='Start web server')
    parser.add_argument('--host', default='0.0.0.0', help='Web server host')
    parser.add_argument('--port', type=int, default=8000, help='Web server port')
    parser.add_argument('--tools', action='store_true', help='List available tools')
    parser.add_argument('--providers', action='store_true', help='List AI providers')
    parser.add_argument('--auto-save', action='store_true', help='Auto-execute without confirmation')
    parser.add_argument('--prompt', choices=['pentest', 'ctf', 'vuln-research'],
                        help='Select system prompt')
    parser.add_argument('--model', type=str, help='Select AI model (e.g., gpt-4, gemini-2.5-flash)')

    # ── Subcommands ──────────────────────────────────────────────────────
    subparsers = parser.add_subparsers(dest="command", title="commands")

    # -- auth ---------------------------------------------------------------
    sp_login = subparsers.add_parser("login", help="Login with email/password")
    sp_login.set_defaults(func=cmd_login)

    sp_register = subparsers.add_parser("register", help="Register a new account")
    sp_register.set_defaults(func=cmd_register)

    sp_whoami = subparsers.add_parser("whoami", help="Show current user info")
    sp_whoami.set_defaults(func=cmd_whoami)

    sp_logout = subparsers.add_parser("logout", help="Clear saved credentials")
    sp_logout.set_defaults(func=cmd_logout)

    # -- schedule -----------------------------------------------------------
    sp_sched = subparsers.add_parser("schedule", help="Manage scheduled scans")
    sched_sub = sp_sched.add_subparsers(dest="sched_cmd")

    sp_sched_list = sched_sub.add_parser("list", help="List all scheduled scans")
    sp_sched_list.set_defaults(func=cmd_schedule_list)

    sp_sched_add = sched_sub.add_parser("add", help="Add a new scheduled scan")
    sp_sched_add.add_argument("target", help="Scan target (e.g. example.com)")
    sp_sched_add.add_argument("type", help="Scan type (port_scan, vuln_scan, etc.)")
    sp_sched_add.add_argument("--cron", required=True, help="Cron expression (e.g. '0 2 * * *')")
    sp_sched_add.set_defaults(func=cmd_schedule_add)

    sp_sched_rm = sched_sub.add_parser("remove", help="Remove a schedule")
    sp_sched_rm.add_argument("id", help="Schedule ID")
    sp_sched_rm.set_defaults(func=cmd_schedule_remove)

    sp_sched_pause = sched_sub.add_parser("pause", help="Pause a schedule")
    sp_sched_pause.add_argument("id", help="Schedule ID")
    sp_sched_pause.set_defaults(func=cmd_schedule_pause)

    sp_sched_resume = sched_sub.add_parser("resume", help="Resume a schedule")
    sp_sched_resume.add_argument("id", help="Schedule ID")
    sp_sched_resume.set_defaults(func=cmd_schedule_resume)

    # -- github -------------------------------------------------------------
    sp_gh = subparsers.add_parser("github", help="GitHub integration")
    gh_sub = sp_gh.add_subparsers(dest="gh_cmd")

    sp_gh_connect = gh_sub.add_parser("connect", help="Connect GitHub with a PAT")
    sp_gh_connect.add_argument("token", help="GitHub personal access token")
    sp_gh_connect.set_defaults(func=cmd_github_connect)

    sp_gh_repos = gh_sub.add_parser("repos", help="List connected repos")
    sp_gh_repos.set_defaults(func=cmd_github_repos)

    sp_gh_scan = gh_sub.add_parser("scan-pr", help="Scan a pull request")
    sp_gh_scan.add_argument("repo", help="Repository (owner/repo)")
    sp_gh_scan.add_argument("pr", type=int, help="Pull request number")
    sp_gh_scan.set_defaults(func=cmd_github_scan_pr)

    sp_gh_fix = gh_sub.add_parser("fix", help="Auto-fix PR vulnerabilities")
    sp_gh_fix.add_argument("repo", help="Repository (owner/repo)")
    sp_gh_fix.add_argument("pr", type=int, help="Pull request number")
    sp_gh_fix.set_defaults(func=cmd_github_fix)

    # -- report -------------------------------------------------------------
    sp_rpt = subparsers.add_parser("report", help="Security reports")
    rpt_sub = sp_rpt.add_subparsers(dest="rpt_cmd")

    sp_rpt_gen = rpt_sub.add_parser("generate", help="Generate a report")
    sp_rpt_gen.add_argument("target", help="Scan target")
    sp_rpt_gen.add_argument("--type", default="full", dest="type",
                            choices=["full", "summary", "compliance"],
                            help="Report type (default: full)")
    sp_rpt_gen.set_defaults(func=cmd_report_generate)

    sp_rpt_list = rpt_sub.add_parser("list", help="List reports")
    sp_rpt_list.set_defaults(func=cmd_report_list)

    sp_rpt_dl = rpt_sub.add_parser("download", help="Download a report")
    sp_rpt_dl.add_argument("id", help="Report ID")
    sp_rpt_dl.set_defaults(func=cmd_report_download)

    return parser


# ═══════════════════════════════════════════════════════════════════════════
#  Main entry point
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = build_parser()
    args = parser.parse_args()

    # ── Dispatch subcommand if one was selected ───────────────────────────
    if hasattr(args, "func"):
        show_banner()
        # Validate schedule / github / report sub-commands
        if args.command == "schedule" and not getattr(args, "sched_cmd", None):
            parser.parse_args(["schedule", "--help"])
            return
        if args.command == "github" and not getattr(args, "gh_cmd", None):
            parser.parse_args(["github", "--help"])
            return
        if args.command == "report" and not getattr(args, "rpt_cmd", None):
            parser.parse_args(["report", "--help"])
            return
        args.func(args)
        return

    # ── Legacy flag-based commands ────────────────────────────────────────
    from src.ai.router import AIRouter
    from src.core.tool_engine import ToolEngine

    ai_router = AIRouter()
    tool_engine = ToolEngine()

    if args.tools:
        show_banner()
        show_tools(tool_engine)
    elif args.providers:
        show_banner()
        show_providers(ai_router)
    elif args.web:
        web_mode(args.host, args.port)
    elif args.scan:
        show_banner()
        target = args.scan[0]
        scan_type = args.scan[1] if len(args.scan) > 1 else "port_scan"
        run_scan(tool_engine, target, scan_type, args.auto_save)
    else:
        interactive_mode(ai_router, tool_engine, args.auto_save)


if __name__ == "__main__":
    main()
