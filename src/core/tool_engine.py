"""
Strix Pro - Tool Engine
Manages and executes security tools
"""

import subprocess
import shlex
import os
import json
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

class ToolCategory(Enum):
    NETWORK = "network"
    WEB = "web"
    FILE = "file"
    SYSTEM = "system"
    RECON = "recon"
    EXPLOIT = "exploit"
    SAST = "sast"  # Static Application Security Testing

@dataclass
class ToolResult:
    success: bool
    output: str
    error: Optional[str] = None
    tool: str = ""
    command: str = ""
    duration: float = 0.0

class ToolEngine:
    """Manages security tool execution"""
    
    def __init__(self):
        self.tools = self._register_tools()
        self.dangerous_patterns = [
            ';', '&&', '||', '|', '`', '$(', '>', '<', '>>',
            '>>>', ';&', ';&;', 'rm -rf', 'mkfs', 'dd'
        ]
    
    def _register_tools(self) -> Dict[str, Dict]:
        """Register all available tools"""
        return {
            # Network Tools
            "nmap": {
                "name": "nmap",
                "description": "Network port scanner with version detection",
                "category": ToolCategory.NETWORK,
                "command": "nmap",
                "args_template": "{flags} {target}",
                "dangerous": False
            },
            "subfinder": {
                "name": "subfinder",
                "description": "Subdomain enumeration tool",
                "category": ToolCategory.RECON,
                "command": "subfinder",
                "args_template": "-d {domain} -silent",
                "dangerous": False
            },
            "masscan": {
                "name": "masscan",
                "description": "Fast port scanner",
                "category": ToolCategory.NETWORK,
                "command": "masscan",
                "args_template": "{target} -p {ports} --rate {rate}",
                "dangerous": False
            },
            
            # Web Tools
            "gobuster": {
                "name": "gobuster",
                "description": "Directory/file brute-forcer",
                "category": ToolCategory.WEB,
                "command": "gobuster",
                "args_template": "dir -u {url} -w {wordlist} -t {threads}",
                "dangerous": False
            },
            "nikto": {
                "name": "nikto",
                "description": "Web server scanner",
                "category": ToolCategory.WEB,
                "command": "nikto",
                "args_template": "-h {target}",
                "dangerous": False
            },
            "nuclei": {
                "name": "nuclei",
                "description": "Vulnerability scanner using templates",
                "category": ToolCategory.WEB,
                "command": "nuclei",
                "args_template": "-u {target} -silent -severity low,medium,high,critical",
                "dangerous": False
            },
            "httpx": {
                "name": "httpx",
                "description": "HTTP toolkit and probing",
                "category": ToolCategory.WEB,
                "command": "httpx",
                "args_template": "-u {target} -status-code -title -tech-detect",
                "dangerous": False
            },
            
            # Recon Tools
            "whois": {
                "name": "whois",
                "description": "WHOIS lookup",
                "category": ToolCategory.RECON,
                "command": "whois",
                "args_template": "{domain}",
                "dangerous": False
            },
            "dig": {
                "name": "dig",
                "description": "DNS lookup",
                "category": ToolCategory.RECON,
                "command": "dig",
                "args_template": "{domain} {type}",
                "dangerous": False
            },
            "theHarvester": {
                "name": "theHarvester",
                "description": "Email and subdomain harvester",
                "category": ToolCategory.RECON,
                "command": "theHarvester",
                "args_template": "-d {domain} -b {source}",
                "dangerous": False
            },
            
            # SSL/TLS Tools
            "sslscan": {
                "name": "sslscan",
                "description": "SSL/TLS scanner",
                "category": ToolCategory.NETWORK,
                "command": "sslscan",
                "args_template": "{target}",
                "dangerous": False
            },
            "testssl": {
                "name": "testssl",
                "description": "SSL/TLS testing tool",
                "category": ToolCategory.NETWORK,
                "command": "testssl.sh",
                "args_template": "{target}",
                "dangerous": False
            },
            
            # System Tools
            "curl": {
                "name": "curl",
                "description": "HTTP client",
                "category": ToolCategory.SYSTEM,
                "command": "curl",
                "args_template": "{flags} {url}",
                "dangerous": False
            },
            "wget": {
                "name": "wget",
                "description": "File downloader",
                "category": ToolCategory.SYSTEM,
                "command": "wget",
                "args_template": "{flags} {url}",
                "dangerous": False
            },
            
            # Exploit Tools (careful!)
            "hydra": {
                "name": "hydra",
                "description": "Login brute-forcer",
                "category": ToolCategory.EXPLOIT,
                "command": "hydra",
                "args_template": "-l {user} -P {wordlist} {target} {service}",
                "dangerous": True
            },
            "sqlmap": {
                "name": "sqlmap",
                "description": "SQL injection tool",
                "category": ToolCategory.EXPLOIT,
                "command": "sqlmap",
                "args_template": "-u {url} --batch",
                "dangerous": True
            },
            
            # SAST / Source Code Scanning Tools
            "trivy": {
                "name": "trivy",
                "description": "Comprehensive vulnerability scanner for containers, filesystems, and git repos",
                "category": ToolCategory.SAST,
                "command": "trivy",
                "args_template": "fs --scanners vuln,secret,misconfig --format json {target}",
                "dangerous": False
            },
            "sonar-scanner": {
                "name": "sonar-scanner",
                "description": "SonarQube/SonarCloud static code analysis scanner",
                "category": ToolCategory.SAST,
                "command": "sonar-scanner",
                "args_template": "-Dsonar.projectKey={project_key} -Dsonar.sources={target} -Dsonar.host.url={server_url}",
                "dangerous": False
            },
            "codeql": {
                "name": "codeql",
                "description": "GitHub CodeQL semantic code analysis engine",
                "category": ToolCategory.SAST,
                "command": "codeql",
                "args_template": "database analyze {database} {query_suite} --format=sarif-latest --output={output}",
                "dangerous": False
            }
        }
    
    def get_tools_list(self) -> List[Dict]:
        """Get list of available tools"""
        return [
            {
                "name": t["name"],
                "description": t["description"],
                "category": t["category"].value,
                "dangerous": t["dangerous"]
            }
            for t in self.tools.values()
        ]
    
    def get_tools_for_ai(self) -> List[Dict]:
        """Get tools in AI-compatible format"""
        ai_tools = []
        
        for tool_name, tool_info in self.tools.items():
            ai_tool = {
                "type": "function",
                "function": {
                    "name": tool_name,
                    "description": tool_info["description"],
                    "parameters": self._get_tool_parameters(tool_name)
                }
            }
            ai_tools.append(ai_tool)
        
        # Add generic run_command
        ai_tools.append({
            "type": "function",
            "function": {
                "name": "run_command",
                "description": "Execute a generic terminal command",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "Command to execute"
                        }
                    },
                    "required": ["command"]
                }
            }
        })
        
        return ai_tools
    
    def _get_tool_parameters(self, tool_name: str) -> Dict:
        """Get parameters for a specific tool"""
        params_map = {
            "nmap": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Target IP or domain"},
                    "flags": {"type": "string", "description": "Nmap flags (e.g., -sV -p-)", "default": "-sV -p-"}
                },
                "required": ["target"]
            },
            "subfinder": {
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Target domain"}
                },
                "required": ["domain"]
            },
            "gobuster": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Target URL"},
                    "wordlist": {"type": "string", "description": "Wordlist path", "default": "/usr/share/wordlists/dirb/common.txt"},
                    "threads": {"type": "string", "description": "Number of threads", "default": "50"}
                },
                "required": ["url"]
            },
            "nikto": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Target host or URL"}
                },
                "required": ["target"]
            },
            "nuclei": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Target URL"},
                    "templates": {"type": "string", "description": "Template path or tags", "default": ""}
                },
                "required": ["target"]
            },
            "whois": {
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Domain to lookup"}
                },
                "required": ["domain"]
            },
            "dig": {
                "type": "object",
                "properties": {
                    "domain": {"type": "string", "description": "Domain to query"},
                    "type": {"type": "string", "description": "DNS record type (A, AAAA, MX, etc.)", "default": "A"}
                },
                "required": ["domain"]
            },
            "httpx": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Target URL"}
                },
                "required": ["target"]
            },
            "sslscan": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Target host:port"}
                },
                "required": ["target"]
            },
            "hydra": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Target host"},
                    "user": {"type": "string", "description": "Username"},
                    "wordlist": {"type": "string", "description": "Password wordlist path"},
                    "service": {"type": "string", "description": "Service (ssh, ftp, http, etc.)"}
                },
                "required": ["target", "user", "wordlist", "service"]
            },
            "sqlmap": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Target URL with parameters"}
                },
                "required": ["url"]
            },
            "trivy": {
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "Target directory or repo URL to scan"}
                },
                "required": ["target"]
            },
            "sonar-scanner": {
                "type": "object",
                "properties": {
                    "project_key": {"type": "string", "description": "SonarQube project key"},
                    "target": {"type": "string", "description": "Source directory to scan", "default": "."},
                    "server_url": {"type": "string", "description": "SonarQube server URL", "default": "http://localhost:9000"}
                },
                "required": ["project_key"]
            },
            "codeql": {
                "type": "object",
                "properties": {
                    "database": {"type": "string", "description": "CodeQL database path"},
                    "query_suite": {"type": "string", "description": "Query suite (e.g., javascript-security-extended)", "default": "javascript-security-extended"},
                    "output": {"type": "string", "description": "Output file path", "default": "results.sarif"}
                },
                "required": ["database"]
            }
        }
        
        return params_map.get(tool_name, {
            "type": "object",
            "properties": {},
            "required": []
        })
    
    def execute(self, tool_name: str, args: Dict[str, Any], auto_save: bool = False) -> ToolResult:
        """Execute a tool"""
        
        # Special handling for run_command
        if tool_name == "run_command":
            return self._run_command(args.get("command", ""), auto_save)
        
        if tool_name not in self.tools:
            return ToolResult(
                success=False,
                output="",
                error=f"Tool '{tool_name}' not found",
                tool=tool_name
            )
        
        tool = self.tools[tool_name]
        
        # Check if tool is installed
        if not self._check_tool_installed(tool["command"]):
            return ToolResult(
                success=False,
                output="",
                error=f"Tool '{tool_name}' is not installed. Install it first.",
                tool=tool_name
            )
        
        # Build command
        try:
            command = self._build_command(tool, args)
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=f"Error building command: {e}",
                tool=tool_name
            )
        
        # Execute
        return self._run_command(command, auto_save, tool_name=tool_name)
    
    def _check_tool_installed(self, command: str) -> bool:
        """Check if a tool is installed"""
        try:
            result = subprocess.run(
                ["which", command],
                capture_output=True,
                text=True
            )
            return result.returncode == 0
        except:
            return False
    
    def _build_command(self, tool: Dict, args: Dict) -> str:
        """Build command from tool template and args"""
        template = tool["args_template"]
        
        # Fill in template
        for key, value in args.items():
            template = template.replace(f"{{{key}}}", str(value))
        
        # Remove unfilled placeholders
        import re
        template = re.sub(r'\{[^}]+\}', '', template)
        template = ' '.join(template.split())  # Clean up whitespace
        
        return f"{tool['command']} {template}"
    
    def _run_command(self, command: str, auto_save: bool = False, tool_name: str = "") -> ToolResult:
        """Execute a command"""
        import time
        
        # Safety check
        for pattern in self.dangerous_patterns:
            if pattern in command:
                return ToolResult(
                    success=False,
                    output="",
                    error=f"Command contains dangerous pattern: {pattern}",
                    tool=tool_name,
                    command=command
                )
        
        # Path traversal check
        if '..' in command or command.startswith('/'):
            # Allow some commands that need absolute paths
            allowed_commands = ['nmap', 'nikto', 'sqlmap', 'hydra', 'nuclei']
            if not any(command.startswith(cmd) for cmd in allowed_commands):
                return ToolResult(
                    success=False,
                    output="",
                    error="Command contains invalid path pattern",
                    tool=tool_name,
                    command=command
                )
        
        try:
            start_time = time.time()
            
            cmd_parts = shlex.split(command)
            result = subprocess.run(
                cmd_parts,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            duration = time.time() - start_time
            
            stdout = result.stdout or ""
            stderr = result.stderr or ""
            
            output = stdout
            if stderr:
                output += f"\n[STDERR]\n{stderr}"
            
            # Security tools often return non-zero when they find vulnerabilities
            # Consider it success if there's any output
            has_output = len(stdout.strip()) > 0
            
            return ToolResult(
                success=result.returncode == 0 or has_output,
                output=output.strip(),
                error=stderr if result.returncode != 0 and not has_output else None,
                tool=tool_name,
                command=command,
                duration=duration
            )
            
        except subprocess.TimeoutExpired:
            return ToolResult(
                success=False,
                output="",
                error="Command timed out after 5 minutes",
                tool=tool_name,
                command=command
            )
        except Exception as e:
            return ToolResult(
                success=False,
                output="",
                error=str(e),
                tool=tool_name,
                command=command
            )
