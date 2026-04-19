# TaskMaster Repository Structure

> **Level:** Beginner
> **Pre-reading:** [00 · Demo Overview](00-overview.md)

This document describes the `taskmaster` GitHub repository — the demo codebase the AI agent will read, modify, and commit to. It is a minimal but realistic multi-module project.

---

## Repository Layout

```
taskmaster/
├── pom.xml                         ← Root Maven POM (multi-module parent)
├── .github/
│   └── pull_request_template.md   ← PR template for agent-generated PRs
├── taskmaster-core/                ← Module 1: Domain layer (Spring Boot library)
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/demo/taskmaster/core/
│       │   ├── model/
│       │   │   └── Task.java
│       │   ├── repository/
│       │   │   └── TaskRepository.java
│       │   └── service/
│       │       └── TaskService.java
│       └── test/java/com/demo/taskmaster/core/
│           └── service/
│               └── TaskServiceTest.java
├── taskmaster-api/                 ← Module 2: REST API layer (Spring Boot web app)
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/demo/taskmaster/api/
│       │   ├── TaskmasterApiApplication.java
│       │   ├── controller/
│       │   │   └── TaskController.java
│       │   └── dto/
│       │       ├── TaskRequest.java
│       │       └── TaskResponse.java
│       └── test/java/com/demo/taskmaster/api/
│           └── controller/
│               └── TaskControllerTest.java
└── taskmaster-e2e/                 ← Module 3: Playwright E2E tests (Node.js)
    ├── package.json
    ├── playwright.config.ts
    └── tests/
        ├── task-create.spec.ts
        ├── task-update.spec.ts
        └── task-list.spec.ts
```

---

## Module 1: `taskmaster-core`

The domain layer — entities, repositories, and service logic. **This is where the bug (TASK-101) and story (TASK-102) changes land.**

### `Task.java` — Entity

```java
package com.demo.taskmaster.core.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    private String description;

    private String assignee;          // nullable — root cause of TASK-101

    // TASK-102 will add:
    // private LocalDate dueDate;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    // --- getters / setters ---
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getAssignee() { return assignee; }
    public void setAssignee(String assignee) { this.assignee = assignee; }
    public Instant getCreatedAt() { return createdAt; }
}
```

### `TaskService.java` — Service (contains the TASK-101 bug)

```java
package com.demo.taskmaster.core.service;

import com.demo.taskmaster.core.model.Task;
import com.demo.taskmaster.core.repository.TaskRepository;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class TaskService {

    private final TaskRepository repository;

    public TaskService(TaskRepository repository) {
        this.repository = repository;
    }

    public List<Task> getAllTasks() {
        return repository.findAll();
    }

    public Task createTask(Task task) {
        return repository.save(task);
    }

    // BUG: TASK-101 — throws NullPointerException when assignee is null
    public String getSummary(Task task) {
        return task.getTitle() + " assigned to " + task.getAssignee().toUpperCase();
        //                                                              ^^^^^^^^^^^
        //                                          NullPointerException if assignee is null
    }
}
```

### `TaskRepository.java`

```java
package com.demo.taskmaster.core.repository;

import com.demo.taskmaster.core.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<Task, Long> {}
```

### `TaskServiceTest.java` — Existing unit tests

```java
package com.demo.taskmaster.core.service;

import com.demo.taskmaster.core.model.Task;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class TaskServiceTest {

    @Test
    void getSummary_returnsFormattedString() {
        Task task = new Task();
        task.setTitle("Fix login");
        task.setAssignee("alice");
        TaskService service = new TaskService(null);
        assertThat(service.getSummary(task)).isEqualTo("Fix login assigned to ALICE");
    }

    // TASK-101 fix will add:
    // @Test
    // void getSummary_whenAssigneeIsNull_returnsUnassigned() { ... }
}
```

---

## Module 2: `taskmaster-api`

The REST API layer. Calls into `taskmaster-core`. TASK-102 adds the `dueDate` field to the DTO and controller.

### `TaskController.java`

```java
package com.demo.taskmaster.api.controller;

import com.demo.taskmaster.api.dto.TaskRequest;
import com.demo.taskmaster.api.dto.TaskResponse;
import com.demo.taskmaster.core.model.Task;
import com.demo.taskmaster.core.service.TaskService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> listTasks() {
        return taskService.getAllTasks().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createTask(@RequestBody TaskRequest request) {
        Task task = new Task();
        task.setTitle(request.getTitle());
        task.setDescription(request.getDescription());
        task.setAssignee(request.getAssignee());
        // TASK-102 will add: task.setDueDate(request.getDueDate());
        return ResponseEntity.ok(toResponse(taskService.createTask(task)));
    }

    private TaskResponse toResponse(Task task) {
        TaskResponse resp = new TaskResponse();
        resp.setId(task.getId());
        resp.setTitle(task.getTitle());
        resp.setAssignee(task.getAssignee());
        // TASK-102 will add: resp.setDueDate(task.getDueDate());
        return resp;
    }
}
```

### `TaskRequest.java` / `TaskResponse.java`

```java
// TaskRequest.java — TASK-102 will add LocalDate dueDate field
public class TaskRequest {
    private String title;
    private String description;
    private String assignee;
    // getters / setters omitted for brevity
}

// TaskResponse.java — TASK-102 will add LocalDate dueDate field
public class TaskResponse {
    private Long id;
    private String title;
    private String assignee;
    // getters / setters omitted for brevity
}
```

---

## Module 3: `taskmaster-e2e`

Playwright smoke tests running against the live API.

### `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    use: {
        baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    },
    reporter: [['html', { outputFolder: 'playwright-report' }], ['json', { outputFile: 'results.json' }]],
});
```

### `task-create.spec.ts` — Smoke test (TASK-102 extends this)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Task Creation API', () => {

    test('creates a task without assignee', async ({ request }) => {
        const res = await request.post('/api/tasks', {
            data: { title: 'Test Task', description: 'A simple test task' }
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.id).toBeDefined();
        expect(body.title).toBe('Test Task');
    });

    test('creates a task with assignee', async ({ request }) => {
        const res = await request.post('/api/tasks', {
            data: { title: 'Assigned Task', assignee: 'alice' }
        });
        expect(res.status()).toBe(200);
    });

    // TASK-102 will add:
    // test('creates a task with due date', async ({ request }) => { ... });
});
```

---

## Root `pom.xml` — Multi-Module Parent

```xml
<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.demo</groupId>
    <artifactId>taskmaster-parent</artifactId>
    <version>1.0.0-SNAPSHOT</version>
    <packaging>pom</packaging>

    <modules>
        <module>taskmaster-core</module>
        <module>taskmaster-api</module>
    </modules>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
    </parent>
</project>
```

---

## PR Template (`.github/pull_request_template.md`)

Agent-generated PRs automatically populate this template:

```markdown
## Summary
<!-- AI-generated PR — review carefully before merging -->

**JIRA Ticket:** [TASK-XXX](https://yourname.atlassian.net/browse/TASK-XXX)
**Ticket Type:** Bug / Story

## Changes Made
<!-- Modules changed and why -->

## Root Cause (Bugs only)
<!-- What caused the bug -->

## Acceptance Criteria Coverage
<!-- Table mapping ACs to code/test locations -->

## Test Coverage
- [ ] Unit tests added/updated
- [ ] E2E test added/updated (if API contract changed)
- [ ] All existing tests pass

## ⚠️ AI-Generated Notice
This PR was created by the TaskMaster AI agent. A human engineer has approved the diff via the HITL gate before this PR was opened. Please review carefully.
```

---

## How to Bootstrap the Repository

```bash
# Create the repo locally
mkdir taskmaster && cd taskmaster
git init

# Create directory structure
mkdir -p taskmaster-core/src/{main,test}/java/com/demo/taskmaster/core/{model,repository,service}
mkdir -p taskmaster-api/src/{main,test}/java/com/demo/taskmaster/api/{controller,dto}
mkdir -p taskmaster-e2e/tests
mkdir -p .github

# Copy all files shown above, then:
git add .
git commit -m "chore: initial TaskMaster project scaffold"

# Push to GitHub
gh repo create taskmaster --private --source=. --push
```

---

??? question "Why is the bug intentionally in the service layer and not the controller?"
    The agent must demonstrate it can trace a NullPointerException from a test failure back to the correct class, even when the error originates several call layers away from the API entry point. A service-layer bug tests the agent's code-reading depth, not just surface-level controller patching.

??? question "Why is taskmaster-e2e a Node.js module in a Java Maven project?"
    Real engineering teams often use different technology stacks for different concerns. The agent must recognise that `taskmaster-e2e` is a Playwright (Node.js) project and generate TypeScript test code — not Java — when the API contract changes.

??? question "What is the minimum change the agent should make for TASK-101?"
    Exactly two files: (1) add a null-check in `TaskService.getSummary()`, and (2) add a new `@Test` case in `TaskServiceTest.java`. The agent should NOT touch `TaskController.java` or any API layer files.

--8<-- "_abbreviations.md"

