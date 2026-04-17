<!-- LLM Core Concepts -->
*[LLM]: Large Language Model — a deep learning model trained on massive text corpora to generate and reason over language.
*[LLMs]: Large Language Models — deep learning models trained on massive text corpora to generate and reason over language.
*[RAG]: Retrieval-Augmented Generation — technique that retrieves relevant context from a knowledge store and injects it into the LLM prompt before generating a response.
*[Token]: The atomic unit of text processed by an LLM — roughly 3/4 of a word in English.
*[Tokens]: The atomic units of text processed by an LLM — roughly 3/4 of a word in English.
*[Context Window]: The maximum number of tokens an LLM can process in a single forward pass — inputs + outputs combined.
*[Embedding]: A dense numerical vector representing the semantic meaning of text; similar meaning produces similar vectors.
*[Embeddings]: Dense numerical vectors representing the semantic meaning of text; similar meaning produces similar vectors.
*[Temperature]: A sampling parameter controlling output randomness — 0 is deterministic, 1+ is creative/random.
*[Hallucination]: When an LLM generates plausible-sounding but factually incorrect information not grounded in its context.

<!-- Agent Concepts -->
*[Agent]: An AI system where an LLM acts as a reasoning engine that perceives inputs, plans actions, uses tools, and iterates toward a goal.
*[ReAct]: Reason + Act — an agent pattern that interleaves chain-of-thought reasoning with tool use, alternating until a final answer is reached.
*[Tool Use]: The ability of an LLM to invoke external functions (APIs, file system, databases) based on structured function call outputs.
*[HITL]: Human-in-the-Loop — a workflow design where a human must approve agent actions before irreversible steps execute.
*[Agentic]: Describing systems where AI autonomously plans and executes multi-step tasks with minimal human intervention per step.

<!-- Orchestration -->
*[LangGraph]: An orchestration framework (built on LangChain) for building stateful, graph-based AI agent workflows with conditional branching and loops.
*[LangChain]: A Python framework for composing LLM chains, RAG pipelines, and tool-using agents.
*[Spring AI]: Java/Spring Boot native library for integrating LLMs, RAG, and tool calling into Spring microservices.
*[Checkpointer]: A LangGraph component that persists graph state to a storage backend, enabling long-running and resumable agent workflows.

<!-- MCP -->
*[MCP]: Model Context Protocol — an open standard by Anthropic for how AI models communicate with external tool servers using JSON-RPC 2.0.
*[MCP Server]: A process that exposes tools, resources, and prompts to any MCP-compatible AI client over stdio or HTTP transport.

<!-- RAG Components -->
*[Vector DB]: A database optimised for storing and searching high-dimensional embedding vectors using approximate nearest neighbour algorithms.
*[Vector Database]: A database optimised for storing and searching high-dimensional embedding vectors using approximate nearest neighbour algorithms.
*[pgvector]: An open-source PostgreSQL extension that adds vector storage and similarity search capabilities.
*[Weaviate]: An open-source vector database with a GraphQL API and support for hybrid search and multi-tenancy.
*[Qdrant]: A high-performance, Rust-based open-source vector database with cloud and self-hosted options.
*[ChromaDB]: An embeddable, lightweight vector database designed for local development and prototyping.
*[Pinecone]: A fully managed cloud vector database with a serverless tier and simple REST API.
*[Reranker]: A cross-encoder model that re-scores retrieved documents against a query with higher precision than embedding similarity alone.
*[Chunking]: The process of splitting documents into smaller segments before embedding, to improve retrieval precision.
*[HyDE]: Hypothetical Document Embeddings — a RAG technique that generates a hypothetical ideal answer and embeds it for retrieval, producing better similarity matches.
*[BM25]: Best Match 25 — a classical keyword-based scoring algorithm used in full-text search; the foundation of Elasticsearch relevance scoring.

<!-- Security -->
*[Prompt Injection]: An attack where malicious text embedded in LLM input overrides the developer's instructions, redirecting the model's behaviour.
*[PII]: Personally Identifiable Information — any data that can identify a specific individual, subject to GDPR/CCPA regulations.
*[Guardrails]: Validation layers that inspect LLM inputs and outputs to enforce organisational policy, independent of the model's own instruction following.
*[Zero-trust]: A security model where no entity (user, service, agent) is trusted by default; every access request is authenticated and authorised.

<!-- Dev Tooling -->
*[Playwright]: A Microsoft open-source end-to-end testing framework for web applications, supporting Chromium, Firefox, and WebKit.
*[OpenAPI]: A standard specification (formerly Swagger) for describing REST APIs in YAML or JSON, enabling code generation and contract testing.
*[AST]: Abstract Syntax Tree — a tree representation of source code structure used by compilers and code analysis tools.
*[JIRA]: Atlassian's project management and issue tracking platform, widely used in software teams for stories, bugs, and sprints.
*[CI/CD]: Continuous Integration / Continuous Delivery — automated pipelines that build, test, and deploy code on every change.
*[RCA]: Root Cause Analysis — a structured investigation to identify the underlying cause of a failure, not just its symptoms.

<!-- Models -->
*[GPT-4o]: OpenAI's flagship multimodal model with 128K context window — strong on code, function calling, and structured outputs.
*[Claude]: Anthropic's LLM family — Claude 3.5 Sonnet and Claude 4 are known for long-context instruction following and precise code generation.
*[LLaMA]: Meta's open-source LLM family — LLaMA 3 70B is the preferred self-hosted option for code tasks.
*[Mistral]: An efficient, open-weights European LLM known for multilingual capability and self-hosting-friendly licensing.
*[Ollama]: A tool for running open-source LLMs locally on a Mac, Linux, or Windows machine with a simple CLI and REST API.
