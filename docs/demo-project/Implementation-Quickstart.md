# Implementation Quick-Start: Choose Your Path

> **TL;DR:** Start with **direct API calls** for local dev (save 2 hours), then refactor to **MCP servers** when you deploy (take 3 hours).

---

## Your Demo Timeline Options

### Option A: Direct API Calls Only (Fastest)
**Time to working demo:** 2–3 hours
```
Day 1: Wire JIRA API calls directly in agent
Day 1: Wire GitHub API calls directly in agent
Day 2: Test end-to-end locally
Day 2: Have a working demo running
```

**Trade-off:** Won't be production-ready, can't reuse code, credentials scattered

**Use this if:** You just want to validate the workflow concept by Friday.

---

### Option B: MCP Servers from the Start (Cleanest)
**Time to working demo:** 5–6 hours
```
Day 1 AM: Build JIRA MCP server container (~1.5h)
Day 1 PM: Build GitHub MCP server container (~1.5h)
Day 1 PM: Wire agent to call MCP via HTTP (~1h)
Day 2 AM: Test locally with docker-compose (~1h)
Day 2 AM: Have a production-ready demo
```

**Trade-off:** Takes longer upfront, but code is reusable and production-ready

**Use this if:** You have time and want to showcase best practices.

---

### Option C: Hybrid (Recommended)
**Time to working demo:** 3 hours + 3 hours refactor later
```
WEEK 1 (Local Dev — 3 hours):
└─ Use direct API calls to get agent working fast
└─ Demonstrate workflow to stakeholders
└─ Validate JIRA/GitHub integration

WEEK 2 (Production Ready — 3 hours):
└─ Extract direct calls into FastAPI MCP servers
└─ Test with docker-compose
└─ Deploy to AWS ECS with proper credentials
```

**Trade-off:** Best of both — move fast now, productionize later

**Use this if:** You're iterating with feedback and want flexibility.

---

## Quick Comparison: What You Code

### Direct API Calls (Option A)

```python
# agent/nodes.py — ~100 lines
import requests, os

def fetch_ticket(state):
    token = os.getenv("JIRA_TOKEN")
    resp = requests.get(
        f"{os.getenv('JIRA_URL')}/rest/api/3/issue/{state['ticket_key']}",
        headers={"Authorization": f"Bearer {token}"}
    )
    return {...state, 'ticket': resp.json()}

def create_branch(state):
    token = os.getenv("GITHUB_TOKEN")
    resp = requests.post(
        f"https://api.github.com/repos/.../git/refs",
        headers={"Authorization": f"Bearer {token}"},
        json={...}
    )
    return {...state, 'branch': resp.json()['ref']}

# ... 10 more functions like this
```

**Pros:** Quick to write, no extra processes
**Cons:** Messy, not reusable, credentials scattered, hard to test

---

### MCP Servers (Option B/C)

**jira_mcp/server.py** (~150 lines)
```python
from fastapi import FastAPI
import boto3, requests

app = FastAPI()

def get_jira_credentials():
    sm = boto3.client('secretsmanager')
    return json.loads(sm.get_secret_value(SecretId='taskmaster/jira')['SecretString'])

@app.get("/tools")
def list_tools():
    return {"tools": [
        {"name": "get_ticket", "description": "...", "inputSchema": {...}},
        {"name": "post_comment", "description": "...", "inputSchema": {...}},
    ]}

@app.post("/tools/call")
def call_tool(call: ToolCall):
    if call.name == "get_ticket":
        creds = get_jira_credentials()
        resp = requests.get(
            f"{creds['base_url']}/rest/api/3/issue/{call.arguments['issue_key']}",
            headers={...},
        )
        return {...}
```

**github_mcp/server.py** (~150 lines)
```python
# Same pattern for GitHub
```

**agent/nodes.py** (~80 lines)
```python
from agent.mcp_clients import jira_mcp_client, github_mcp_client

def fetch_ticket(state):
    ticket = jira_mcp_client.call_tool("get_ticket", {"issue_key": state['ticket_key']})
    return {...state, 'ticket': ticket}

def create_branch(state):
    result = github_mcp_client.call_tool("create_branch", {"branch_name": ...})
    return {...state, 'branch': result['branch']}
```

**Pros:** Clean, testable, reusable, secure credentials, production-ready
**Cons:** More code to write, need separate processes

---

## My Recommendation for Your Demo

### 🎯 **Use Option C: Start Direct, Refactor to MCP**

**Why?**
1. **Fast iteration:** Get something working TODAY to show stakeholders
2. **Learn as you go:** You'll understand both approaches
3. **Professional:** End result is production-grade
4. **Parallel work:** You can refactor MCP in parallel while others test

### Timeline

**Now (This Sprint):**
```python
# agent/jira_client.py
import requests

class JiraClient:
    def __init__(self):
        self.token = os.getenv("JIRA_TOKEN")
    
    def get_ticket(self, key):
        resp = requests.get(...)
        return resp.json()
```

**Next Sprint (When moving to AWS):**
```python
# Wrap the same logic in FastAPI
# jira_mcp/server.py

# Then in agent, swap:
# jira_client = JiraClient()  # OLD
# jira_mcp_client = MCPClient("http://localhost:8001")  # NEW
```

---

## Files to Create (Option C Approach)

### Week 1: Direct API Version

```
agent/
├── main.py                 ← LangGraph agent
├── nodes.py               ← State machine nodes
├── jira_client.py         ← Direct JIRA API calls
├── github_client.py       ← Direct GitHub API calls
├── mcp_clients.py         ← Placeholder (will fill in Week 2)
└── requirements.txt
```

### Week 2: Add MCP Servers

```
.
├── agent/                 ← Keep Week 1 code
├── jira_mcp/             ← NEW: FastAPI server
│   ├── server.py
│   ├── requirements.txt
│   └── Dockerfile
├── github_mcp/           ← NEW: FastAPI server
│   ├── server.py
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml    ← NEW: Run all 3 services locally
└── README.md
```

---

## Concrete Code: Option C Week 1 (Direct API)

### jira_client.py
```python
import requests
import os
from typing import dict

class JiraClient:
    def __init__(self):
        self.base_url = os.getenv("JIRA_BASE_URL")
        self.email = os.getenv("JIRA_EMAIL")
        self.token = os.getenv("JIRA_API_TOKEN")
    
    def _headers(self) -> dict:
        import base64
        auth = base64.b64encode(
            f"{self.email}:{self.token}".encode()
        ).decode()
        return {
            "Authorization": f"Basic {auth}",
            "Accept": "application/json",
        }
    
    def get_ticket(self, issue_key: str) -> dict:
        """Fetch ticket details."""
        resp = requests.get(
            f"{self.base_url}/rest/api/3/issue/{issue_key}",
            headers=self._headers()
        )
        resp.raise_for_status()
        data = resp.json()
        
        return {
            "key": data["key"],
            "summary": data["fields"]["summary"],
            "description": data["fields"]["description"],
            "type": data["fields"]["issuetype"]["name"],
            "status": data["fields"]["status"]["name"],
            "labels": data["fields"].get("labels", []),
        }
    
    def post_comment(self, issue_key: str, comment: str) -> dict:
        """Post a comment to a ticket."""
        body = {
            "body": {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": comment}],
                    }
                ],
            }
        }
        resp = requests.post(
            f"{self.base_url}/rest/api/3/issue/{issue_key}/comment",
            headers=self._headers(),
            json=body,
        )
        resp.raise_for_status()
        return {"success": True}
```

### github_client.py
```python
import requests
import os
import base64

class GitHubClient:
    def __init__(self):
        self.token = os.getenv("GITHUB_TOKEN")
        self.owner = os.getenv("GITHUB_OWNER")
        self.repo = os.getenv("GITHUB_REPO")
    
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
        }
    
    def create_branch(self, branch_name: str) -> dict:
        """Create a new branch from main."""
        # Get SHA of main
        resp = requests.get(
            f"https://api.github.com/repos/{self.owner}/{self.repo}/git/ref/heads/main",
            headers=self._headers()
        )
        resp.raise_for_status()
        sha = resp.json()["object"]["sha"]
        
        # Create branch
        resp = requests.post(
            f"https://api.github.com/repos/{self.owner}/{self.repo}/git/refs",
            headers=self._headers(),
            json={"ref": f"refs/heads/{branch_name}", "sha": sha}
        )
        resp.raise_for_status()
        return {"success": True, "branch": branch_name}
    
    def commit_file(self, branch: str, file_path: str, content: str, message: str) -> dict:
        """Commit a file to a branch."""
        # Get current SHA if file exists
        resp = requests.get(
            f"https://api.github.com/repos/{self.owner}/{self.repo}/contents/{file_path}",
            headers=self._headers(),
            params={"ref": branch}
        )
        sha = resp.json().get("sha") if resp.status_code == 200 else None
        
        # Create/update file
        payload = {
            "message": message,
            "content": base64.b64encode(content.encode()).decode(),
            "branch": branch,
        }
        if sha:
            payload["sha"] = sha
        
        resp = requests.put(
            f"https://api.github.com/repos/{self.owner}/{self.repo}/contents/{file_path}",
            headers=self._headers(),
            json=payload
        )
        resp.raise_for_status()
        return {"success": True, "sha": resp.json()["commit"]["sha"]}
    
    def create_pr(self, branch: str, title: str, body: str) -> dict:
        """Create a pull request."""
        resp = requests.post(
            f"https://api.github.com/repos/{self.owner}/{self.repo}/pulls",
            headers=self._headers(),
            json={
                "title": title,
                "body": body,
                "head": branch,
                "base": "main"
            }
        )
        resp.raise_for_status()
        return {"url": resp.json()["html_url"], "number": resp.json()["number"]}
```

### agent/nodes.py (snippet)
```python
from jira_client import JiraClient
from github_client import GitHubClient

jira = JiraClient()
github = GitHubClient()

def fetch_ticket(state):
    try:
        ticket = jira.get_ticket(state["ticket_key"])
        return {
            **state,
            "ticket_summary": ticket["summary"],
            "ticket_description": ticket["description"],
            "ticket_type": ticket["type"],
        }
    except Exception as e:
        return {**state, "error": str(e)}

def apply_changes(state):
    """Create branch and commit files."""
    branch_name = f"ai/{state['ticket_key']}-auto-fix"
    
    github.create_branch(branch_name)
    
    for change in state["proposed_changes"]:
        github.commit_file(
            branch=branch_name,
            file_path=change["file_path"],
            content=change["new_content"],
            message=f"fix({state['ticket_key']}): {change['description']}"
        )
    
    return {**state, "branch_name": branch_name}
```

---

## Next Steps

1. **Copy the code above** into your agent repository
2. **Set environment variables:**
   ```bash
   export JIRA_BASE_URL=https://your-org.atlassian.net
   export JIRA_EMAIL=your-email@company.com
   export JIRA_API_TOKEN=xxxxx
   
   export GITHUB_TOKEN=github_pat_xxxxx
   export GITHUB_OWNER=your-org
   export GITHUB_REPO=taskmaster
   ```
3. **Run your agent** and test locally
4. **When satisfied**, follow the MCP refactor guide (coming next week)

---

## When You're Ready: Refactor to MCP

Once the direct API approach works, converting to MCP is straightforward:

1. Take `jira_client.py` → wrap in FastAPI as `jira_mcp/server.py`
2. Take `github_client.py` → wrap in FastAPI as `github_mcp/server.py`
3. Update agent to call `MCPClient` instead of direct classes
4. Run both MCP servers as sidecars
5. Deploy to AWS with proper credential management

**Migration cost:** ~3 hours to refactor.

---

## Summary

| Phase | Approach | Time | Production-Ready? |
|-------|----------|------|------------------|
| **Now (Week 1)** | Direct API Calls | 2–3 hours | No, but working |
| **Next (Week 2)** | MCP Servers | +3 hours | Yes ✅ |

Start with direct calls. You'll learn the domain, validate the flow, and have a demo to show stakeholders. Then refactor to MCP when you're ready for AWS deployment.

**Recommended: Go with Option C (hybrid).**

--8<-- "_abbreviations.md"

