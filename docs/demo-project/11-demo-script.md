# Demo Script — Facilitator Guide

> **Level:** Beginner
> **Pre-reading:** [00 · Demo Overview](00-overview.md) · [10 · End-to-End Flow](10-e2e-flow.md)

This is the facilitator's guide for a **~20-minute live demo** of the TaskMaster AI agent. Follow these steps exactly to avoid surprises. Includes fallback talking points for every possible hiccup.

---

## Pre-Demo Checklist (Run 30 Minutes Before)

```bash
# 1. Verify RDS is running
aws rds describe-db-instances \
  --db-instance-identifier taskmaster-db \
  --query 'DBInstances[0].DBInstanceStatus'
# Expected: "available"

# 2. Verify ECS task is running
aws ecs list-tasks --cluster taskmaster-cluster
# Expected: at least one task ARN

# 3. Verify codebase is indexed
psql -h <RDS_HOST> -U taskmaster_admin -d taskmaster \
  -c "SELECT module, COUNT(*) FROM code_chunks GROUP BY module;"
# Expected: rows for taskmaster-core, taskmaster-api, taskmaster-e2e

# 4. Check JIRA tickets are in "To Do" status
open "https://yourname.atlassian.net/browse/TASK-101"
open "https://yourname.atlassian.net/browse/TASK-102"

# 5. Confirm GitHub repo is clean (no open PRs from last demo)
gh pr list --repo yourname/taskmaster
# Close any old PRs if needed: gh pr close <number>

# 6. Delete any leftover ai/ branches
git fetch --prune
git branch -r | grep 'ai/' | xargs -I{} git push origin --delete {}

# 7. Start the CLI client in a large terminal window
python3 chat_client.py
```

---

## Demo Flow (20 Minutes Total)

### Segment 1 — Setup Context (3 minutes)

**What to say:**

> "We've built an AI agent that can take a JIRA ticket number and turn it into a Pull Request — fully automated, with human approval at the key decision point. I'll show you two tickets: a bug fix and a feature story. Let's start with the bug."

**Show on screen:**
- JIRA board with TASK-101 and TASK-102 visible
- GitHub repo with the current state of `taskmaster-core/service/TaskService.java`
- Point out the bug on line 23: `task.getAssignee().toUpperCase()`

---

### Segment 2 — Bug Fix: TASK-101 (7 minutes)

**Step 1: Trigger the agent**

Type in the terminal:

```
TASK-101
```

**What to say while the agent runs:**

> "The agent first fetches the ticket from JIRA — it reads the summary and description just like a developer would."

*(Pause on the "fetch_ticket" output)*

> "Then it classifies the ticket as a Bug and determines the minimum scope — in this case, only the `taskmaster-core` module needs to change. The agent knows the API layer is not involved because this is an internal service method."

*(Pause on the "identify_modules" output)*

> "Now it searches the codebase using semantic similarity — not grep. It finds `TaskService.java`, `Task.java`, and the existing test file, ranked by relevance."

*(Pause on "retrieve_context" output)*

> "The LLM reads those files and generates the fix — a three-line null check. It also writes a unit test automatically."

**Step 2: HITL Gate appears**

> "This is the critical moment. The agent stops here and shows us exactly what it wants to change. Nothing has been committed yet. This is the approval gate."

*(Read the diff summary aloud)*

> "Two files, twelve lines, one module. The root cause is clearly explained. Let's approve it."

**Step 3: Type `approve`**

```
approve
```

> "Watch — the agent creates the branch, commits both files, opens the PR, and posts a comment back to the JIRA ticket."

*(Point to the GitHub PR URL in the terminal output)*

**Step 4: Open the PR on screen**

```bash
open $(python3 -c "import requests; print(requests.get('http://localhost:8080/threads/{THREAD_ID}/status').json()['pr_url'])")
```

> "Here's the PR. CI is already running. The description includes the root cause analysis and confirms the test coverage. The PR is labelled as AI-generated."

*(Show the PR description, the file diff, and the JIRA comment)*

---

### Segment 3 — Feature Story: TASK-102 (8 minutes)

**Step 1: Trigger the agent**

```
TASK-102
```

**What to say:**

> "Now a feature story. This one is more complex — adding a new field requires changes across all three modules: the domain layer, the API layer, and the E2E test suite. Watch the agent identify this automatically."

*(Point to "identify_modules" output showing all three)*

**Step 2: HITL Gate with AC table**

> "The diff is larger — six files, ~180 lines. The agent maps each acceptance criterion to the specific file that implements it. Notice AC5 is covered by a Playwright test in TypeScript, even though the rest of the code is Java."

**Step 3: Give feedback**

> "Let me show you the revision flow. I'll give the agent some feedback instead of approving immediately."

Type:

```
The dueDate should validate that it's not in the past
```

> "The agent incorporates this feedback, regenerates the code with a `@FutureOrPresent` validation annotation, and adds a test that expects a 400 error for past dates."

*(Wait for the revised diff to appear)*

**Step 4: Approve the revision**

```
approve
```

> "Six file commits, one PR, JIRA updated — in under 10 minutes, including the revision round."

---

### Segment 4 — Key Points to Emphasise (2 minutes)

**Safety:**

> "The agent can never merge. Branch protection is enforced at the GitHub level — not just in code. The agent literally cannot bypass it."

**Cost:**

> "Both of these tickets cost about $0.20 in total AWS Bedrock API costs. For a task that saves 2–4 hours of developer time, that's a remarkable ROI."

**What it doesn't replace:**

> "The agent doesn't make architectural decisions. It doesn't review PRs. It doesn't deploy. It handles the routine, repeatable work so developers can focus on the work that actually requires human judgement."

---

## Fallback Plans

### 🔴 Bedrock API timeout / slow response

**What to say:**

> "The LLM is making a complex multi-file change — this is the longest step. In production this would run asynchronously."

**Fix:** Check CloudWatch Logs. Re-run: `python3 chat_client.py TASK-101`

---

### 🔴 pgvector returns no chunks

**Symptom:** Agent says "0 chunks retrieved"

**Fix:**

```bash
# Re-index the codebase
python3 index_codebase.py
```

**What to say:** "Let me quickly refresh the code index — this would normally happen automatically on every push."

---

### 🔴 GitHub API 422 error (branch already exists)

**Symptom:** `apply_changes` fails with HTTP 422

**Fix:**

```bash
git push origin --delete ai/TASK-101-fix-npe-taskservice
```

**What to say:** "There's a branch from a previous run — let me clean that up."

---

### 🔴 JIRA authentication error

**Symptom:** `fetch_ticket` fails with 401

**Fix:**

```bash
# Check the secret
aws secretsmanager get-secret-value --secret-id taskmaster/jira
# Re-generate token at https://id.atlassian.com/manage-profile/security/api-tokens
# Update the secret
aws secretsmanager update-secret --secret-id taskmaster/jira --secret-string '{"api_token":"NEW_TOKEN",...}'
```

---

### 🔴 RDS connection refused

**Symptom:** Any DB error in the logs

**Fix:**

```bash
aws rds start-db-instance --db-instance-identifier taskmaster-db
# Wait ~2 minutes for startup
```

---

## Timing Guide

| Minute | Action |
|---|---|
| 0–3 | Show JIRA board + explain the problem |
| 3–10 | TASK-101 bug fix demo (trigger → agent runs → approve → show PR) |
| 10–18 | TASK-102 story demo (trigger → agent runs → feedback round → approve → show PR) |
| 18–20 | Key points: safety, cost, what it doesn't replace |
| 20+ | Q&A |

---

## Suggested Questions to Ask the Audience

- "How much time does your team currently spend on tickets like TASK-101 per sprint?"
- "What's your average CI failure investigation time today?"
- "Which modules or services would you want to onboard first?"

---

??? question "What if an executive asks: can the agent handle any JIRA ticket?"
    Not yet. The agent works best on tickets that have clear, specific descriptions with technical detail. Vague tickets like "improve performance" or "refactor the auth module" require more human-in-the-loop involvement at the planning stage. We've scoped the initial use case to well-defined bug reports and stories with explicit acceptance criteria.

??? question "What if someone asks about security — is the source code sent to OpenAI/Anthropic?"
    No. We use AWS Bedrock, which keeps all inference traffic inside the AWS network. Your code never leaves your AWS account. The LLM model weights are hosted by AWS under your account's data perimeter.

??? question "How do we know the agent's code is correct?"
    The agent writes unit tests and the CI pipeline validates them before the PR can be merged. Human review is mandatory — the agent opens a PR, not a direct merge. Multiple humans still review and approve before code reaches production.

--8<-- "_abbreviations.md"

