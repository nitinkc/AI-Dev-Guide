# Copilot Instructions — AI Developer Guide

This is an MkDocs documentation site serving as a learning portal for AI-powered development automation. It covers LLMs, agentic AI, RAG, LangGraph, MCP servers, and real-world use cases for software teams.

---

## Project Structure

```
aiDevGuide/
├── mkdocs.yml                            ← Site config and nav
├── requirements.txt                      ← Python deps
├── docs/
│   ├── index.md                          ← Overview + learning path
│   ├── _abbreviations.md                 ← Hover tooltip glossary
│   ├── 01-foundations.md                 ← LLMs, tokens, embeddings overview
│   ├── 01.01-how-llms-work.md            ← Transformer, context window, function calling
│   ├── 01.02-embeddings-and-vector-search.md ← Vector DBs, chunking, similarity
│   ├── 01.03-prompt-engineering.md       ← System prompts, few-shot, ReAct prompting
│   ├── 02-agentic-ai.md                  ← Agent patterns overview
│   ├── 02.01-react-and-planning.md       ← ReAct, plan-and-execute, reflection
│   ├── 02.02-multi-agent-systems.md      ← Supervisor/worker, parallel, handoffs
│   ├── 03-rag.md                         ← RAG overview
│   ├── 03.01-rag-pipeline.md             ← Indexing, chunking, hybrid search, reranking
│   ├── 03.02-advanced-rag.md             ← HyDE, multi-hop, RAPTOR, agentic RAG
│   ├── 04-langgraph.md                   ← LangGraph/LangChain overview
│   ├── 04.01-langgraph-deep-dive.md      ← Nodes, state, interrupt, parallel
│   ├── 04.02-state-machines.md           ← Workflow patterns, long-running flows
│   ├── 05-mcp-servers.md                 ← MCP protocol overview
│   ├── 05.01-mcp-protocol.md             ← JSON-RPC, transports, tool schemas
│   ├── 05.02-mcp-integrations.md         ← JIRA, GitHub, Playwright MCP design
│   ├── 06-tool-ecosystem.md              ← Landscape: LLMs, orchestrators, vector DBs
│   ├── 06.01-coding-agents.md            ← Copilot, Cursor, Aider
│   ├── 06.02-jira-integration.md         ← Ticket reading, classification, service ID
│   ├── 06.03-cicd-integration.md         ← CI webhooks, test report parsing, scope guards
│   ├── 07-use-cases.md                   ← Use case overview
│   ├── 07.01-jira-to-pr.md               ← Case 1: JIRA → PR full architecture
│   ├── 07.02-playwright-rca.md           ← Case 2: Playwright failure → RCA + fix
│   ├── 07.03-springboot-codegen.md       ← Spring Boot code generation patterns
│   ├── 08-security.md                    ← AI security overview
│   ├── 08.01-prompt-injection.md         ← Injection attacks, defence in depth
│   ├── 08.02-data-privacy.md             ← PII, data residency, self-hosted LLM
│   ├── 08.03-guardrails.md               ← Guardrails AI, output validation, policy
│   ├── 09-architecture-reference.md      ← Pattern + component selection reference
│   └── 10-interview.md                   ← Q&A, trade-off tables
```

---

## Content Model

Same two-tier model as the reference architecture project:

- **`NN-section.md`** — summary: breadth-first, tables, quick reference. Never remove existing content.
- **`NN.XX-topic.md`** — focused deep-dive per topic.

---

## Adding New Content

### New top-level section
1. Create `docs/NN-section.md`
2. Add to `nav:` in `mkdocs.yml`

### New deep-dive sub-article
1. Create `docs/NN.XX-topic.md`
2. Update `nav:` in `mkdocs.yml`
3. Add `→ Deep Dive: [Topic](NN.XX-topic.md)` link in the summary

---

## Sub-article Template

```markdown
# Topic Name — Deep Dive

> **Level:** Intermediate | Advanced
> **Pre-reading:** [NN · Parent](NN-section.md) · [NN.XX · Related](NN.XX-related.md)

---

## Section ...

---

??? question "Interview question?"
    Answer in 2–4 lines.

--8<-- "_abbreviations.md"
```

---

## Style Rules

- Tables are the primary structure for comparisons
- Every sub-article needs at least one Mermaid diagram
- End every article with 2–3 `??? question` blocks
- Always blank line before lists
- Never use `|` in Mermaid node labels — use `·` instead
- Always include `--8<-- "_abbreviations.md"` at the bottom

---

## Build Commands

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m mkdocs serve   # → http://127.0.0.1:8000
python3 -m mkdocs build
```
