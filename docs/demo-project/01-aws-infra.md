# AWS Infrastructure Setup — Step by Step

> **Level:** Intermediate
> **Pre-reading:** [00 · Demo Overview](00-overview.md)

This guide provisions every AWS resource needed to run the TaskMaster AI demo. All resources are in a single AWS region (`us-east-1` recommended — Bedrock Claude availability).

---

## 1. IAM — Roles and Policies

### 1.1 Create the ECS Task Execution Role

```bash
aws iam create-role \
  --role-name taskmaster-ecs-task-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }'
```

Attach these managed policies:

```bash
# Basic ECS execution
aws iam attach-role-policy --role-name taskmaster-ecs-task-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# CloudWatch Logs
aws iam attach-role-policy --role-name taskmaster-ecs-task-role \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess
```

Create an inline policy for Bedrock + Secrets + S3:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:taskmaster/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::taskmaster-artefacts/*"
    }
  ]
}
```

```bash
aws iam put-role-policy --role-name taskmaster-ecs-task-role \
  --policy-name taskmaster-inline \
  --policy-document file://iam-inline-policy.json
```

### 1.2 Lambda Execution Role

```bash
aws iam create-role \
  --role-name taskmaster-lambda-role \
  --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
  }'

aws iam attach-role-policy --role-name taskmaster-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy --role-name taskmaster-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonRDSDataFullAccess
```

---

## 2. Secrets Manager — Store Credentials

Store all secrets under the `taskmaster/` prefix so the IAM policy above grants access:

```bash
# JIRA credentials
aws secretsmanager create-secret \
  --name taskmaster/jira \
  --secret-string '{
    "base_url": "https://yourname.atlassian.net",
    "email": "you@example.com",
    "api_token": "YOUR_JIRA_API_TOKEN"
  }'

# GitHub Personal Access Token
aws secretsmanager create-secret \
  --name taskmaster/github \
  --secret-string '{
    "token": "github_pat_YOUR_TOKEN",
    "repo_owner": "your-github-username",
    "repo_name": "taskmaster"
  }'

# Database credentials
aws secretsmanager create-secret \
  --name taskmaster/db \
  --secret-string '{
    "host": "taskmaster-db.xxxx.us-east-1.rds.amazonaws.com",
    "port": "5432",
    "dbname": "taskmaster",
    "username": "taskmaster_admin",
    "password": "CHANGE_ME_STRONG_PASSWORD"
  }'
```

---

## 3. Amazon RDS — PostgreSQL + pgvector

### 3.1 Create the DB Subnet Group

```bash
# First create a VPC and subnets (or use your default VPC)
aws rds create-db-subnet-group \
  --db-subnet-group-name taskmaster-subnet-group \
  --db-subnet-group-description "TaskMaster demo DB subnet" \
  --subnet-ids subnet-aaaaaaaa subnet-bbbbbbbb
```

### 3.2 Create the RDS Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier taskmaster-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username taskmaster_admin \
  --master-user-password CHANGE_ME_STRONG_PASSWORD \
  --allocated-storage 20 \
  --db-name taskmaster \
  --db-subnet-group-name taskmaster-subnet-group \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --backup-retention-period 0 \
  --no-multi-az \
  --publicly-accessible \
  --tags Key=Project,Value=taskmaster
```

> **Cost note:** `db.t3.medium` costs ~$0.068/hr. Stop the instance when not demoing.

### 3.3 Enable pgvector

Once the RDS instance is running, connect and run:

```sql
-- Connect via psql
psql -h taskmaster-db.xxxx.us-east-1.rds.amazonaws.com \
     -U taskmaster_admin -d taskmaster

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Code embeddings table
CREATE TABLE code_chunks (
    id          SERIAL PRIMARY KEY,
    repo        TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    chunk_text  TEXT NOT NULL,
    embedding   vector(1536),
    module      TEXT,
    language    TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Approximate nearest-neighbour index
CREATE INDEX ON code_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

-- LangGraph checkpoint table (used by PostgresSaver)
CREATE TABLE IF NOT EXISTS checkpoints (
    thread_id   TEXT NOT NULL,
    checkpoint  JSONB NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (thread_id)
);
```

---

## 4. Amazon Bedrock — Enable Model Access

Via the AWS Console (CLI not supported for model access acceptance):

1. Go to **Amazon Bedrock → Model access** in `us-east-1`
2. Click **Manage model access**
3. Enable:
   - `Anthropic / Claude 3.5 Sonnet` (for agent reasoning + code gen)
   - `Amazon / Titan Embeddings V2` (for RAG code indexing)
4. Click **Save changes** — access is provisioned in minutes

---

## 5. Amazon S3 — Artefact Bucket

```bash
aws s3api create-bucket \
  --bucket taskmaster-artefacts \
  --region us-east-1

# Block all public access
aws s3api put-public-access-block \
  --bucket taskmaster-artefacts \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Create folders (S3 prefixes)
aws s3api put-object --bucket taskmaster-artefacts --key diffs/
aws s3api put-object --bucket taskmaster-artefacts --key logs/
aws s3api put-object --bucket taskmaster-artefacts --key repo-snapshots/
```

---

## 6. AWS Lambda — Webhook Receiver

The Lambda function receives JIRA and GitHub webhooks via API Gateway.

### 6.1 Package and Deploy

```bash
# Create lambda directory
mkdir -p lambda/webhook-receiver
cat > lambda/webhook-receiver/handler.py << 'EOF'
import json
import boto3
import os

sqs = boto3.client('sqs')
QUEUE_URL = os.environ['WEBHOOK_QUEUE_URL']

def handler(event, context):
    body = json.loads(event.get('body', '{}'))
    source = event['headers'].get('x-webhook-source', 'unknown')
    
    # Forward to SQS for async processing
    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps({'source': source, 'payload': body})
    )
    return {'statusCode': 200, 'body': json.dumps({'received': True})}
EOF

cd lambda/webhook-receiver
zip -r webhook-receiver.zip handler.py

aws lambda create-function \
  --function-name taskmaster-webhook-receiver \
  --runtime python3.11 \
  --role arn:aws:iam::ACCOUNT_ID:role/taskmaster-lambda-role \
  --handler handler.handler \
  --zip-file fileb://webhook-receiver.zip \
  --environment Variables="{WEBHOOK_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/taskmaster-webhooks}"
```

### 6.2 Create SQS Queue

```bash
aws sqs create-queue \
  --queue-name taskmaster-webhooks \
  --attributes '{"VisibilityTimeout":"300","MessageRetentionPeriod":"86400"}'
```

---

## 7. Amazon API Gateway — Public Endpoint

```bash
# Create HTTP API
aws apigatewayv2 create-api \
  --name taskmaster-api-gw \
  --protocol-type HTTP \
  --cors-configuration \
    AllowOrigins='["*"]',AllowMethods='["POST","GET"]',AllowHeaders='["*"]'
```

Configure two routes:
- `POST /webhooks/jira` → Lambda (webhook receiver)
- `POST /webhooks/github` → Lambda (webhook receiver)
- `GET/POST /chat` → ECS service (chat engine)

Note the API Gateway invoke URL — you'll need it when configuring the JIRA webhook in [03 · JIRA Setup](03-jira-setup.md).

---

## 8. Amazon ECS — Chat Engine Container

### 8.1 ECR Repository

```bash
aws ecr create-repository --repository-name taskmaster-chat-engine
aws ecr create-repository --repository-name taskmaster-jira-mcp
aws ecr create-repository --repository-name taskmaster-github-mcp
```

### 8.2 ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name taskmaster-cluster \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
```

### 8.3 Task Definition (with MCP sidecars)

```json
{
  "family": "taskmaster-agent",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/taskmaster-ecs-task-role",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/taskmaster-ecs-task-role",
  "containerDefinitions": [
    {
      "name": "chat-engine",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/taskmaster-chat-engine:latest",
      "portMappings": [{"containerPort": 8080}],
      "environment": [
        {"name": "AWS_REGION", "value": "us-east-1"},
        {"name": "DB_SECRET_ARN", "value": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:taskmaster/db"},
        {"name": "JIRA_MCP_URL", "value": "http://localhost:8001"},
        {"name": "GITHUB_MCP_URL", "value": "http://localhost:8002"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/taskmaster",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "chat-engine"
        }
      }
    },
    {
      "name": "jira-mcp",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/taskmaster-jira-mcp:latest",
      "portMappings": [{"containerPort": 8001}]
    },
    {
      "name": "github-mcp",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/taskmaster-github-mcp:latest",
      "portMappings": [{"containerPort": 8002}]
    }
  ]
}
```

---

## 9. CloudWatch — Logs and Alarms

```bash
# Create log group
aws logs create-log-group --log-group-name /ecs/taskmaster
aws logs put-retention-policy --log-group-name /ecs/taskmaster --retention-in-days 7

# Alarm: agent error rate
aws cloudwatch put-metric-alarm \
  --alarm-name taskmaster-agent-errors \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --dimensions Name=FunctionName,Value=taskmaster-webhook-receiver \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:taskmaster-alerts
```

---

## Infrastructure Summary Table

| Resource | Name | Purpose | Est. Cost/hr |
|---|---|---|---|
| RDS db.t3.medium | `taskmaster-db` | pgvector + LangGraph state | $0.068 |
| ECS Fargate 1vCPU/2GB | `taskmaster-agent` | Chat engine + MCP sidecars | $0.04 |
| Lambda | `taskmaster-webhook-receiver` | Webhook ingestion | Pay-per-use |
| API Gateway | `taskmaster-api-gw` | Public HTTPS entry point | Pay-per-use |
| S3 | `taskmaster-artefacts` | Diffs, logs | ~$0.001 |
| Bedrock (Claude) | — | LLM inference | ~$0.003/1K tokens |
| Bedrock (Titan) | — | Embeddings | ~$0.0001/1K tokens |

> **Total for a 4-hour demo session:** ~$1–3

---

??? question "How do I avoid unexpected AWS costs after the demo?"
    Run `aws rds stop-db-instance --db-instance-identifier taskmaster-db` and scale ECS service to 0 tasks when not in use. Set up a CloudWatch billing alarm at $10/month to catch any runaway costs.

??? question "Why Fargate instead of EC2?"
    Fargate means no EC2 instance management — you pay per task per second. For a demo that runs a few hours a week, it's significantly cheaper than keeping an EC2 instance running 24/7.

??? question "Can I use a single AWS account for this without affecting other workloads?"
    Yes. Use AWS Organizations with a dedicated child account named `taskmaster-demo`. This isolates all resources and billing, and you can delete the entire account after the demo.

--8<-- "_abbreviations.md"

