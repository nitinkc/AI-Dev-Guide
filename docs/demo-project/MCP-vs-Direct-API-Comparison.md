# MCP Servers vs. Direct API Calls — Decision Guide

> **Quick Answer:** Use **MCP servers** for production and multi-client scenarios. Use **direct API calls** for quick local prototypes and simple scripts.

---

## Side-by-Side Comparison

| Aspect | MCP Servers | Direct API Calls |
|:-------|:-----------|:-----------------|
| **Setup Time** | 2–3 hours (build + test server) | 15–30 mins (add requests library calls) |
| **Code Complexity** | Higher (separate service, HTTP layer) | Lower (inline in agent) |
| **Credentials Management** | Centralized (one place to rotate) | Scattered (every agent file that calls APIs) |
| **Testability** | High (MCP server can be tested in isolation) | Medium (harder to mock without DI) |
| **Reusability** | High (any client can use the server) | Low (agent-specific) |
| **Latency** | +5–50ms (IPC or HTTP overhead) | Minimal (direct call) |
| **Scaling** | Independent (scale MCP separately) | Coupled to agent |
| **Security Boundaries** | Clear (separate process, own credentials) | Blurred (agent has all credentials) |
| **Token Cost** | Same (no difference in API calls) | Same (no difference in API calls) |
| **Debugging** | Easier (centralized logs, retry logic) | Harder (scattered across agent code) |
| **Swappability** | Easy (swap JIRA for Linear without touching agent) | Hard (requires agent refactoring) |
| **Learning Curve** | Moderate (need MCP protocol + FastAPI) | Low (just use requests library) |
| **Production-Ready** | Yes (industry standard) | No (anti-pattern in production) |

---

## When to Use MCP Servers

### ✅ **Use MCP When:**

1. **Multiple Clients Need the Same Tools**
   - Agent + Cursor IDE + Claude Desktop all need GitHub access
   - One MCP server = all three clients work the same way

2. **Production Deployment**
   - Tools are shared by a team
   - Credentials rotate frequently
   - Need audit logs and rate-limiting

3. **You Plan to Swap Integrations**
   - "Replace JIRA with Linear"
   - "Add Slack notifications"
   - MCP keeps agent code unchanged

4. **Security-Critical Operations**
   - Separate process = separate credentials = least privilege
   - Example: Read-only JIRA token on one server, write-only GitHub on another

5. **Long-Term Maintenance**
   - Rate limiting logic lives in one place
   - Retry policies centralized
   - All clients benefit from improvements

6. **Enterprise/SaaS**
   - Multi-tenant: each customer has own MCP server instance
   - Compliance: audit trail of tool usage

### Example: **Production Architecture**
```
┌─────────────────────────────────────────┐
│  Chat Engine (LangGraph Agent)          │
├─────────────────────────────────────────┤
│ Uses: HTTP client to call MCP servers   │
└────────────┬─────────────┬──────────────┘
             │             │
      ┌──────▼──┐    ┌─────▼──────┐
      │ JIRA    │    │ GitHub     │
      │ MCP     │    │ MCP        │
      │ :8001   │    │ :8002      │
      └──────┬──┘    └─────┬──────┘
             │             │
        JIRA API      GitHub API
```

→ **Cost**: Extra 2–3 hours to build, saves 10+ hours in production maintenance.

---

## When to Use Direct API Calls

### ✅ **Use Direct API Calls When:**

1. **Local Development & Testing**
   - Quick iteration on agent logic
   - Don't want to manage multiple processes locally

2. **Simple Script (Not Agent)**
   - One-off ticket processing
   - No need for reusability

3. **Proof-of-Concept / MVP**
   - Validating idea before committing to architecture
   - "Does this workflow even make sense?"

4. **Single-Purpose Agent**
   - Agent only talks to one service
   - Will never be shared or extended

### Example: **Quick Local Prototype**
```python
# agent/nodes.py
import requests

def fetch_ticket_direct(state):
    """Direct API call — no MCP server."""
    token = os.getenv("JIRA_TOKEN")
    resp = requests.get(
        f"{JIRA_URL}/rest/api/3/issue/{state['ticket_key']}",
        headers={"Authorization": f"Bearer {token}"}
    )
    return {...state, 'ticket': resp.json()}
```

→ **Speed**: Prototype working in 30 mins. But DON'T ship this to production.

---

## Code Examples: Head-to-Head

### Scenario: Fetch JIRA Ticket

#### Option A: Direct API Call (❌ Not Recommended for Production)
```python
# agent/nodes.py
import requests
import os

def fetch_ticket_direct(state):
    """ANTI-PATTERN: credentials in agent code."""
    jira_url = os.getenv("JIRA_BASE_URL")
    token = os.getenv("JIRA_TOKEN")  # ❌ Direct access to secret
    
    resp = requests.get(
        f"{jira_url}/rest/api/3/issue/{state['ticket_key']}",
        headers={
            "Authorization": f"Basic {base64.b64encode(f'user:{token}'.encode()).decode()}",
            "Accept": "application/json"
        },
        timeout=10
    )
    
    if resp.status_code == 404:
        return {...state, 'error': 'Ticket not found'}
    
    resp.raise_for_status()
    data = resp.json()
    
    return {
        **state,
        'ticket_summary': data['fields']['summary'],
        'ticket_description': data['fields']['description'],
        'ticket_type': data['fields']['issuetype']['name'],
        # ... more fields
    }
```

**Problems:**
- Credentials embedded in agent code ❌
- No retry logic
- Error handling scattered
- Hard to test
- Can't reuse from Cursor IDE

---

#### Option B: MCP Server (✅ Production-Ready)

**Agent code (simple):**
```python
# agent/nodes.py
from agent.mcp_clients import jira_mcp_client

def fetch_ticket_via_mcp(state):
    """Clean: delegate to MCP server."""
    try:
        ticket = jira_mcp_client.call_tool(
            "get_ticket",
            {"issue_key": state['ticket_key']}
        )
        return {
            **state,
            'ticket_summary': ticket['summary'],
            'ticket_description': ticket['description'],
            'ticket_type': ticket['type'],
        }
    except Exception as e:
        return {...state, 'error': f"Failed to fetch: {e}"}
```

**MCP Server code (reusable):**
```python
# jira_mcp/server.py
from fastapi import FastAPI
import boto3
import requests
import base64

app = FastAPI()

def get_jira_credentials():
    """Fetch from Secrets Manager — NEVER in code."""
    sm = boto3.client('secretsmanager')
    return json.loads(
        sm.get_secret_value(SecretId='taskmaster/jira')['SecretString']
    )

@app.post("/tools/call")
def call_tool(call: ToolCall):
    if call.name == "get_ticket":
        return get_ticket(call.arguments['issue_key'])
    # ... other tools

def get_ticket(issue_key: str):
    creds = get_jira_credentials()
    resp = requests.get(
        f"{creds['base_url']}/rest/api/3/issue/{issue_key}",
        headers={...},
        timeout=10
    )
    resp.raise_for_status()
    # ... structured response
```

**Benefits:**
- Credentials in AWS Secrets Manager ✅
- Retry logic in one place
- Can be called from any client
- Proper error handling
- Easy to test in isolation

---

## Performance Comparison

```
Scenario: Agent calls get_ticket() 100 times

Direct API Call:
├─ First call: 150ms (JIRA API latency)
├─ Avg: 145ms
└─ Total: 14.5 seconds (no overhead)

Via MCP Server (sidecar):
├─ HTTP to MCP: 2ms
├─ MCP calls JIRA API: 150ms
├─ Response: 2ms
├─ Avg: 154ms
└─ Total: 15.4 seconds (+6% slower, negligible)

Via MCP Server (remote):
├─ HTTP to MCP: 50ms (network round trip)
├─ MCP calls JIRA API: 150ms
├─ Response: 50ms
├─ Avg: 250ms
└─ Total: 25 seconds (+72% slower, noticeable)
```

**Takeaway:** Use **sidecar MCP servers** (same container/task) to avoid network latency.

---

## Credentials Security Comparison

### Direct API Calls (❌ Not Secure)
```python
# .env file
JIRA_TOKEN=xxx  # Plain text in git? NO!
GITHUB_TOKEN=yyy

# agent/main.py
os.getenv("JIRA_TOKEN")  # Hardcoded in agent logic
```

**Problems:**
- Token in memory for duration of agent lifecycle
- Agent code can log the token
- Multiple services might share same token
- No audit trail

---

### MCP Server (✅ Secure)
```python
# MCP server boots up
def get_jira_credentials():
    sm = boto3.client('secretsmanager')
    secret = sm.get_secret_value(SecretId='taskmaster/jira')
    return json.loads(secret['SecretString'])
    # Token fetched ONCE per request, discarded after use

@app.post("/tools/call")
def call_tool(call):
    creds = get_jira_credentials()  # Fetch fresh token
    # Make API call
    # Token goes out of scope and is GC'd
```

**Benefits:**
- Token never in agent memory
- Rotated independently per service
- Audit trail: AWS CloudTrail logs who accessed the secret
- Separate credentials for read vs. write operations

---

## Migration Path

### If You Start with Direct API Calls:

**Week 1:** Local prototype works with direct calls
```python
requests.get(f"{JIRA_URL}/issue/{key}")  # ✅ Fast iteration
```

**Week 2:** Want to test from Cursor IDE
```
# Cursor can't call your agent code directly
# → Must extract to MCP server
```

**Week 3:** Build MCP server, agent now calls it
```python
jira_mcp_client.call_tool("get_ticket", {...})  # ✅ Reusable
```

**Week 4:** Deploy to AWS
```
# Start MCP sidecar container in ECS task
# Agent calls localhost:8001
# Everyone wins
```

---

## Recommendation Matrix

```
                 ┌─────────────────────────────────────┐
                 │     Use Case / Timeline             │
    ─────────────┼──────────────┬──────────────────────┤
    │ Local Dev  │ DIRECT CALLS │ DIRECT CALLS        │
    │ (< 1 week) │              │                     │
    ├────────────┼──────────────┼──────────────────────┤
    │ Quick PoC  │ DIRECT CALLS │ DIRECT CALLS        │
    │ (1-2 wks)  │              │                     │
    ├────────────┼──────────────┼──────────────────────┤
    │ Shared Dev │ MCP SERVERS  │ MCP SERVERS        │
    │ (2-4 wks)  │              │                     │
    ├────────────┼──────────────┼──────────────────────┤
    │ Production │ MCP SERVERS  │ MCP SERVERS        │
    │ (4+ wks)   │ (REQUIRED)   │ (REQUIRED)         │
    └────────────┴──────────────┴──────────────────────┘
```

---

## For the TaskMaster Demo

### Our Recommendation: **Hybrid Approach**

**Phase 1 (This Week): Local Development**
```python
# Use DIRECT API calls for speed
def fetch_ticket(state):
    return jira_api.get_issue(state['ticket_key'])
```

**Phase 2 (Next Week): Build MCP Servers**
```python
# Refactor into FastAPI MCP servers
# Test with docker-compose locally
```

**Phase 3 (Week 3+): Deploy to AWS**
```
# Run MCP containers as ECS sidecars
# Production-grade credentials via Secrets Manager
```

**This way:**
- ✅ You prototype fast
- ✅ You learn MCP patterns
- ✅ You end up with production-ready code
- ✅ You can share the MCP servers with team

---

## Q&A

??? question "Can I use MCP servers locally without Docker?"
    Yes! Use **stdio transport** (local pipes) instead of HTTP. But for the demo, HTTP sidecars are simpler to test.

??? question "Is there a performance penalty for MCP?"
    Only 2–5ms added latency for sidecar MCP. Negligible compared to JIRA/GitHub API calls (100–500ms). Network MCP adds 50ms+ (avoid for performance-critical paths).

??? question "Can I use both direct calls AND MCP in the same agent?"
    Not recommended. Pick one pattern and stick with it. Mixing creates maintenance chaos. But you CAN transition from direct → MCP gradually.

??? question "What if JIRA/GitHub rates limit us?"
    **Direct calls:** Rate limiting logic scattered in agent code. **MCP servers:** Centralized queue + retry logic in one place. MCP wins here.

??? question "Do I need separate MCP servers for read vs. write?"
    Best practice: yes. One JIRA MCP server with read-only token for `get_ticket`, another with write token for `post_comment`. This enforces least privilege.

--8<-- "_abbreviations.md"

