# Getting Started Checklist — Week 1

## Your Goal This Week
✅ **Build a working agent that can:**
- Fetch a JIRA ticket
- Generate code changes (with LLM)
- Commit to GitHub branch
- Create a Pull Request
- Post update back to JIRA

## Pre-Flight Check (30 mins)

### AWS
- [ ] AWS account created
- [ ] Bedrock enabled (Claude 3.5 Sonnet)
- [ ] RDS PostgreSQL + pgvector initialized (for RAG)
- [ ] Secrets Manager has entries for JIRA + GitHub secrets

### JIRA
- [ ] JIRA Cloud account created (`https://yourname.atlassian.net`)
- [ ] Create test project with key `TASK`
- [ ] Create test tickets: `TASK-101` (bug) and `TASK-102` (story)
- [ ] Generate JIRA API token (`Settings → Security → API tokens`)
- [ ] Secrets Manager has `taskmaster/jira` entry:
  ```json
  {
    "base_url": "https://yourname.atlassian.net",
    "email": "your-email@example.com",
    "api_token": "xxx"
  }
  ```

### GitHub
- [ ] GitHub repo created: `your-org/taskmaster`
- [ ] Clone taskmaster repo structure (3 modules: core, api, e2e)
- [ ] Generate GitHub PAT (Settings → Developer → Personal access tokens)
- [ ] Secrets Manager has `taskmaster/github` entry:
  ```json
  {
    "token": "ghp_xxx",
    "repo_owner": "your-org",
    "repo_name": "taskmaster"
  }
  ```

### Local Environment
- [ ] Python 3.11+ installed
- [ ] Node.js 20+ installed
- [ ] Docker Desktop running
- [ ] AWS CLI configured: `aws configure`

---

## Week 1: Build Direct API Version (Option A)

### Step 1: Project Structure (15 mins)
```bash
mkdir taskmaster-agent
cd taskmaster-agent

# Create directories
mkdir -p agent tests

# Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Create requirements.txt
cat > requirements.txt << 'EOF'
langgraph==0.2.0
boto3==1.34.0
requests==2.31.0
python-dotenv==1.0.0
psycopg2-binary==2.9.9
pydantic==2.7.0
fastapi==0.111.0
uvicorn==0.30.1
EOF

pip install -r requirements.txt
```

### Step 2: Create Environment File (10 mins)
```bash
cat > .env << 'EOF'
# JIRA
JIRA_BASE_URL=https://yourname.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=xxx

# GitHub
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=your-org
GITHUB_REPO=taskmaster

# AWS
AWS_REGION=us-east-1
AWS_PROFILE=default

# Database
DB_HOST=your-db.c3osk4pxy.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=taskmaster
DB_USER=postgres
DB_PASSWORD=xxx
EOF
```

### Step 3: Create JIRA Client (30 mins)
```bash
cat > agent/jira_client.py << 'EOF'
import requests
import os
import base64
from typing import Dict, List

class JiraClient:
    def __init__(self):
        self.base_url = os.getenv("JIRA_BASE_URL")
        self.email = os.getenv("JIRA_EMAIL")
        self.token = os.getenv("JIRA_API_TOKEN")
    
    def _headers(self) -> Dict:
        auth = base64.b64encode(
            f"{self.email}:{self.token}".encode()
        ).decode()
        return {
            "Authorization": f"Basic {auth}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
    
    def get_ticket(self, issue_key: str) -> Dict:
        """Fetch ticket from JIRA."""
        resp = requests.get(
            f"{self.base_url}/rest/api/3/issue/{issue_key}",
            headers=self._headers()
        )
        resp.raise_for_status()
        data = resp.json()
        
        return {
            "key": data["key"],
            "summary": data["fields"]["summary"],
            "description": data["fields"].get("description", ""),
            "type": data["fields"]["issuetype"]["name"],
            "status": data["fields"]["status"]["name"],
            "labels": data["fields"].get("labels", []),
            "priority": data["fields"]["priority"]["name"],
        }
    
    def post_comment(self, issue_key: str, comment: str) -> Dict:
        """Post comment to JIRA ticket."""
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
        return {"success": True, "comment_id": resp.json()["id"]}
    
    def transition_ticket(self, issue_key: str, status: str) -> Dict:
        """Move ticket to a new status."""
        # Get available transitions
        resp = requests.get(
            f"{self.base_url}/rest/api/3/issue/{issue_key}/transitions",
            headers=self._headers()
        )
        resp.raise_for_status()
        transitions = {t["name"]: t["id"] for t in resp.json()["transitions"]}
        
        if status not in transitions:
            return {
                "success": False,
                "error": f"Status '{status}' not available"
            }
        
        # Transition to new status
        requests.post(
            f"{self.base_url}/rest/api/3/issue/{issue_key}/transitions",
            headers=self._headers(),
            json={"transition": {"id": transitions[status]}}
        ).raise_for_status()
        
        return {"success": True, "status": status}

# Initialize client
jira_client = JiraClient()
EOF
```

### Step 4: Create GitHub Client (30 mins)
```bash
cat > agent/github_client.py << 'EOF'
import requests
import os
import base64
from typing import Dict

class GitHubClient:
    def __init__(self):
        self.token = os.getenv("GITHUB_TOKEN")
        self.owner = os.getenv("GITHUB_OWNER")
        self.repo = os.getenv("GITHUB_REPO")
        self.api_url = "https://api.github.com"
    
    def _headers(self) -> Dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    
    def create_branch(self, branch_name: str) -> Dict:
        """Create a new branch from main."""
        # Get SHA of main
        resp = requests.get(
            f"{self.api_url}/repos/{self.owner}/{self.repo}/git/ref/heads/main",
            headers=self._headers()
        )
        resp.raise_for_status()
        sha = resp.json()["object"]["sha"]
        
        # Create branch
        resp = requests.post(
            f"{self.api_url}/repos/{self.owner}/{self.repo}/git/refs",
            headers=self._headers(),
            json={"ref": f"refs/heads/{branch_name}", "sha": sha}
        )
        resp.raise_for_status()
        return {"success": True, "branch": branch_name}
    
    def commit_file(self, branch: str, file_path: str, content: str, message: str) -> Dict:
        """Commit a file to a branch."""
        # Get current SHA if file exists
        resp = requests.get(
            f"{self.api_url}/repos/{self.owner}/{self.repo}/contents/{file_path}",
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
            f"{self.api_url}/repos/{self.owner}/{self.repo}/contents/{file_path}",
            headers=self._headers(),
            json=payload
        )
        resp.raise_for_status()
        return {"success": True, "sha": resp.json()["commit"]["sha"]}
    
    def create_pr(self, branch: str, title: str, body: str) -> Dict:
        """Create a pull request."""
        resp = requests.post(
            f"{self.api_url}/repos/{self.owner}/{self.repo}/pulls",
            headers=self._headers(),
            json={
                "title": title,
                "body": body,
                "head": branch,
                "base": "main"
            }
        )
        resp.raise_for_status()
        return {
            "success": True,
            "url": resp.json()["html_url"],
            "number": resp.json()["number"]
        }

# Initialize client
github_client = GitHubClient()
EOF
```

### Step 5: Create LangGraph Agent Skeleton (60 mins)
```bash
cat > agent/main.py << 'EOF'
import os
import json
from dotenv import load_dotenv
from typing import TypedDict, Annotated, Optional
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
import boto3

from agent.jira_client import jira_client
from agent.github_client import github_client

load_dotenv()

# ─── State Schema ───────────────────────────────────────────────────────────

class AgentState(TypedDict):
    ticket_key: str
    ticket_summary: str
    ticket_description: str
    ticket_type: str
    
    affected_modules: list[str]
    proposed_changes: list[dict]
    
    branch_name: str
    pr_url: Optional[str]
    
    messages: Annotated[list, add_messages]
    error: Optional[str]

# ─── Bedrock Client ────────────────────────────────────────────────────────

bedrock = boto3.client('bedrock-runtime', region_name=os.getenv('AWS_REGION', 'us-east-1'))

def invoke_llm(prompt: str) -> str:
    """Call Claude 3.5 Sonnet via AWS Bedrock."""
    response = bedrock.invoke_model(
        modelId='anthropic.claude-3-5-sonnet-20241022-v2:0',
        body=json.dumps({
            "anthropic_version": "bedrock-2023-06-01",
            "max_tokens": 4096,
            "messages": [
                {"role": "user", "content": prompt}
            ]
        }),
        contentType='application/json',
        accept='application/json'
    )
    result = json.loads(response['body'].read())
    return result['content'][0]['text']

# ─── Graph Nodes ───────────────────────────────────────────────────────────

def fetch_ticket(state: AgentState) -> AgentState:
    """Fetch JIRA ticket details."""
    try:
        ticket = jira_client.get_ticket(state['ticket_key'])
        return {
            **state,
            'ticket_summary': ticket['summary'],
            'ticket_description': ticket['description'],
            'ticket_type': ticket['type'],
            'messages': [f"✅ Fetched {state['ticket_key']}: {ticket['summary']}"]
        }
    except Exception as e:
        return {**state, 'error': str(e), 'messages': [f"❌ Error: {e}"]}

def identify_modules(state: AgentState) -> AgentState:
    """Use LLM to identify affected modules."""
    prompt = f"""Given this JIRA ticket, which modules in TaskMaster need to change?

Ticket: {state['ticket_summary']}
Description: {state['ticket_description']}
Type: {state['ticket_type']}

Modules:
- taskmaster-core (domain, service, repository)
- taskmaster-api (REST API)
- taskmaster-e2e (E2E tests)

Return JSON with 'affected_modules' list and 'reasoning' string."""
    
    response = invoke_llm(prompt)
    parsed = json.loads(response)
    
    return {
        **state,
        'affected_modules': parsed.get('affected_modules', []),
        'messages': [f"🎯 Modules: {', '.join(parsed.get('affected_modules', []))}"]
    }

def generate_code_changes(state: AgentState) -> AgentState:
    """Use LLM to generate code changes."""
    prompt = f"""Generate code changes to fix: {state['ticket_summary']}

Description: {state['ticket_description']}
Affected modules: {', '.join(state['affected_modules'])}

For a simple demo, suggest minimal changes. Return JSON with:
- "changes": [{"file_path": "...", "description": "...", "new_content": "..."}]
"""
    
    response = invoke_llm(prompt)
    parsed = json.loads(response)
    
    return {
        **state,
        'proposed_changes': parsed.get('changes', []),
        'messages': [f"💡 Generated {len(parsed.get('changes', []))} file(s)"]
    }

def apply_changes(state: AgentState) -> AgentState:
    """Create branch and commit files."""
    try:
        branch_name = f"ai/{state['ticket_key'].lower()}-fix"
        
        # Create branch
        github_client.create_branch(branch_name)
        
        # Commit each file
        for change in state['proposed_changes']:
            github_client.commit_file(
                branch=branch_name,
                file_path=change['file_path'],
                content=change['new_content'],
                message=f"fix({state['ticket_key']}): {change['description']}"
            )
        
        return {
            **state,
            'branch_name': branch_name,
            'messages': [f"📤 Pushed to branch {branch_name}"]
        }
    except Exception as e:
        return {**state, 'error': str(e), 'messages': [f"❌ Error: {e}"]}

def create_pull_request(state: AgentState) -> AgentState:
    """Create a pull request."""
    try:
        pr_body = f"""## {state['ticket_key']}: {state['ticket_summary']}

### Changes
{json.dumps(state['proposed_changes'], indent=2)}

🤖 **Auto-generated by AI Agent**
"""
        
        result = github_client.create_pr(
            branch=state['branch_name'],
            title=f"[{state['ticket_key']}] {state['ticket_summary']}",
            body=pr_body
        )
        
        return {
            **state,
            'pr_url': result['url'],
            'messages': [f"🚀 PR created: {result['url']}"]
        }
    except Exception as e:
        return {**state, 'error': str(e), 'messages': [f"❌ Error: {e}"]}

def post_jira_comment(state: AgentState) -> AgentState:
    """Post summary back to JIRA."""
    try:
        comment = f"✅ PR created: {state.get('pr_url', 'N/A')}"
        jira_client.post_comment(state['ticket_key'], comment)
        return {
            **state,
            'messages': [f"💬 Posted comment to {state['ticket_key']}"]
        }
    except Exception as e:
        return {**state, 'error': str(e), 'messages': [f"❌ Error: {e}"]}

# ─── Build Graph ───────────────────────────────────────────────────────────

def build_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("fetch_ticket", fetch_ticket)
    workflow.add_node("identify_modules", identify_modules)
    workflow.add_node("generate_code_changes", generate_code_changes)
    workflow.add_node("apply_changes", apply_changes)
    workflow.add_node("create_pull_request", create_pull_request)
    workflow.add_node("post_jira_comment", post_jira_comment)
    
    workflow.set_entry_point("fetch_ticket")
    workflow.add_edge("fetch_ticket", "identify_modules")
    workflow.add_edge("identify_modules", "generate_code_changes")
    workflow.add_edge("generate_code_changes", "apply_changes")
    workflow.add_edge("apply_changes", "create_pull_request")
    workflow.add_edge("create_pull_request", "post_jira_comment")
    workflow.add_edge("post_jira_comment", END)
    
    return workflow.compile()

# ─── Run ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    graph = build_graph()
    
    initial_state = {
        "ticket_key": "TASK-101",
        "ticket_summary": "",
        "ticket_description": "",
        "ticket_type": "",
        "affected_modules": [],
        "proposed_changes": [],
        "branch_name": "",
        "pr_url": None,
        "messages": [],
        "error": None,
    }
    
    result = graph.invoke(initial_state)
    
    print("\n=== AGENT RESULTS ===")
    for msg in result['messages']:
        print(msg)
    
    if result.get('error'):
        print(f"\n❌ Error: {result['error']}")
    else:
        print(f"\n✅ PR URL: {result.get('pr_url', 'N/A')}")
EOF
```

### Step 6: Test It (30 mins)
```bash
# Run the agent
python3 agent/main.py
```

**Expected output:**
```
=== AGENT RESULTS ===
✅ Fetched TASK-101: [ticket summary]
🎯 Modules: taskmaster-core
💡 Generated 1 file(s)
📤 Pushed to branch ai/task-101-fix
🚀 PR created: https://github.com/...
💬 Posted comment to TASK-101

✅ PR URL: https://github.com/your-org/taskmaster/pull/1
```

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `Failed to fetch ticket` | Check JIRA credentials in `.env`, verify issue key exists |
| `Authorization failed on GitHub` | Check GitHub token has repo scope, verify org/repo names |
| `Module not found` | Ensure you've `pip install -r requirements.txt` |
| `Bedrock error` | Check AWS credentials configured, Claude 3.5 enabled in Bedrock |
| `psycopg2 error` | Only needed if using RAG; can skip for Week 1 |

---

## Success Criteria ✅

By end of Week 1, you should have:
- [ ] Agent that fetches JIRA ticket
- [ ] Agent that generates code changes
- [ ] Agent that creates GitHub branch
- [ ] Agent that commits files
- [ ] Agent that creates PR
- [ ] Agent that posts comment back to JIRA
- [ ] All 6 steps run without errors

---

## Next: Week 2 Refactor to MCP

Once you have this working, you'll refactor into MCP servers:
1. Wrap `jira_client.py` → `jira_mcp/server.py`
2. Wrap `github_client.py` → `github_mcp/server.py`
3. Update agent to call MCP HTTP endpoints
4. Test with `docker-compose up`

**Time:** 3 hours
**Result:** Production-ready

---

## Files Created This Week

```
taskmaster-agent/
├── .env                          ← Your secrets
├── .gitignore                    ← Don't commit .env!
├── requirements.txt              ← Python deps
├── agent/
│   ├── __init__.py
│   ├── main.py                   ← LangGraph agent
│   ├── jira_client.py            ← Direct JIRA API calls
│   ├── github_client.py          ← Direct GitHub API calls
│   └── mcp_clients.py            ← Will implement Week 2
└── README.md                     ← Usage guide
```

---

## Getting Help

- JIRA API docs: https://developer.atlassian.com/cloud/jira/rest/v3/
- GitHub API docs: https://docs.github.com/en/rest
- LangGraph docs: https://langchain-ai.github.io/langgraph/
- Bedrock docs: https://docs.aws.amazon.com/bedrock/

---

**Ready? Start with Step 1. You can have this working by EOD.**

--8<-- "_abbreviations.md"

