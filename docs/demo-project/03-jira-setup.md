# JIRA Setup — Personal Cloud Account

> **Level:** Beginner
> **Pre-reading:** [00 · Demo Overview](00-overview.md) · [06.02 · JIRA Integration](../06.02-jira-integration.md)

This guide walks through configuring a free personal JIRA Cloud account, creating the demo project and tickets, generating an API token, and wiring up a webhook to the AWS API Gateway endpoint.

---

## 1. Create a Personal JIRA Cloud Account

1. Go to [https://www.atlassian.com/software/jira](https://www.atlassian.com/software/jira)
2. Click **Get it free** → sign up with your email
3. Choose a site name: `yourname.atlassian.net` (this becomes your `base_url`)
4. Select **Scrum** template when prompted to create a project

---

## 2. Create the Demo Project

1. In JIRA, click **Projects → Create project**
2. Choose **Scrum** → click **Select**
3. Set:
   - **Project name:** `TaskMaster`
   - **Project key:** `TASK`
4. Click **Create**

---

## 3. Configure Issue Types

Ensure these issue types exist under `TASK` project:

| Issue Type | Use |
|---|---|
| **Bug** | TASK-101 — NullPointerException fix |
| **Story** | TASK-102 — dueDate field addition |

If not present: **Project settings → Issue types → Add issue type**.

---

## 4. Create the Two Demo Tickets

### TASK-101 — Bug

| Field | Value |
|---|---|
| **Issue type** | Bug |
| **Summary** | Fix NullPointerException in TaskService when task has no assignee |
| **Description** | `TaskService.getSummary()` throws a `NullPointerException` when the `assignee` field is `null`. This happens because the method calls `.toUpperCase()` directly on `task.getAssignee()` without a null check. Steps to reproduce: create a Task with no assignee set, then call `getSummary()`. Expected: returns a string with "Unassigned". Actual: `NullPointerException`. |
| **Priority** | High |
| **Labels** | `ai-agent`, `taskmaster-core` |

### TASK-102 — Story

| Field | Value |
|---|---|
| **Issue type** | Story |
| **Summary** | Add dueDate field to Task entity and expose via REST API |
| **Description** | As a task manager, I want to set a due date on tasks so I can track deadlines. |
| **Acceptance Criteria** | AC1: `Task` entity has a `dueDate` field of type `LocalDate`. AC2: `POST /api/tasks` accepts `dueDate` in ISO-8601 format (`YYYY-MM-DD`). AC3: `GET /api/tasks` returns `dueDate` for each task. AC4: `dueDate` is optional — existing tasks without it return `null`. AC5: A new Playwright E2E test verifies the `dueDate` round-trip. |
| **Priority** | Medium |
| **Labels** | `ai-agent`, `taskmaster-core`, `taskmaster-api`, `taskmaster-e2e` |
| **Story Points** | 3 |

---

## 5. Generate a JIRA API Token

1. Go to [https://id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Label: `taskmaster-ai-agent`
4. Copy the generated token immediately — **it is shown only once**
5. Store in AWS Secrets Manager (already done in [01 · AWS Infra](01-aws-infra.md)):

```bash
aws secretsmanager update-secret \
  --secret-id taskmaster/jira \
  --secret-string '{
    "base_url": "https://yourname.atlassian.net",
    "email": "you@example.com",
    "api_token": "PASTE_YOUR_TOKEN_HERE"
  }'
```

---

## 6. Verify API Access

```bash
# Test from your local machine
JIRA_BASE="https://yourname.atlassian.net"
JIRA_EMAIL="you@example.com"
JIRA_TOKEN="YOUR_API_TOKEN"

curl -u "${JIRA_EMAIL}:${JIRA_TOKEN}" \
  -H "Accept: application/json" \
  "${JIRA_BASE}/rest/api/3/issue/TASK-101" | python3 -m json.tool
```

Expected: a JSON object with `fields.summary`, `fields.description`, `fields.issuetype.name`.

---

## 7. JIRA REST API — Key Endpoints Used by the Agent

| Operation | Method | Endpoint |
|---|---|---|
| Fetch ticket details | GET | `/rest/api/3/issue/{issueKey}` |
| Post a comment | POST | `/rest/api/3/issue/{issueKey}/comment` |
| Update ticket status | POST | `/rest/api/3/issue/{issueKey}/transitions` |
| Search by label | GET | `/rest/api/3/search?jql=labels=ai-agent` |
| Get issue types | GET | `/rest/api/3/issuetype` |

### Example: Fetch Ticket

```python
import requests
import base64

def get_jira_ticket(issue_key: str, base_url: str, email: str, token: str) -> dict:
    auth = base64.b64encode(f"{email}:{token}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}", "Accept": "application/json"}
    resp = requests.get(f"{base_url}/rest/api/3/issue/{issue_key}", headers=headers)
    resp.raise_for_status()
    data = resp.json()
    return {
        "key": data["key"],
        "summary": data["fields"]["summary"],
        "description": extract_description(data["fields"]["description"]),
        "type": data["fields"]["issuetype"]["name"],
        "labels": data["fields"].get("labels", []),
        "priority": data["fields"]["priority"]["name"],
        "acceptance_criteria": extract_ac(data["fields"].get("description")),
    }

def extract_description(adf_doc: dict) -> str:
    """Extract plain text from Atlassian Document Format"""
    if not adf_doc:
        return ""
    texts = []
    for block in adf_doc.get("content", []):
        for inline in block.get("content", []):
            if inline.get("type") == "text":
                texts.append(inline.get("text", ""))
    return " ".join(texts)
```

---

## 8. Configure JIRA Webhook

The webhook fires whenever a ticket with the label `ai-agent` is updated (e.g., assigned to the agent user).

1. In JIRA: **Project settings → Webhooks → Create webhook**
2. Configure:
   - **Name:** `TaskMaster AI Agent Webhook`
   - **URL:** `https://YOUR_API_GW_ID.execute-api.us-east-1.amazonaws.com/webhooks/jira`
   - **Events:** Check **Issue → updated**, **Issue → created**
   - **JQL filter:** `project = TASK AND labels = "ai-agent"`
3. Click **Save**

> Add a custom header `x-webhook-source: jira` so the Lambda can route it correctly.

---

## 9. Workflow: "Assign to Agent"

The trigger convention used in this demo:

1. User opens JIRA ticket
2. Changes **Assignee** to a special user: `AI Agent` (create this user in JIRA)
3. JIRA fires webhook to API Gateway
4. Lambda posts the event to SQS
5. Chat engine picks up the event and starts the LangGraph agent

Alternatively (simpler for the demo): the user types the ticket number directly in the chat UI — no webhook needed. See [08 · Chat Engine](08-chat-engine.md).

---

## 10. Post-PR Comment Back to JIRA

When the agent creates a PR, it posts back to JIRA:

```python
def post_jira_comment(issue_key: str, pr_url: str, base_url: str, email: str, token: str):
    auth = base64.b64encode(f"{email}:{token}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": "application/json"
    }
    body = {
        "body": {
            "type": "doc",
            "version": 1,
            "content": [{
                "type": "paragraph",
                "content": [{
                    "type": "text",
                    "text": f"🤖 AI Agent has created a Pull Request: {pr_url}. "
                            f"Please review and merge when ready."
                }]
            }]
        }
    }
    requests.post(
        f"{base_url}/rest/api/3/issue/{issue_key}/comment",
        headers=headers,
        json=body
    ).raise_for_status()
```

---

??? question "Does the free JIRA Cloud tier support webhooks?"
    Yes. Webhooks are available on all JIRA Cloud tiers including the free tier. The limitation on free is 10 users, 10 projects, and no advanced roadmaps — none of which affect this demo.

??? question "What happens if the JIRA API rate-limits the agent?"
    JIRA Cloud enforces a 10 requests/second limit per OAuth token. The agent makes 3–5 API calls per ticket (fetch + 1–2 comments + status update), well within limits. The MCP server adds retry-with-backoff for 429 responses.

??? question "Can I use JIRA Service Management instead of JIRA Software?"
    Yes, but the issue types are different (Request Types vs Issue Types). The agent's ticket classifier works on `issuetype.name` — update the classifier mapping to match your JSM request type names.

--8<-- "_abbreviations.md"

