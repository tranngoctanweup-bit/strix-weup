# Strix Pro - AI-Powered Security Platform

> Based on [Strix Open Source](https://github.com/strixproject/Strix) (MIT License)
> Enhanced with Web UI, Database, Scheduled Scanning, GitHub Integration, and Auto-Fix

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    STRIX PRO PLATFORM                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Frontend   │  │   REST API   │  │  WebSocket   │  │
│  │   (Next.js)  │◀─▶│   (FastAPI)  │◀─▶│   (Real-time)│  │
│  └──────────────┘  └──────┬───────┘  └──────────────┘  │
│                           │                              │
│  ┌────────────────────────┼────────────────────────┐    │
│  │                 Core Engine                      │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │ AI Router│ │Tool Engine│ │ Scan Scheduler  │ │    │
│  │  └──────────┘ └──────────┘ └──────────────────┘ │    │
│  └────────────────────────┼────────────────────────┘    │
│                           │                              │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Database   │  │    Tools     │  │  GitHub      │    │
│  │  (SQLite)   │  │  (nmap,etc)  │  │  Integration │    │
│  └────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Features

### Phase 1: Core (from Strix Open Source)
- [x] Multi-AI support (Gemini, OpenAI, Anthropic, Groq, Mistral)
- [x] Tool execution (nmap, subfinder, gobuster, etc.)
- [x] Interactive chat interface
- [x] Safety confirmation prompts

### Phase 2: Enhanced Tools
- [ ] Vulnerability scanning (nuclei, nikto)
- [ ] SSL/TLS analysis
- [ ] DNS enumeration
- [ ] WHOIS lookup
- [ ] Technology fingerprinting
- [ ] Credential testing (hydra)

### Phase 3: Database & History
- [ ] SQLite database for scan results
- [ ] Scan history tracking
- [ ] Vulnerability database
- [ ] Target management
- [ ] Export reports (PDF, JSON, CSV)

### Phase 4: Web UI (Dashboard)
- [ ] Real-time scan monitoring
- [ ] Vulnerability dashboard
- [ ] Target management UI
- [ ] Scan configuration UI
- [ ] Report viewer

### Phase 5: Scheduled Scanning
- [ ] Cron-based scan scheduling
- [ ] Recurring scans
- [ ] Scan templates
- [ ] Alert notifications

### Phase 6: GitHub Integration
- [ ] PR security reviews
- [ ] Auto-fix PR creation
- [ ] Code vulnerability scanning
- [ ] CI/CD integration

### Phase 7: Team & Enterprise
- [ ] User authentication
- [ ] Role-based access control
- [ ] Team collaboration
- [ ] Audit logging

## Quick Start

```bash
# Backend
cd strix-pro
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m src.main

# Frontend
cd frontend
npm install
npm run dev
```

## License

MIT License - Based on Strix Open Source
