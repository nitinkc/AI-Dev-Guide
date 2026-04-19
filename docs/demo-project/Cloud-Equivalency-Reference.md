# Cloud Equivalency Quick Reference

> **TL;DR:** How to map AWS → GCP → Azure for every component in this demo

---

## Services at a Glance

| Capability | AWS | GCP | Azure |
|:-----------|:----|:----|:------|
| **LLM (Claude equivalent)** | Bedrock | Vertex AI (Gemini) | Azure OpenAI (GPT-4) |
| **Embeddings** | Titan Embeddings V2 | Text Embeddings Gecko | Ada-002 |
| **Vector Database** | OpenSearch / RDS pgvector | Cloud SQL pgvector | Cosmos DB (Vector DB) |
| **Container Registry** | ECR | Artifact Registry | ACR |
| **Container Orchestration** | ECS/EKS | GKE | AKS |
| **Serverless Containers** | Fargate / AppRunner | Cloud Run | Container Apps |
| **Serverless Functions** | Lambda | Cloud Functions | Azure Functions |
| **Secrets Management** | Secrets Manager | Secret Manager | Key Vault |
| **Authentication** | IAM | Cloud IAM | Azure AD |
| **Managed Database** | RDS | Cloud SQL | Azure Database |
| **Object Storage** | S3 | Cloud Storage | Blob Storage |
| **Data Pipeline / ETL** | Lambda + SQS | Cloud Dataflow | Data Factory |
| **Webhooks / Events** | EventBridge + Lambda | Pub/Sub | Event Grid + Functions |
| **Logging** | CloudWatch | Cloud Logging | Azure Monitor |
| **Metrics** | CloudWatch | Cloud Monitoring | Azure Monitor |
| **Cost Analytics** | Cost Explorer | Cloud Billing | Cost Management |

---

## Detailed Mappings

### Credentials & Secrets

```
AWS                          GCP                           Azure
─────────────────────────────────────────────────────────────────────
Secrets Manager              Secret Manager                Key Vault
├─ create-secret             ├─ gcloud secrets create      ├─ az keyvault secret set
├─ get-secret-value          ├─ client.access_secret       ├─ SecretClient.get_secret
├─ boto3 client              ├─ secretmanager client       ├─ DefaultAzureCredential
├─ $0.40/month per secret    ├─ $0.06/month per secret     ├─ $0.50/month per secret
└─ IAM role-based access     └─ Service account roles      └─ Managed Identity

Implementation:
AWS:   secrets_provider = AWSSecretsManager(region='us-east-1')
GCP:   secrets_provider = GCPSecretManager(project_id='my-project')
Azure: secrets_provider = AzureKeyVault(vault_url='https://xxx.vault.azure.net/')
```

### LLM Inference

```
AWS                          GCP                           Azure
─────────────────────────────────────────────────────────────────────
Bedrock                      Vertex AI                     Azure OpenAI
├─ Models: Claude 3.5        ├─ Models: Gemini 2.0         ├─ Models: GPT-4
├─ Embeddings: Titan         ├─ Embeddings: Gecko          ├─ Embeddings: Ada-002
├─ $0.003/token input        ├─ $0.00025/token input       ├─ $0.03/token input
├─ $0.015/token output       ├─ $0.001/token output        ├─ $0.06/token output
├─ boto3.invoke_model()      ├─ generativeai.generate()    ├─ openai.ChatCompletion.create()
└─ VPC endpoint support      └─ VPC-SC support             └─ Private endpoints

Implementation:
AWS:   llm = BedrockLLM()
GCP:   llm = VertexLLM()
Azure: llm = AzureOpenAILLM()
```

### Vector Database

```
AWS                          GCP                           Azure
─────────────────────────────────────────────────────────────────────
RDS PostgreSQL + pgvector   Cloud SQL + pgvector          Cosmos DB + Vector API
├─ db-t3.micro              ├─ db-f1-micro                ├─ Serverless (pay-per-req)
├─ $15–30/month             ├─ $10–20/month               ├─ $25–50/month
├─ psycopg2 connection      ├─ psycopg2 connection        ├─ pymongo / native SDK
├─ CREATE EXTENSION vector  ├─ CREATE EXTENSION vector    ├─ Built-in vector support
└─ IVFFLAT indexing         └─ IVFFLAT indexing           └─ HNSW indexing

Schema (identical across all):
PostgreSQL:
  CREATE TABLE code_chunks (
    id SERIAL PRIMARY KEY,
    embedding vector(1536),
    chunk_text TEXT,
    module TEXT
  );
  CREATE INDEX ON code_chunks USING ivfflat (embedding vector_cosine_ops);

Azure Cosmos DB:
  {
    "_id": "chunk-1",
    "embedding": [0.1, 0.2, ...],  -- 1536-dim vector
    "chunk_text": "...",
    "module": "..."
  }
```

### Container Orchestration

```
AWS                          GCP                           Azure
─────────────────────────────────────────────────────────────────────
ECS (managed)                GKE (managed K8s)             AKS (managed K8s)
├─ Fargate (serverless)      ├─ Autopilot (serverless)     ├─ Container Apps (simple)
├─ $0.05/hour per vCPU       ├─ $0.04/hour per vCPU        ├─ Pay-per-request
├─ Task definitions (JSON)   ├─ Helm charts / Kustomize    ├─ YAML manifests
├─ Security groups + IAM     ├─ Cloud IAM roles            ├─ Azure RBAC
└─ CloudWatch logs           └─ Cloud Logging              └─ Azure Monitor

For this demo (3 containers: agent + 2 MCPs):
AWS:   ECS Task (one Fargate task running 3 containers)
GCP:   Cloud Run (3 separate Cloud Run services, or 1 GKE pod)
Azure: Container Apps (1 container app with sidecar)
```

### Webhooks & Events (JIRA Push Trigger)

```
AWS                          GCP                           Azure
─────────────────────────────────────────────────────────────────────
EventBridge + Lambda         Cloud Pub/Sub + Functions     Event Grid + Functions
├─ JIRA → API Gateway        ├─ JIRA → Pub/Sub Topic       ├─ JIRA → Event Grid Topic
├─ Trigger Lambda            ├─ Cloud Function subscribed  ├─ Function subscribed
├─ Re-index codebase         ├─ Re-index codebase          ├─ Re-index codebase
├─ $0.00001263 per request   ├─ Free (pub/sub)             ├─ $0.60 per million ops
└─ CloudTrail logging        └─ Cloud Audit Logs           └─ Activity Logs

Implementation (all trigger code indexing Lambda/Function):
AWS:   EventBridge rule → invoke Lambda re-index
GCP:   Pub/Sub → Cloud Functions trigger
Azure: Event Grid → Function binding
```

### Logging & Monitoring

```
AWS                          GCP                           Azure
─────────────────────────────────────────────────────────────────────
CloudWatch Logs              Cloud Logging                 Azure Monitor (Logs)
├─ Log groups                ├─ Log buckets                ├─ Log Analytics workspace
├─ Log streams               ├─ Log routers                ├─ Tables
├─ $0.50 per GB ingested     ├─ $0.50 per GB ingested      ├─ $2.99 per GB ingested
├─ boto3.put_log_events()    ├─ google.cloud.logging       ├─ azure.monitor.query
└─ CloudTrail for API audit  └─ Cloud Audit Logs           └─ Activity Log

Example: Log agent startup
AWS:
  import boto3
  logs = boto3.client('logs')
  logs.create_log_group(logGroupName='/taskmaster/agent')
  logs.put_log_events(
    logGroupName='/taskmaster/agent',
    logStreamName='startup',
    logEvents=[{'timestamp': now, 'message': 'Agent started'}]
  )

GCP:
  from google.cloud import logging as gcp_logging
  logger = gcp_logging.Client().logger('taskmaster-agent')
  logger.log_struct({'event': 'startup', 'version': '1.0'})

Azure:
  from azure.monitor.query import LogsQueryClient
  client = LogsQueryClient(credential)
  # Log via Application Insights (automatically if Flask/Django)
```

---

## Code Template: Cloud-Agnostic Implementation

All implementations follow this pattern:

```python
# config.py
import os

CLOUD_PROVIDER = os.getenv('CLOUD_PROVIDER', 'aws').lower()

def get_secrets_provider():
    if CLOUD_PROVIDER == 'aws':
        from aws import AWSSecretsManager
        return AWSSecretsManager()
    elif CLOUD_PROVIDER == 'gcp':
        from gcp import GCPSecretManager
        return GCPSecretManager()
    elif CLOUD_PROVIDER == 'azure':
        from azure import AzureKeyVault
        return AzureKeyVault()

def get_llm_provider():
    if CLOUD_PROVIDER == 'aws':
        from aws import BedrockLLM
        return BedrockLLM()
    elif CLOUD_PROVIDER == 'gcp':
        from gcp import VertexLLM
        return VertexLLM()
    elif CLOUD_PROVIDER == 'azure':
        from azure import AzureOpenAILLM
        return AzureOpenAILLM()

def get_database_connection():
    secrets = get_secrets_provider()
    db_creds = secrets.get_secret('taskmaster/db')
    
    import psycopg2
    return psycopg2.connect(
        host=db_creds['host'],
        port=db_creds['port'],
        user=db_creds['username'],
        password=db_creds['password'],
        database='taskmaster'
    )

# Usage (same everywhere)
secrets = get_secrets_provider()
llm = get_llm_provider()
db = get_database_connection()
```

---

## Environment Variables per Cloud

### AWS
```bash
export CLOUD_PROVIDER=aws
export AWS_REGION=us-east-1
export SECRETS_PROVIDER=aws
export LLM_PROVIDER=aws
export EMBEDDINGS_PROVIDER=aws
```

### GCP
```bash
export CLOUD_PROVIDER=gcp
export GCP_PROJECT_ID=my-project
export SECRETS_PROVIDER=gcp
export LLM_PROVIDER=gcp
export EMBEDDINGS_PROVIDER=gcp
```

### Azure
```bash
export CLOUD_PROVIDER=azure
export AZURE_SUBSCRIPTION_ID=xxx
export AZURE_RESOURCE_GROUP=mygroup
export AZURE_VAULT_URL=https://taskmaster-kv.vault.azure.net/
export AZURE_OPENAI_ENDPOINT=https://xxx.openai.azure.com/
export AZURE_OPENAI_KEY=xxx
export SECRETS_PROVIDER=azure
export LLM_PROVIDER=azure
export EMBEDDINGS_PROVIDER=azure
```

---

## Pricing: 1 Month Breakdown

### AWS
```
Bedrock (1M tokens)          $5.00
Titan Embeddings (1M)        $1.00
RDS PostgreSQL (t3.micro)    $15.00
ECS Fargate (2 vCPU-hr/day)  $50.00
Secrets Manager (2 secrets)  $0.80
CloudWatch Logs (5GB)        $2.50
────────────────────────────
TOTAL                        $74.30
```

### GCP
```
Vertex AI (1M tokens)        $3.00
Text Embeddings (1M)         $0.30
Cloud SQL (f1-micro)         $10.00
Cloud Run (500K requests)    $2.50
Secret Manager (2 secrets)   $0.12
Cloud Logging (5GB)          $2.50
────────────────────────────
TOTAL                        $18.42  ✅ CHEAPEST
```

### Azure
```
Azure OpenAI (1M tokens)     $6.00
Ada Embeddings (1M)          $1.00
Database for PostgreSQL      $35.00
Container Apps (500K req)    $10.00
Key Vault (2 secrets)        $1.00
Azure Monitor (5GB)          $2.50
────────────────────────────
TOTAL                        $55.50
```

---

## Quick Decision: Which Cloud?

| Factor | Best | Second | Third |
|:-------|:----:|:------:|:-----:|
| **Cost** | GCP | Azure | AWS |
| **Ease of Use** | GCP (Cloud Run) | Azure (Container Apps) | AWS (ECS) |
| **Documentation** | AWS | GCP | Azure |
| **Enterprise** | Azure (AD integration) | AWS | GCP |
| **Performance** | GCP | AWS | Azure |
| **Free Tier** | GCP (always) | AWS/Azure (12mo) | AWS/Azure (12mo) |

**Recommendation:** Start with **GCP** (cheapest + easiest), migrate to **AWS** if you need compliance/auditing.

---

## Migration Checklist

To move from one cloud to another:

- [ ] Export database (pg_dump all vectors)
- [ ] Update environment variables
- [ ] Rebuild containers with new CLOUD_PROVIDER
- [ ] Update secrets in new cloud
- [ ] Test MCP servers locally first
- [ ] Deploy to new cloud
- [ ] Verify agent still works
- [ ] Decommission old cloud resources

**Estimated time:** 2–4 hours (mostly waiting for services to spin up)

---

## Common Pitfalls

| Pitfall | Solution |
|:--------|:---------|
| Hardcoding AWS region | Use `CLOUD_PROVIDER` + region env var |
| Mixing cloud SDKs | Use abstract factory pattern |
| Data locked in one cloud | Standardize on PostgreSQL + pgvector |
| Different auth patterns | Use DefaultAzureCredential, assume IAM roles, etc. |
| Cost surprises | Monitor each cloud's cost dashboard weekly |

---

??? question "Can I run the same Docker image on all clouds?"
    Yes! Just set `CLOUD_PROVIDER` env var. One Dockerfile, infinite clouds.

??? question "Which cloud is fastest for LLM inference?"
    **GCP Vertex AI** (~1–2 sec), **AWS Bedrock** (~2–3 sec), **Azure OpenAI** (~2–4 sec). Similar enough; don't optimize for this.

??? question "What if my data doesn't fit in pgvector?"
    PostgreSQL + pgvector handles millions of vectors. If larger, switch to specialized vector DB: **AWS:** OpenSearch, **GCP:** Vertex Vector Search, **Azure:** Cosmos DB Vector API.

??? question "Can I use Ollama (local LLM) instead?"
    Yes! Create `OllamaLLM` provider. No cloud dependency. Trade-off: slower, requires GPU locally.

--8<-- "_abbreviations.md"

