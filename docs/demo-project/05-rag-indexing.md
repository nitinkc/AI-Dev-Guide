# RAG Code Indexing Pipeline

> **Level:** Intermediate
> **Pre-reading:** [00 · Demo Overview](00-overview.md) · [03.01 · RAG Pipeline](../03.01-rag-pipeline.md) · [01 · AWS Infra](01-aws-infra.md)

This document covers the pipeline that ingests the `taskmaster` codebase into a pgvector store so the agent can retrieve contextually relevant code when resolving JIRA tickets.

---

## Why RAG the Codebase?

When the agent receives TASK-101 ("Fix NullPointerException in TaskService"), it doesn't grep the whole repo — it retrieves the most semantically similar code chunks:

```
Query: "NullPointerException assignee field TaskService"
  →  taskmaster-core/src/.../TaskService.java (score: 0.93)
  →  taskmaster-core/src/.../Task.java        (score: 0.87)
  →  TaskServiceTest.java                     (score: 0.81)
```

This gives the LLM precise context without blowing the context window with the entire repo.

---

## Indexing Architecture

```mermaid
graph LR
    GH["GitHub<br/>taskmaster repo"] -->|clone| Ingestion["Ingestion Lambda<br/>or local script"]
    Ingestion -->|chunk Java/TS files| Chunker["Chunker<br/>Function-level splitter"]
    Chunker -->|text chunks| Bedrock["Amazon Bedrock<br/>Titan Embeddings V2<br/>1536 dims"]
    Bedrock -->|vectors| PGV["RDS pgvector<br/>code_chunks table"]
    GH -->|push event| WebHook["GitHub Webhook<br/>→ Lambda trigger"]
    WebHook -->|re-index changed files| Ingestion
```

---

## 1. Chunking Strategy

Java and TypeScript files are chunked at **method/function level**, not line count. This keeps each chunk semantically coherent.

```python
import re
from dataclasses import dataclass
from typing import Generator

@dataclass
class CodeChunk:
    file_path: str
    module: str
    language: str
    chunk_text: str
    start_line: int
    end_line: int

def detect_module(file_path: str) -> str:
    """Infer module from file path."""
    if 'taskmaster-core' in file_path:
        return 'taskmaster-core'
    elif 'taskmaster-api' in file_path:
        return 'taskmaster-api'
    elif 'taskmaster-e2e' in file_path:
        return 'taskmaster-e2e'
    return 'unknown'

def chunk_java_file(file_path: str, source: str) -> Generator[CodeChunk, None, None]:
    """Split a Java file into class-level and method-level chunks."""
    module = detect_module(file_path)
    lines = source.splitlines()
    
    # Yield the full class as one chunk (for class-level context)
    yield CodeChunk(
        file_path=file_path,
        module=module,
        language='java',
        chunk_text=source[:4000],  # cap at ~4000 chars
        start_line=1,
        end_line=len(lines)
    )
    
    # Yield each method as its own chunk
    method_pattern = re.compile(
        r'((?:(?:public|private|protected|static|final|synchronized)\s+)+)'
        r'(\w+)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{',
        re.MULTILINE
    )
    for match in method_pattern.finditer(source):
        start = source.rfind('\n', 0, match.start()) + 1
        # Find matching closing brace
        depth = 0
        end = match.start()
        for i, ch in enumerate(source[match.start():], match.start()):
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        
        chunk_text = source[start:end]
        if len(chunk_text) > 100:  # skip trivial getters/setters
            yield CodeChunk(
                file_path=file_path,
                module=module,
                language='java',
                chunk_text=chunk_text[:3000],
                start_line=source[:start].count('\n') + 1,
                end_line=source[:end].count('\n') + 1
            )

def chunk_typescript_file(file_path: str, source: str) -> Generator[CodeChunk, None, None]:
    """Split a TypeScript/Playwright file into test-block chunks."""
    module = detect_module(file_path)
    
    # Yield the full file for small files
    if len(source) < 3000:
        yield CodeChunk(file_path, module, 'typescript', source, 1, source.count('\n') + 1)
        return
    
    # Split on test() and describe() blocks
    test_pattern = re.compile(r'^(?:test|it|describe)\s*\(', re.MULTILINE)
    positions = [m.start() for m in test_pattern.finditer(source)] + [len(source)]
    
    for i in range(len(positions) - 1):
        chunk_text = source[positions[i]:positions[i + 1]]
        if len(chunk_text) > 50:
            yield CodeChunk(
                file_path=file_path,
                module=module,
                language='typescript',
                chunk_text=chunk_text[:3000],
                start_line=source[:positions[i]].count('\n') + 1,
                end_line=source[:positions[i + 1]].count('\n') + 1
            )
```

---

## 2. Embedding with Amazon Bedrock Titan

```python
import boto3
import json

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

def embed_text(text: str) -> list[float]:
    """Generate a 1536-dim embedding using Amazon Titan Embeddings V2."""
    response = bedrock.invoke_model(
        modelId='amazon.titan-embed-text-v2:0',
        body=json.dumps({
            "inputText": text,
            "dimensions": 1536,
            "normalize": True
        }),
        contentType='application/json',
        accept='application/json'
    )
    return json.loads(response['body'].read())['embedding']
```

---

## 3. Storing Chunks in pgvector

```python
import psycopg2
from psycopg2.extras import execute_batch

def get_db_connection(secret: dict):
    return psycopg2.connect(
        host=secret['host'],
        port=secret['port'],
        dbname=secret['dbname'],
        user=secret['username'],
        password=secret['password']
    )

def upsert_chunks(conn, chunks: list[CodeChunk], embeddings: list[list[float]]):
    with conn.cursor() as cur:
        execute_batch(cur, """
            INSERT INTO code_chunks (repo, file_path, chunk_text, embedding, module, language, updated_at)
            VALUES (%(repo)s, %(file_path)s, %(chunk_text)s, %(embedding)s::vector,
                    %(module)s, %(language)s, NOW())
            ON CONFLICT (repo, file_path, chunk_text)
            DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()
        """, [
            {
                'repo': 'taskmaster',
                'file_path': c.file_path,
                'chunk_text': c.chunk_text,
                'embedding': embeddings[i],
                'module': c.module,
                'language': c.language
            }
            for i, c in enumerate(chunks)
        ])
    conn.commit()
```

---

## 4. Full Indexing Script

```python
#!/usr/bin/env python3
"""
index_codebase.py — Clone the taskmaster repo and index all Java/TS files
Usage: python3 index_codebase.py
"""
import os
import boto3
import json
import subprocess
import tempfile
from pathlib import Path

def get_secret(secret_id: str) -> dict:
    client = boto3.client('secretsmanager', region_name='us-east-1')
    return json.loads(client.get_secret_value(SecretId=secret_id)['SecretString'])

def clone_repo(github_secret: dict, target_dir: str) -> None:
    token = github_secret['token']
    owner = github_secret['repo_owner']
    repo = github_secret['repo_name']
    url = f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"
    subprocess.run(['git', 'clone', '--depth=1', url, target_dir], check=True)

def index_repo(repo_dir: str, conn, include_extensions=('.java', '.ts')):
    from itertools import islice
    
    all_chunks = []
    for ext in include_extensions:
        for path in Path(repo_dir).rglob(f'*{ext}'):
            # Skip target/build directories
            if any(skip in str(path) for skip in ['/target/', '/node_modules/', '/.git/']):
                continue
            
            source = path.read_text(encoding='utf-8', errors='ignore')
            rel_path = str(path.relative_to(repo_dir))
            
            if ext == '.java':
                all_chunks.extend(chunk_java_file(rel_path, source))
            elif ext == '.ts':
                all_chunks.extend(chunk_typescript_file(rel_path, source))
    
    # Batch embed (Bedrock has no batch endpoint — do in groups of 10)
    BATCH_SIZE = 10
    for i in range(0, len(all_chunks), BATCH_SIZE):
        batch = all_chunks[i:i + BATCH_SIZE]
        embeddings = [embed_text(c.chunk_text) for c in batch]
        upsert_chunks(conn, batch, embeddings)
        print(f"  Indexed {min(i + BATCH_SIZE, len(all_chunks))}/{len(all_chunks)} chunks")

if __name__ == '__main__':
    github_secret = get_secret('taskmaster/github')
    db_secret = get_secret('taskmaster/db')
    
    with tempfile.TemporaryDirectory() as tmpdir:
        print("Cloning repo...")
        clone_repo(github_secret, tmpdir)
        
        print("Connecting to DB...")
        conn = get_db_connection(db_secret)
        
        print("Indexing codebase...")
        index_repo(tmpdir, conn)
        
        conn.close()
        print("✅ Indexing complete!")
```

Run it once to bootstrap the index:

```bash
source .venv/bin/activate
python3 index_codebase.py
```

---

## 5. Retrieval at Query Time

```python
def retrieve_relevant_code(query: str, conn, module_filter: str = None,
                            top_k: int = 5) -> list[dict]:
    """Retrieve top-K most relevant code chunks for a given query."""
    query_embedding = embed_text(query)
    
    with conn.cursor() as cur:
        if module_filter:
            cur.execute("""
                SELECT file_path, module, language, chunk_text,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM code_chunks
                WHERE repo = 'taskmaster' AND module = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (query_embedding, module_filter, query_embedding, top_k))
        else:
            cur.execute("""
                SELECT file_path, module, language, chunk_text,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM code_chunks
                WHERE repo = 'taskmaster'
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (query_embedding, query_embedding, top_k))
        
        return [
            {
                'file_path': row[0],
                'module': row[1],
                'language': row[2],
                'chunk_text': row[3],
                'similarity': float(row[4])
            }
            for row in cur.fetchall()
        ]
```

---

## 6. Incremental Re-Index on Push

When the agent pushes a fix branch, it re-indexes only the changed files via Lambda:

```python
# lambda/reindex-trigger/handler.py
import json
import subprocess
import tempfile

def handler(event, context):
    """Triggered by SQS message from GitHub push webhook."""
    for record in event['Records']:
        body = json.loads(record['body'])
        if body.get('source') != 'github':
            continue
        
        payload = body['payload']
        changed_files = [
            f['filename'] for commit in payload.get('commits', [])
            for f in commit.get('added', []) + commit.get('modified', [])
            if f.endswith('.java') or f.endswith('.ts')
        ]
        
        if changed_files:
            print(f"Re-indexing {len(changed_files)} changed files")
            # Re-run indexing for only the changed files
            reindex_files(changed_files)
```

---

## pgvector Schema Reference

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL | Primary key |
| `repo` | TEXT | Repository name (e.g., `taskmaster`) |
| `file_path` | TEXT | Relative path within the repo |
| `chunk_text` | TEXT | The source code chunk (max ~3000 chars) |
| `embedding` | vector(1536) | Titan Embeddings V2 vector |
| `module` | TEXT | Module name (`taskmaster-core`, `taskmaster-api`, etc.) |
| `language` | TEXT | `java` or `typescript` |
| `updated_at` | TIMESTAMPTZ | Last indexed timestamp |

---

??? question "Why chunk at method level rather than fixed line count?"
    Method-level chunks ensure each chunk is semantically complete. A fixed 50-line window might split a method in half, making retrieval less useful. The agent needs to see the full `getSummary()` method to understand and fix it.

??? question "How many chunks does the taskmaster repo produce?"
    Approximately 30–60 chunks for the initial scaffold (3 modules, ~10 files, 3–8 methods each). At $0.0001 per 1K tokens for Titan Embeddings, the full initial index costs under $0.01.

??? question "Can I use OpenAI embeddings instead of Bedrock Titan?"
    Yes. Replace `embed_text()` with `openai.embeddings.create(model='text-embedding-3-small', input=text)`. The vector dimensions differ (1536 for Titan, 1536 for ada-002, 3072 for text-embedding-3-large) — match the `vector(N)` column definition accordingly.

--8<-- "_abbreviations.md"

