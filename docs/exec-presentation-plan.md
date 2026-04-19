# Executive Presentation Plan — AI-Powered Development Automation

> **Task:** Create a self-contained HTML presentation (Reveal.js or custom) with the slides below.
> **Audience:** Executive / leadership team
> **Theme:** Dark, modern, professional. Use a consistent colour palette (e.g. deep navy + electric blue accents).

---

## Slide Structure (12 Slides)

---

### Slide 1 — Title Slide
- **Title:** AI-Powered Development Automation
- **Subtitle:** *Automating the manual, accelerating the meaningful*
- Date: April 2026

---

### Slide 2 — The Problem: Engineering Time Wasted on Toil
- Developers spend **30–40% of time** on repetitive, low-value tasks
- Pain points:
  - JIRA ticket triage, grooming, and hand-off to code are **manual and slow**
  - Playwright E2E test failures require **30–120 min/failure** to investigate
  - QA cycles bottlenecked by developer availability for reproduction & debugging
  - Spring Boot boilerplate (controllers, services, tests) consumes senior engineer time
- **Call-out stat:** *"Each CI failure costs ~1 hour of developer time. 10 failures/week = 1 dev-week/month lost"*

---

### Slide 3 — The Status Quo: Manual Workflow Bottlenecks
- Flow: JIRA ticket → developer reads → writes code → writes tests → opens PR *(days elapsed)*
- Flow: CI fails → developer investigates → reproduces → fixes → re-pushes *(hours elapsed)*
- Key insight: these workflows are **structured, repeatable, and automatable**
- No AI currently sits between ticket creation and PR creation

---

### Slide 4 — Our Solution: An AI Agentic Automation Platform
- An **event-driven AI agent system** that handles routine development tasks end-to-end
- Core technology stack:
  - **LLMs** (Claude 3.5 Sonnet / GPT-4o) — reasoning and code generation
  - **RAG** — vector-indexed codebase for context-aware code retrieval
  - **LangGraph** — stateful orchestration with human-in-the-loop safety gates
  - **MCP Servers** — standardised tool integrations for JIRA, GitHub, Playwright
- Human approval gates before every irreversible action (PR creation, commit push)
- **Tagline:** *"AI proposes. Humans approve. CI validates."*

---

### Slide 5 — Solution Architecture (High-Level)
- Architecture diagram showing:
  - **Triggers:** JIRA webhook, CI failure webhook
  - **Orchestration:** LangGraph state machine with agent nodes
  - **Tool layer:** JIRA MCP, GitHub MCP, Playwright MCP, pgvector code index
  - **Outputs:** GitHub PR, PR comment with RCA, JIRA comment
- Fully event-driven, no polling, resumable via PostgreSQL checkpointer
- **Key design principle:** Human interrupt gate is non-negotiable before PR creation

---

### Slide 6 — Use Case 1: JIRA Ticket → Pull Request
- **Trigger:** Ticket assigned to AI agent in JIRA
- **Agent flow:** Read ticket → Classify (bug/feature) → RAG retrieve relevant code → ReAct plan & generate → Write tests → Validate build → **Human review interrupt** → Open PR
- PR includes: root cause (bugs), AC coverage table (features), AI-generated notice
- **Guardrails:** diff scope validator (>50 lines → human flag), multi-service scope → immediate escalation
- **Metrics:**
  - End-to-end run time: **3–15 minutes** per ticket
  - API cost: **$0.05–$2.00** per ticket
  - Manual developer time saved: est. **2–4 hours** per ticket

---

### Slide 7 — Use Case 2: Playwright CI Failure → RCA & Auto-Fix
- **Trigger:** GitHub Actions detects Playwright test failure
- **Agent flow:** Download test report + screenshots + network logs → Classify failure type → Auto-fix (selector, timing) OR generate structured RCA document → Push fix commit or post RCA to PR
- **Failure types handled:** flaky timing, broken selectors, API contract breaks, environment issues
- **Metrics:**
  - Agent analysis time: **< 2 minutes** vs 30–120 min manual
  - Target: **>90%** failures correctly classified
  - Target: **>70%** auto-fixes pass CI on first attempt
  - Developer investigation time reduction: **>60%**

---

### Slide 8 — The Advantage: Speed, Accuracy & Developer Focus

| Dimension | Before | After |
|---|---|---|
| JIRA → PR cycle time | 1–3 days | 3–15 minutes |
| CI failure investigation | 30–120 min | < 2 minutes |
| Developer context switching | High (interruptions) | Low (agent handles triage) |
| Test coverage per PR | Variable | Enforced per AC |
| Cost per ticket automation | — | $0.05–$2.00 |

- Human engineers refocus on: architecture decisions, complex features, code review quality

---

### Slide 9 — Safety & Governance
- Every AI action is **reversible or gated** before taking effect
- Human-in-the-loop via LangGraph **interrupt** before PR creation and commit push
- Input/output guardrails (Guardrails AI) — no PII or secrets in LLM context
- Secret scanning (gitleaks/TruffleHog) on generated code before push
- Full audit trail: LangSmith/Langfuse tracing, PostgreSQL state checkpointing
- AI-generated PRs are clearly labelled — no stealth automation
- **Call-out:** *"The agent cannot merge. Only humans merge."*

---

### Slide 10 — How We Approached It: Team & Phased Delivery

**Team Structure (4 roles):**
- AI/ML Engineer — LangGraph orchestration, RAG pipeline, LLM integration
- Backend Engineer — Spring Boot services, MCP server adapters, build sandbox
- QA/Automation Engineer — Playwright MCP integration, test classification logic
- DevOps/Platform Engineer — CI webhooks, Docker sandbox, PostgreSQL checkpointer

**Phased Timeline:**
| Phase | Weeks | Focus |
|---|---|---|
| Phase 1 | 1–4 | Foundations: RAG code index, JIRA MCP, LangGraph skeleton, human gates |
| Phase 2 | 5–8 | Use Case 1: JIRA → PR for bug tickets, then feature tickets |
| Phase 3 | 9–12 | Use Case 2: Playwright RCA classification + auto-fix + CI integration |
| Phase 4 | 13+ | Expansion: code review, doc generation, dependency upgrades |

---

### Slide 11 — What Else This Platform Enables (Expansion Roadmap)
- Same stack, additional automation targets:
  - Automated code review comments (security, style, coverage) on every PR
  - Documentation generation from merged code changes
  - Dependency upgrade PRs triggered by security advisories
  - On-call runbook execution from PagerDuty alerts
  - Sprint retrospective summaries from completed JIRA tickets
  - Test gap detection — weekly scan for uncovered code paths
- **Message:** The platform is an **investment in infrastructure**, not a one-off script

---

### Slide 12 — Summary & Next Steps

**Three-sentence executive summary:**
1. We built an AI agent platform that turns JIRA tickets into PRs and Playwright failures into root cause reports — autonomously, in minutes, with human approval gates before any code lands.
2. The system uses production-grade LLMs, a RAG-indexed codebase, and standardised MCP integrations with JIRA, GitHub, and Playwright.
3. Initial use cases show **10–50× time savings** on routine tasks, with a clear expansion roadmap.

**Call to Action:**
- Approve Phase 2 resourcing to productionise Use Case 1
- Schedule a live demo of the JIRA → PR flow
- Define the list of Spring Boot services to onboard first

---

## Implementation Notes for the HTML File

- **Format:** Single self-contained HTML file with embedded CSS + JS
- **Library:** Use [Reveal.js](https://revealjs.com/) CDN for slide navigation
- **Theme:** Dark background (`#0d1117`), accent colour `#58a6ff` (GitHub-style blue)
- **File output path:** `docs/executive-presentation.html` (or project root)
- Each slide = one `<section>` tag in Reveal.js
- Add a **Mermaid or SVG architecture diagram** on Slide 5
- Use `<table>` HTML for the comparison tables on Slides 8 and 10
- Include keyboard navigation hints in footer
- Add a progress bar at the bottom
- Make it **fully self-contained** (no external files needed) so it can be shared as a single `.html` file

---

## Context: Source Project

This presentation is based on the **aiDevGuide** MkDocs documentation site at `/Users/sgovinda/Learn/aiDevGuide`. Key docs to reference for content:

- `docs/07-use-cases.md` — use case overview
- `docs/07.01-jira-to-pr.md` — Case 1 architecture
- `docs/07.02-playwright-rca.md` — Case 2 architecture
- `docs/04-langgraph.md` — LangGraph orchestration
- `docs/05-mcp-servers.md` — MCP server integrations
- `docs/08-security.md` — Security & guardrails
- `docs/09-architecture-reference.md` — Architecture patterns

