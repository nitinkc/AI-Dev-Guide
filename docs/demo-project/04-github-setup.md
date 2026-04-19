# GitHub Setup — Repository, Access, and PR Templates

> **Level:** Beginner
> **Pre-reading:** [00 · Demo Overview](00-overview.md)

This guide sets up the TaskMaster GitHub repository, configures branch protection rules, creates a fine-grained Personal Access Token (PAT), stores it securely in Secrets Manager, and prepares the PR template the agent will use.

---

## 1. Create the GitHub Repository

```bash
# Option A: GitHub CLI (recommended)
gh repo create taskmaster \
  --private \
  --description "TaskMaster demo — AI agent automation target" \
  --clone

# Option B: Via GitHub web UI
# → https://github.com/new
# Name: taskmaster, Visibility: Private, Add README: yes
```

---

## 2. Push the Initial Code

```bash
cd taskmaster

# Copy the module structure from 02-taskmaster-repo.md
# (all Java files + Playwright files + pom.xml files)

git add .
git commit -m "chore: initial TaskMaster project scaffold"
git push origin main
```

---

## 3. Branch Protection Rules

Protect `main` so the agent **cannot push directly** — it must go through a PR:

1. Go to: `https://github.com/YOUR_USERNAME/taskmaster/settings/branches`
2. Click **Add branch ruleset**
3. Configure:

| Setting | Value |
|---|---|
| Branch name pattern | `main` |
| Require a pull request before merging | ✅ |
| Require approvals | 1 (you review the agent's PR) |
| Dismiss stale reviews on new commits | ✅ |
| Require status checks to pass | ✅ (add: `build`, `test`) |
| Do not allow bypassing the above settings | ✅ |

> This enforces the core safety principle: **the agent cannot merge, only humans can.**

---

## 4. Create a Fine-Grained Personal Access Token

Fine-grained PATs allow you to limit the agent to only the permissions it needs on only the `taskmaster` repository.

1. Go to: [https://github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. Configure:

| Field | Value |
|---|---|
| **Token name** | `taskmaster-ai-agent` |
| **Expiration** | 90 days (regenerate before demos) |
| **Repository access** | Only selected repositories → `taskmaster` |

3. Under **Repository permissions**, set:

| Permission | Level |
|---|---|
| Contents | Read and write (clone, push branches) |
| Pull requests | Read and write (create, update PRs) |
| Metadata | Read-only (required) |
| Workflows | Read and write (if CI workflows need updating) |

4. Click **Generate token** — copy it immediately
5. Store in Secrets Manager:

```bash
aws secretsmanager update-secret \
  --secret-id taskmaster/github \
  --secret-string '{
    "token": "github_pat_YOUR_FINE_GRAINED_TOKEN",
    "repo_owner": "YOUR_GITHUB_USERNAME",
    "repo_name": "taskmaster",
    "base_branch": "main"
  }'
```

---

## 5. GitHub Actions CI Workflow

Add a CI workflow so branch protection status checks work:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches-ignore: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    name: Build & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Java 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Build and test (Maven)
        run: mvn -B verify --no-transfer-progress
        working-directory: .

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: '**/target/surefire-reports/*.xml'

  e2e:
    name: Playwright E2E
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: taskmaster-e2e/package-lock.json

      - name: Install Playwright
        run: npm ci && npx playwright install --with-deps
        working-directory: taskmaster-e2e

      - name: Run Playwright tests
        run: npx playwright test
        working-directory: taskmaster-e2e
        env:
          BASE_URL: http://localhost:8080

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: taskmaster-e2e/playwright-report/
```

---

## 6. GitHub API — Key Operations Used by the Agent

| Operation | Method | Endpoint |
|---|---|---|
| Create a branch | POST | `/repos/{owner}/{repo}/git/refs` |
| Get file content | GET | `/repos/{owner}/{repo}/contents/{path}` |
| Create/update a file | PUT | `/repos/{owner}/{repo}/contents/{path}` |
| Create a pull request | POST | `/repos/{owner}/{repo}/pulls` |
| Add PR comment | POST | `/repos/{owner}/{repo}/issues/{pr_number}/comments` |
| List branches | GET | `/repos/{owner}/{repo}/branches` |

### Example: Create Branch and Open PR

```python
import requests

GITHUB_API = "https://api.github.com"

def create_branch(owner: str, repo: str, token: str, branch_name: str, base_branch: str = "main") -> None:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    
    # Get the SHA of the base branch
    resp = requests.get(f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{base_branch}", headers=headers)
    sha = resp.json()["object"]["sha"]
    
    # Create the new branch
    requests.post(f"{GITHUB_API}/repos/{owner}/{repo}/git/refs", headers=headers, json={
        "ref": f"refs/heads/{branch_name}",
        "sha": sha
    }).raise_for_status()

def create_pull_request(owner: str, repo: str, token: str, branch: str,
                         title: str, body: str) -> str:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    resp = requests.post(f"{GITHUB_API}/repos/{owner}/{repo}/pulls", headers=headers, json={
        "title": title,
        "body": body,
        "head": branch,
        "base": "main",
        "draft": False
    })
    resp.raise_for_status()
    return resp.json()["html_url"]
```

### Example: Commit a File Change

```python
import base64

def commit_file_change(owner: str, repo: str, token: str, branch: str,
                        file_path: str, new_content: str, commit_message: str) -> None:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    
    # Get existing file SHA (needed for updates)
    resp = requests.get(
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{file_path}",
        headers=headers,
        params={"ref": branch}
    )
    sha = resp.json().get("sha")  # None if file is new
    
    payload = {
        "message": commit_message,
        "content": base64.b64encode(new_content.encode()).decode(),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha
    
    requests.put(
        f"{GITHUB_API}/repos/{owner}/{repo}/contents/{file_path}",
        headers=headers,
        json=payload
    ).raise_for_status()
```

---

## 7. Branch Naming Convention

The agent uses a consistent naming pattern so branches are identifiable:

```
ai/TASK-101-fix-npe-taskservice
ai/TASK-102-add-duedate-field
```

Pattern: `ai/{TICKET_KEY}-{slug-of-summary}`

```python
import re

def make_branch_name(ticket_key: str, summary: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', summary.lower()).strip('-')[:50]
    return f"ai/{ticket_key}-{slug}"
```

---

## 8. PR Description Template

The agent fills this template when creating a PR. It maps to `.github/pull_request_template.md` from [02 · Repo Structure](02-taskmaster-repo.md):

```python
def build_pr_body(ticket_key: str, ticket_url: str, ticket_type: str,
                   summary: str, changes: list[str], ac_table: str = "") -> str:
    changes_md = "\n".join(f"- {c}" for c in changes)
    ac_section = f"\n## Acceptance Criteria Coverage\n{ac_table}" if ac_table else ""
    return f"""## Summary
> ⚠️ **AI-Generated PR** — A human engineer approved this diff before the PR was opened.

**JIRA Ticket:** [{ticket_key}]({ticket_url})
**Ticket Type:** {ticket_type}

## Changes Made
{changes_md}
{ac_section}
## Test Coverage
- [x] Unit tests added/updated
- [x] All existing tests pass

## ⚠️ AI-Generated Notice
This PR was created by the TaskMaster AI agent. Please review the diff carefully before merging.
"""
```

---

??? question "Why use a fine-grained PAT instead of a classic PAT?"
    Fine-grained PATs scope permissions to a single repository and specific operation types (e.g., Contents write but not Admin). This follows least-privilege principles — if the token is ever compromised, the blast radius is limited to this one repo's content.

??? question "How does the agent push code without checking out the repo locally?"
    The GitHub Contents API allows creating and updating files via REST — no local `git clone` needed. For complex multi-file changes, the agent uses the Git Trees API to batch all file changes into a single commit atomically.

??? question "What stops the agent from pushing to main directly?"
    Branch protection rules prevent direct pushes to `main` even from tokens with write access. The agent always creates a new `ai/TASK-xxx-...` branch, then opens a PR. This is enforced at the GitHub platform level — not just in agent code.

--8<-- "_abbreviations.md"

