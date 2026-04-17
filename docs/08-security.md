# 08 · AI Security & Governance { #security }

> **Security is not optional in AI systems. LLMs introduce entirely new attack surfaces that traditional application security does not cover.**

---

## The New Threat Surface

Traditional application security concerns (SQL injection, XSS, CSRF) still apply. But AI systems add:

| New Threat | Description |
|:-----------|:-----------|
| **Prompt Injection** | Attacker embeds instructions in data the agent reads |
| **Indirect Prompt Injection** | Malicious content in a JIRA ticket hijacks the agent |
| **Data Exfiltration via LLM** | Agent leaks sensitive code to external LLM API |
| **Hallucinated Exploits** | Agent generates code with subtle security vulnerabilities |
| **Insecure tool chaining** | Agent uses broad-scoped credentials unintentionally |
| **Training data poisoning** | Compromised codebase poisons the RAG index |
| **Model inversion** | Sensitive data in prompts reconstructed from model |

---

## Security Architecture Principles

| Principle | Application |
|:----------|:-----------|
| **Least privilege** | Each MCP server uses minimal-scope credentials |
| **Input validation** | All external data sanitised before entering agent context |
| **Output validation** | All agent outputs validated before execution |
| **Human gates** | Irreversible actions always require human approval |
| **Audit logging** | All agent actions logged with full context |
| **Scope limiting** | Agent can only modify files in the identified service |
| **Secrets never in context** | Secrets injected at runtime, never in prompts or state |

---

## Risk by Action Type

| Action | Risk Level | Control |
|:-------|:-----------|:--------|
| Read JIRA ticket | Low | Input sanitisation only |
| Read code files | Low | Scope limit to identified service |
| Write code to branch | Medium | Output validation + diff size limit |
| Run tests locally | Medium | Sandboxed container, no prod access |
| Create PR | High | Human approval interrupt |
| Post JIRA comment | Medium | Content review before posting |
| Merge PR | Critical | Always human-only |
| Deploy to environment | Critical | Always human-only |

---

→ **[Deep Dive: Prompt Injection & LLM Attacks](08.01-prompt-injection.md)**  
→ **[Deep Dive: Data Privacy in AI Pipelines](08.02-data-privacy.md)**  
→ **[Deep Dive: Guardrails & Policy Enforcement](08.03-guardrails.md)**

---

## Compliance Considerations

| Regulation | Relevant Concern |
|:-----------|:----------------|
| **GDPR / CCPA** | Don't send PII from JIRA/code to external LLM APIs |
| **SOC 2** | Audit trail of all AI agent actions and decisions |
| **ISO 27001** | AI systems must be part of information security policy |
| **Industry-specific** | Finance/healthcare may prohibit sending code to external APIs |

!!! warning "Cloud LLM API Data Retention"
    Most LLM providers (OpenAI, Anthropic) confirm they do not train on API calls, but you should verify current data processing agreements. For sensitive codebases, consider self-hosted models (LLaMA, Mistral) or enterprise agreements with zero-retention guarantees.

---

--8<-- "_abbreviations.md"
