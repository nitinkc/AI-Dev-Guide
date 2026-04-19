# Visual Guide: MCP vs Direct API — At a Glance

---

## Architecture Comparison

### Option A: Direct API Calls (Week 1)
```
┌──────────────────────────────────┐
│   LangGraph Agent                │
│  (in agent/nodes.py)             │
├──────────────────────────────────┤
│                                  │
│  def fetch_ticket(state):        │
│      token = os.getenv("TOKEN")  │ ← Direct credentials
│      resp = requests.get(...)    │
│      return {...state, ...}      │
│                                  │
│  def create_branch(state):       │
│      token = os.getenv("TOKEN")  │ ← Direct credentials
│      resp = requests.post(...)   │
│      return {...state, ...}      │
│                                  │
└──────────────────────────────────┘
         │                │
         ↓                ↓
    JIRA API          GitHub API
   (DIRECT)          (DIRECT)
```

**Pros:** Simple, fast to code (2 hrs)
**Cons:** Credentials scattered, not reusable, hard to test

---

### Option B/C: MCP Servers (Week 2)
```
┌──────────────────────────────────────────────────────────┐
│   LangGraph Agent                                        │
│   (clean, focuses on logic only)                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  def fetch_ticket(state):                                │
│      ticket = jira_mcp_client.call_tool(...)  ← CLEAN    │
│      return {...state, 'ticket': ticket}                 │
│                                                          │
│  def create_branch(state):                               │
│      result = github_mcp_client.call_tool(...) ← CLEAN   │
│      return {...state, 'branch': result}                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
         │                                    │
         ↓ HTTP :8001                         ↓ HTTP :8002
┌──────────────────────┐           ┌──────────────────────┐
│  JIRA MCP Server     │           │ GitHub MCP Server    │
│  (FastAPI)           │           │ (FastAPI)            │
├──────────────────────┤           ├──────────────────────┤
│ ✅ Credentials in    │           │ ✅ Credentials in    │
│    Secrets Manager   │           │    Secrets Manager   │
│ ✅ Centralized logic │           │ ✅ Centralized logic │
│ ✅ Easy to test      │           │ ✅ Easy to test      │
└──────────────────────┘           └──────────────────────┘
         │                                    │
         ↓ HTTPS                              ↓ HTTPS
    JIRA API                            GitHub API
    (REMOTE)                            (REMOTE)
```

**Pros:** Secure, reusable, testable, production-ready
**Cons:** Takes longer to code (6 hrs), needs 2 extra processes

---

## Security: Credentials Handling

### Direct API Calls (❌ Not Secure)
```
┌─────────────────────────────────┐
│  Agent Process                  │
├─────────────────────────────────┤
│                                 │
│  JIRA_TOKEN = "xxx"  ← IN MEMORY│
│  GITHUB_TOKEN = "yyy" ← IN MEMORY
│                                 │
│  # Agent code can leak tokens   │
│  if error:                      │
│      log(JIRA_TOKEN)  ← 💥 LEAK │
│                                 │
└─────────────────────────────────┘
```

**Problems:**
- Credentials in agent process memory ❌
- If agent crashes and logs, credentials exposed ❌
- Multiple agents = duplicate credentials ❌
- No audit trail ❌

---

### MCP Servers (✅ Secure)
```
┌─────────────────────────────────────────────────────────┐
│  Agent Process                   │  JIRA MCP Process   │
├────────────────────────────────┬──────────────────────┤
│                                │                      │
│  tickets = mcp_call(...)       │  Fetch secret at:   │
│  (no credentials in scope)     │  - Request time     │
│                                │  - Use once         │
│                                │  - Discard after    │
│                                │  (not in memory)    │
│                                │                     │
└────────────────────────────────┴──────────────────────┘
```

**Benefits:**
- No credentials in agent ✅
- Credentials fetched fresh per request ✅
- Automatic credential rotation ✅
- AWS CloudTrail audit log ✅

---

## Code Comparison: Side by Side

### Fetching a JIRA Ticket

#### Direct API (Simple but Messy)
```python
# agent/nodes.py
import requests, os

def fetch_ticket(state):
    # ⚠️ Direct access to secret
    token = os.getenv("JIRA_TOKEN")
    
    # ⚠️ HTTP error handling inline
    try:
        resp = requests.get(
            f"{os.getenv('JIRA_URL')}/issue/{state['key']}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        # ⚠️ Each node must handle errors
        return {...state, 'error': 'Timeout'}
    except requests.exceptions.HTTPError as e:
        # ⚠️ Error handling duplicated across all nodes
        return {...state, 'error': str(e)}
    
    data = resp.json()
    return {...state, 'ticket': data}
```

**Problems:**
- Error handling duplicated in every node ❌
- Token in memory for duration of process ❌
- Hard to test without mocking requests ❌
- Not reusable from other clients ❌

---

#### MCP Server (Clean and Secure)
**MCP Server:**
```python
# jira_mcp/server.py
from fastapi import FastAPI

app = FastAPI()

def get_jira_secret():
    # ✅ Fresh fetch each request
    sm = boto3.client('secretsmanager')
    return json.loads(sm.get_secret_value(SecretId='taskmaster/jira')['SecretString'])

@app.post("/tools/call")
def call_tool(call: ToolCall):
    if call.name == "get_ticket":
        creds = get_jira_secret()  # ✅ Secret fetched now
        resp = requests.get(
            f"{creds['url']}/issue/{call.arguments['issue_key']}",
            headers={...},
            timeout=10
        )
        resp.raise_for_status()
        return resp.json()  # ✅ Secret goes out of scope
```

**Agent:**
```python
# agent/nodes.py
from mcp_clients import jira_mcp_client

def fetch_ticket(state):
    # ✅ Clean: just call the tool
    ticket = jira_mcp_client.call_tool(
        "get_ticket",
        {"issue_key": state['key']}
    )
    return {...state, 'ticket': ticket}
```

**Benefits:**
- Credentials never in agent ✅
- Error handling in one place ✅
- Easy to test MCP independently ✅
- Agent code is clean ✅

---

## Timeline & Effort

### Week 1: Direct API (Option A)
```
Monday AM     : 1.5 hrs → JIRA client code + tests
Monday PM     : 1.5 hrs → GitHub client code + tests
Tuesday AM    : 1 hr    → Wire into agent nodes
Tuesday PM    : 1 hr    → Test E2E
────────────────────────────────────────
Total         : ~5 hours
Result        : ✅ Working demo (but not production-ready)
```

---

### Week 1 + Week 2: Hybrid (Option C — RECOMMENDED)
```
Week 1 (As above)
├─ Direct API: 3 hours
├─ Result: Working demo ✅

Week 2
├─ Extract client → FastAPI: 1.5 hrs
├─ Build docker-compose: 0.5 hrs
├─ Test locally: 1 hr
├─ Deploy to AWS: 0.5 hrs
├─────────────────────────────────
└─ Total: 3 more hours
└─ Result: Production-ready MCP servers ✅
```

---

### Week 1 Only: Full MCP (Option B)
```
Monday AM     : 2 hrs   → JIRA MCP server
Monday PM     : 2 hrs   → GitHub MCP server
Tuesday AM    : 1 hr    → Wire agent to MCP
Tuesday PM    : 1 hr    → Test docker-compose
────────────────────────────────────────
Total         : 6 hours
Result        : ✅ Production-ready from day 1
             : (No refactoring needed)
```

---

## Decision Matrix: Effort vs Benefit

```
           Direct API    MCP Servers
           (Week 1)      (Week 2 Refactor)

Speed      ████░░░░░░    ██████░░░░
           3 hours       6 hours

Quality    ███░░░░░░░    ██████████
           Not prod      Production

Reuse      ░░░░░░░░░░    ██████████
           Not reusable  Fully reusable

Security   ██░░░░░░░░    ██████████
           Poor          Excellent

Effort     Easy          Moderate
           (Pros know    (Needs FastAPI,
            requests lib) Docker basics)
```

---

## When to Choose Each Option

### Choose Direct API Calls IF:
```
✓ "I need a working demo by tomorrow"
✓ "I just want to validate the concept"
✓ "I'm building a one-off script"
✓ "My team doesn't care about credentials safety"
✓ "I have only 3 hours available"

Timeline: 3 hours to working code
Cost: None
Production-ready: No
```

---

### Choose MCP Servers IF:
```
✓ "I need production-ready code"
✓ "Multiple clients will use these tools"
✓ "Security/compliance matters"
✓ "I want to swap integrations later (JIRA→Linear)"
✓ "I have 5–6 hours for a better solution"

Timeline: 5–6 hours (or 3+3 with hybrid)
Cost: None
Production-ready: Yes
```

---

### Choose Hybrid IF (RECOMMENDED):
```
✓ "I want a working demo quickly"
✓ "AND I want production-ready code"
✓ "AND I have 6 hours total (spread over 2 weeks)"

Week 1: 3 hours → Direct API demo
Week 2: 3 hours → Refactor to MCP servers

Timeline: 3 hours + 3 hours = 6 hours
Cost: None
Production-ready: Yes (after Week 2)
Demo available: Yes (after Week 1)
```

---

## The 30-Second Decision

```
START HERE
    ↓
Am I building → NO → Use Direct API
production code?     (3 hours, not prod)
    ↓ YES
    ↓
Do I have → NO → Use Direct API now
5–6 hours?        Refactor Week 2
    ↓ YES         (Hybrid: recommended)
    ↓
Use MCP from start
(6 hours, fully prod)
```

---

## Bottom Line

| Approach | Speed | Quality | When |
|:---------|:-----:|:-------:|------|
| Direct API | ⭐⭐⭐⭐⭐ | ⭐ | Quick validation |
| Hybrid (A→B) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **RECOMMENDED** |
| MCP from start | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | If you have time |

**Recommendation:** Start with Direct API (3 hrs), refactor to MCP (3 hrs).
**Result:** Demo ready Day 2. Production ready Day 8.

---

## Visual Timeline

```
NOW:
├─ Read [MCP-Decision-OnePager](MCP-Decision-OnePager.md)    (3 mins)
├─ Read [Implementation-Quickstart](Implementation-Quickstart.md)    (10 mins)
└─ Decision: Hybrid Approach

WEEK 1 (Days 1–2):
├─ Follow [Week1-Checklist](Week1-Checklist.md)    (3 hours)
├─ Build direct API version
└─ ✅ Demo works: fetch JIRA → generate code → create PR

WEEK 2 (Days 3–4):
├─ Read [07-mcp-servers](07-mcp-servers.md) for reference    (1 hour)
├─ Refactor direct clients → FastAPI MCP servers    (2 hours)
└─ ✅ Production-ready MCP servers, AWS-deployable

WEEK 2+ (Days 5+):
├─ Deploy to AWS ECS
└─ ✅ Running in production
```

---

**Next action:** Open [MCP-Decision-OnePager](MCP-Decision-OnePager.md) (3 mins) or jump to [Week1-Checklist](Week1-Checklist.md) (to start coding).

--8<-- "_abbreviations.md"

