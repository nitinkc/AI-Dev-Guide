# End-to-End Flow Walkthrough

> **Level:** Intermediate
> **Pre-reading:** [06 · LangGraph Agent](06-langgraph-agent.md) · [09 · HITL Design](09-hitl-design.md)

This document provides complete sequence diagrams and expected outputs for both demo tickets — the bug fix (TASK-101) and the feature story (TASK-102).

---

## TASK-101: Bug Fix Flow (NullPointerException)

### Full Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant CE as Chat Engine
    participant LG as LangGraph Agent
    participant JM as JIRA MCP
    participant RAG as pgvector RAG
    participant LLM as AWS Bedrock Claude
    participant GM as GitHub MCP
    participant JIRA as JIRA Cloud
    participant GH as GitHub

    U->>CE: "TASK-101" (WebSocket)
    CE->>LG: graph.stream(initial_state)

    Note over LG: Node: fetch_ticket
    LG->>JM: get_ticket("TASK-101")
    JM->>JIRA: GET /rest/api/3/issue/TASK-101
    JIRA-->>JM: {summary, description, type=Bug}
    JM-->>LG: ticket data
    LG-->>CE: ✅ Fetched TASK-101

    Note over LG: Node: classify_ticket
    LG->>LLM: classify_ticket prompt
    LLM-->>LG: {type: Bug, complexity: low}
    LG-->>CE: 📋 Bug, low complexity

    Note over LG: Node: identify_modules
    LG->>LLM: which modules?
    LLM-->>LG: ["taskmaster-core"]
    LG-->>CE: 🎯 taskmaster-core

    Note over LG: Node: retrieve_context
    LG->>RAG: similarity search (top-5, module=taskmaster-core)
    RAG-->>LG: [TaskService.java, Task.java, TaskServiceTest.java, ...]
    LG-->>CE: 🔍 5 chunks retrieved

    Note over LG: Node: generate_code_changes
    LG->>LLM: fix the bug (with RAG context)
    LLM-->>LG: {root_cause: "...", changes: [TaskService.java]}
    LG-->>CE: 💡 1 file change

    Note over LG: Node: generate_tests
    LG->>LLM: write test for null assignee
    LLM-->>LG: {tests: [TaskServiceTest.java]}
    LG-->>CE: 🧪 1 test file

    Note over LG: Node: prepare_diff_summary
    LG-->>CE: diff summary (2 files, ~12 lines)

    Note over LG: Node: human_review_gate (INTERRUPT)
    LG-->>CE: ⏸ awaiting_approval (diff shown to user)
    CE-->>U: {"type":"awaiting_approval","diff_summary":"..."}

    U->>CE: POST /threads/{id}/resume {"response":"approve"}
    CE->>LG: Command(resume="approve")

    Note over LG: Node: apply_changes
    LG->>GM: create_branch("ai/TASK-101-fix-npe-taskservice")
    GM->>GH: POST /repos/.../git/refs
    GH-->>GM: branch created
    LG->>GM: commit_file(TaskService.java, new_content)
    GM->>GH: PUT /repos/.../contents/...TaskService.java
    LG->>GM: commit_file(TaskServiceTest.java, new_content)
    GM->>GH: PUT /repos/.../contents/...TaskServiceTest.java
    LG-->>CE: 📤 2 files pushed

    Note over LG: Node: create_pull_request
    LG->>GM: create_pr(branch, title, body)
    GM->>GH: POST /repos/.../pulls
    GH-->>GM: {pr_url: "https://github.com/.../pull/17"}
    LG-->>CE: 🚀 PR #17 created

    Note over LG: Node: post_jira_comment
    LG->>JM: post_comment("TASK-101", "🤖 PR created: ...")
    JM->>JIRA: POST /rest/api/3/issue/TASK-101/comment
    LG-->>CE: 💬 JIRA updated

    CE-->>U: {"type":"done","pr_url":"https://..."}
```

### Expected Code Changes for TASK-101

**`taskmaster-core/src/main/java/com/demo/taskmaster/core/service/TaskService.java`**

```diff
-    public String getSummary(Task task) {
-        return task.getTitle() + " assigned to " + task.getAssignee().toUpperCase();
-    }
+    public String getSummary(Task task) {
+        String assignee = task.getAssignee() != null
+                ? task.getAssignee().toUpperCase()
+                : "Unassigned";
+        return task.getTitle() + " assigned to " + assignee;
+    }
```

**`taskmaster-core/src/test/java/com/demo/taskmaster/core/service/TaskServiceTest.java`**

```diff
+    @Test
+    void getSummary_whenAssigneeIsNull_returnsUnassigned() {
+        Task task = new Task();
+        task.setTitle("Fix login");
+        // assignee deliberately not set
+        TaskService service = new TaskService(null);
+        assertThat(service.getSummary(task))
+                .isEqualTo("Fix login assigned to Unassigned");
+    }
```

### Expected PR Output

```markdown
## Summary
> ⚠️ AI-Generated PR — review carefully before merging.

**JIRA Ticket:** [TASK-101](https://yourname.atlassian.net/browse/TASK-101)
**Ticket Type:** Bug

## Root Cause
`TaskService.getSummary()` calls `task.getAssignee().toUpperCase()` directly 
on line 23. When a `Task` has no assignee set, `getAssignee()` returns `null`,
causing a `NullPointerException`. The fix adds a null-check that returns 
`"Unassigned"` as the fallback string.

## Changes Made
- `TaskService.java` — added null-check guard in `getSummary()`
- `TaskServiceTest.java` — added test case for null assignee

## Test Coverage
- [x] Existing test `getSummary_returnsFormattedString` still passes
- [x] New test `getSummary_whenAssigneeIsNull_returnsUnassigned` added
- [x] No API contract changes — taskmaster-api untouched
```

---

## TASK-102: Story Flow (Add dueDate Field)

### Full Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant CE as Chat Engine
    participant LG as LangGraph
    participant RAG as pgvector
    participant LLM as Bedrock Claude
    participant GM as GitHub MCP
    participant JM as JIRA MCP

    U->>CE: "TASK-102"
    CE->>LG: graph.stream(initial_state)

    Note over LG: fetch · classify · identify_modules
    LG-->>CE: Story · complexity:medium
    LG-->>CE: Modules: taskmaster-core + taskmaster-api + taskmaster-e2e

    Note over LG: retrieve_context
    LG->>RAG: search (top-10, all 3 modules)
    RAG-->>LG: Task.java, TaskController.java, TaskRequest/Response.java, task-create.spec.ts, ...

    Note over LG: generate_code_changes (6 files)
    LG->>LLM: implement dueDate (AC1-AC4)
    LLM-->>LG: changes to Task.java, TaskRequest, TaskResponse, TaskController

    Note over LG: generate_tests (AC5)
    LG->>LLM: write Playwright E2E test
    LLM-->>LG: updated task-create.spec.ts

    Note over LG: INTERRUPT — large diff + multi-module
    LG-->>CE: ⏸ diff (6 files, ~180 lines, 3 modules)
    CE-->>U: show diff + AC coverage table

    U->>CE: "The dueDate should reject past dates"
    CE->>LG: Command(resume="The dueDate should reject...")

    Note over LG: iteration 2: generate_code_changes
    LG->>LLM: revise — add @FutureOrPresent validation
    LLM-->>LG: updated Task.java + test for 400 response

    Note over LG: INTERRUPT again (iteration 2)
    LG-->>CE: revised diff
    CE-->>U: show revised diff

    U->>CE: "approve"
    CE->>LG: Command(resume="approve")

    Note over LG: apply_changes — 6 file commits
    LG->>GM: create_branch("ai/TASK-102-add-duedate...")
    loop 6 files
        LG->>GM: commit_file(file, content)
    end

    Note over LG: create_pull_request
    LG->>GM: create_pr(branch, title, body with AC table)

    Note over LG: post_jira_comment
    LG->>JM: post_comment("TASK-102", "PR #18 created")
    CE-->>U: done, PR #18
```

### Expected Code Changes for TASK-102

**`Task.java`** (core — entity field)

```diff
+import jakarta.validation.constraints.FutureOrPresent;
+import java.time.LocalDate;

 public class Task {
     // ... existing fields ...
+
+    @FutureOrPresent
+    private LocalDate dueDate;
+
+    public LocalDate getDueDate() { return dueDate; }
+    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
 }
```

**`TaskRequest.java`** (api — DTO)

```diff
+import java.time.LocalDate;
+
 public class TaskRequest {
     private String title;
     private String description;
     private String assignee;
+    private LocalDate dueDate;
+    public LocalDate getDueDate() { return dueDate; }
+    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
 }
```

**`TaskResponse.java`** (api — DTO)

```diff
+import java.time.LocalDate;
+
 public class TaskResponse {
     private Long id;
     private String title;
     private String assignee;
+    private LocalDate dueDate;
+    public LocalDate getDueDate() { return dueDate; }
+    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
 }
```

**`TaskController.java`** (api — mapping)

```diff
     @PostMapping
     public ResponseEntity<TaskResponse> createTask(@RequestBody @Valid TaskRequest request) {
         Task task = new Task();
         task.setTitle(request.getTitle());
         task.setDescription(request.getDescription());
         task.setAssignee(request.getAssignee());
+        task.setDueDate(request.getDueDate());
         return ResponseEntity.ok(toResponse(taskService.createTask(task)));
     }

     private TaskResponse toResponse(Task task) {
         TaskResponse resp = new TaskResponse();
         resp.setId(task.getId());
         resp.setTitle(task.getTitle());
         resp.setAssignee(task.getAssignee());
+        resp.setDueDate(task.getDueDate());
         return resp;
     }
```

**`task-create.spec.ts`** (e2e — new test)

```diff
+    test('creates a task with dueDate and retrieves it', async ({ request }) => {
+        const tomorrow = new Date();
+        tomorrow.setDate(tomorrow.getDate() + 1);
+        const dueDateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
+
+        const createRes = await request.post('/api/tasks', {
+            data: { title: 'Task with due date', dueDate: dueDateStr }
+        });
+        expect(createRes.status()).toBe(200);
+        const created = await createRes.json();
+        expect(created.dueDate).toBe(dueDateStr);
+
+        const listRes = await request.get('/api/tasks');
+        const tasks = await listRes.json();
+        const found = tasks.find((t: any) => t.id === created.id);
+        expect(found.dueDate).toBe(dueDateStr);
+    });
+
+    test('rejects a task with a past dueDate', async ({ request }) => {
+        const yesterday = new Date();
+        yesterday.setDate(yesterday.getDate() - 1);
+        const pastDateStr = yesterday.toISOString().split('T')[0];
+
+        const res = await request.post('/api/tasks', {
+            data: { title: 'Past due task', dueDate: pastDateStr }
+        });
+        expect(res.status()).toBe(400);
+    });
```

---

## Timing Breakdown

| Phase | TASK-101 (Bug) | TASK-102 (Story) |
|---|---|---|
| Ticket fetch + classify | ~10s | ~10s |
| Module identification | ~8s | ~8s |
| RAG retrieval | ~5s | ~8s |
| Code generation (LLM call) | ~25s | ~45s |
| Test generation | ~20s | ~30s |
| HITL gate (user response) | ~30s (user time) | ~2 min (user reads diff) |
| Revision round (if any) | — | ~50s |
| Branch + commits | ~15s | ~30s |
| PR creation + JIRA comment | ~5s | ~5s |
| **Total (excl. user time)** | **~1.5 min** | **~3 min** |
| **Total (incl. user review)** | **~3–5 min** | **~7–12 min** |

---

??? question "Why does TASK-102 require three modules but TASK-101 only one?"
    TASK-101 is a bug entirely within the service layer — only `TaskService.getSummary()` is broken, and only `taskmaster-core` contains that code. TASK-102 adds a new field that propagates from the database entity through the API layer to the E2E test — every layer of the stack is touched, which is expected for a data model change.

??? question "How does the agent decide the PR title format?"
    The title template is `[{TICKET_KEY}] {ticket_summary}` — matching the branch protection rule patterns at most companies. This makes PRs easy to find from JIRA and vice versa.

??? question "What if CI fails after the PR is created?"
    The agent's job ends at PR creation. CI feedback (red checks on the PR) is visible in GitHub. In a future iteration, the Playwright CI failure webhook would trigger the agent again with the CI error context — see [07.02 · Playwright RCA](../07.02-playwright-rca.md) for that flow.

--8<-- "_abbreviations.md"

