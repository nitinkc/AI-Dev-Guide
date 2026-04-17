# 10 · Interview Q&A { #interview-qa }

> **Common interview questions on AI engineering, agentic systems, and LLM applications.**  
> Each question targets senior developer or architect-level interviews.

---

## LLM Fundamentals

??? question "What is the difference between fine-tuning and RAG? When would you use each?"
    **Fine-tuning** bakes knowledge into model weights — best for consistent style, tone, and behavioural patterns that don't change. **RAG** retrieves knowledge at inference time from an external store — best for frequently changing facts (codebase, docs). For dev automation: RAG for codebase knowledge (changes every PR), possibly fine-tuning for coding style conventions (changes quarterly at most). In most cases, start with RAG and only add fine-tuning if quality is insufficient.

??? question "How does the context window limit affect agent design?"
    Agents operating on large codebases can't fit everything in context. Solutions: (1) RAG to retrieve only relevant chunks, (2) context compression to reduce retrieved content size, (3) map-reduce patterns for large files, (4) conversational summarisation (compress older messages). Design specifically for the token budget — estimate tokens per step and ensure the total stays under ~70% of the context window to leave room for outputs.

??? question "What is temperature and when would you set it to 0?"
    Temperature controls output randomness. `temperature=0` makes the model deterministic — always the top token. Set to 0 for: code generation (reproducible, reviewable), JSON schema outputs (structured and valid), any task where you want consistent repeatable results. Use higher temperature (0.3–0.7) for: writing commit messages, generating PR descriptions, explanation text where variation is acceptable.

---

## Agentic Systems

??? question "What is the ReAct pattern and why is it important for dev automation?"
    ReAct (Reason + Act) interleaves reasoning steps with tool calls. Instead of a single LLM call, the agent thinks about its next action, calls a tool, observes the result, and repeats. Critical for dev automation because you can't write a correct bug fix without first reading the actual buggy code — the agent must gather evidence iteratively. Pure chain-of-thought fails for code tasks because it reasons without seeing reality.

??? question "How do you prevent an agent from modifying the wrong microservice?"
    Multiple layers: (1) scope the agent's file system tool to a working directory for the identified service, (2) explicitly list allowed paths in the system prompt, (3) add an output validator that rejects diffs touching paths outside the allowed scope, (4) use a JIRA component→service mapping table to identify the correct service before any code operations begin.

??? question "Describe a human-in-the-loop pattern for a code generation agent."
    LangGraph's `interrupt()` pauses graph execution before irreversible actions — specifically, before PR creation. The agent generates the diff and tests, persists state (PostgreSQL checkpointer), then sends a notification to the developer. The developer reviews via a web UI or Slack, clicks approve/reject. If approved, the agent resumes from the checkpoint and calls the GitHub API. If rejected with feedback, the agent revises and presents again. The PR is never created without explicit human approval.

---

## RAG & Retrieval

??? question "What chunking strategy would you use for a Java Spring Boot codebase?"
    AST-based chunking: parse each `.java` file using Tree-sitter, split at class and method boundaries. One chunk per method (500–1500 tokens), including the method signature, annotations, and body. Add metadata: `{ service, filename, class, method, last_modified }`. This keeps method context intact and enables metadata filtering by service name before vector search. Never use character-count splitting for code — it breaks logical units.

??? question "What is hybrid search and when is it better than pure vector search?"
    Hybrid search combines vector similarity (semantic) with keyword/BM25 matching. Pure vector search handles conceptual queries well ("find the payment logic") but misses exact identifier matches ("PaymentServiceImpl.processRefund"). BM25 handles exact terms but misses synonyms and paraphrasing. For code search: always use hybrid — most dev queries mix a natural language description with technical identifiers. Weaviate and LangChain's EnsembleRetriever support hybrid search natively.

---

## MCP & Tool Design

??? question "What is MCP and why is it significant?"
    Model Context Protocol is an open standard (from Anthropic) for how LLMs communicate with external tools. Before MCP, every AI framework invented its own tool interface. MCP provides a universal JSON-RPC 2.0 protocol: any MCP-compatible client (Claude, Cursor, GitHub Copilot) can use any MCP server. Write a GitHub MCP server once, use it from any AI tool. It's the USB-C of AI tool integration.

??? question "How would you secure a JIRA MCP server in a CI/CD pipeline?"
    Use short-lived tokens via OIDC federation — the CI workflow exchanges a GitHub OIDC token for a JIRA API token via a secrets manager (AWS Secrets Manager or Vault). The token is scoped to read-only for ticket retrieval and write-scoped only for posting comments. Never store tokens in the workflow YAML. The MCP server process receives the token via environment variable at startup and never persists it. Tokens expire after the workflow ends.

---

## Security

??? question "What is indirect prompt injection and how do you mitigate it?"
    Indirect injection: attacker doesn't control the prompt directly but embeds malicious instructions in data the agent reads — a JIRA ticket comment, a README file, a code comment. Mitigations: (1) structural separation — all external data in clearly delimited sections of the prompt, (2) input sanitisation — scan for known injection patterns before inserting into context, (3) output validation — validate the scope of every tool call against the intended task, (4) minimal tool access — if the agent can only call tools with limited blast radius, a successful injection causes little harm.

??? question "Would you send proprietary source code to OpenAI or Anthropic's API?"
    It depends on the organisation's risk tolerance and the API agreement. Both providers offer zero-data-retention enterprise APIs. For most commercial codebases, this is acceptable with the enterprise agreement in place. For regulated industries (finance, defence, healthcare with raw patient references in code), use self-hosted LLMs (LLaMA 3 or Mistral via Ollama/vLLM) or Azure OpenAI with data residency guarantees. Always audit what's being sent — use a PII/secret scanner before every API call.

---

## Trade-off Tables

| Decision | Option A | Option B | Recommendation |
|:---------|:---------|:---------|:--------------|
| **Orchestration** | LangGraph (explicit graph) | CrewAI (role-based) | LangGraph for production; CrewAI for prototypes |
| **Vector DB** | pgvector | Pinecone | pgvector if already on Postgres; Pinecone for managed scale |
| **LLM for code** | GPT-4o | Claude 3.5 Sonnet | Both strong; Claude edges ahead on long-context instruction following |
| **Indexing trigger** | Full re-index (scheduled) | PR merge webhook | Webhook for freshness; full re-index as weekly fallback |
| **Model hosting** | Cloud API (OpenAI/Anthropic) | Self-hosted (LLaMA) | Cloud API for quality; self-host for data sovereignty |
| **Tool interface** | LangChain tools | MCP servers | MCP for cross-client reuse; LangChain tools for pipeline-specific logic |

---

--8<-- "_abbreviations.md"
