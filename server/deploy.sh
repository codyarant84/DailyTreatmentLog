#!/bin/bash
set -euo pipefail

ECR_REGION="us-east-2"
ECS_REGION="us-east-1"
ACCOUNT_ID="470309606015"
REPO="fieldside-server"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${ECR_REGION}.amazonaws.com"
IMAGE="${ECR_REGISTRY}/${REPO}"
ECS_CLUSTER="fieldside-cluster"
ECS_SERVICE="fieldside-server"
TASK_FAMILY="fieldside-server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> [1/6] Building Docker image for linux/amd64 (no cache)..."
docker build --platform linux/amd64 --no-cache -t "${REPO}" "${SCRIPT_DIR}"

echo "==> [2/6] Authenticating with ECR (${ECR_REGION})..."
aws ecr get-login-password --region "${ECR_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

echo "==> [3/6] Tagging and pushing image to ECR..."
docker tag "${REPO}:latest" "${IMAGE}:latest"
docker push "${IMAGE}:latest"
echo "    Pushed: ${IMAGE}:latest"

echo "==> [4/6] Registering new ECS task definition..."
NEW_TASK_DEF=$(aws ecs register-task-definition \
  --region "${ECS_REGION}" \
  --cli-input-json "file://${SCRIPT_DIR}/task-definition.json" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
echo "    Registered: ${NEW_TASK_DEF}"

echo "==> [5/6] Updating ECS service with new task definition..."
aws ecs update-service \
  --region "${ECS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --task-definition "${NEW_TASK_DEF}" \
  --force-new-deployment \
  --query 'service.deployments[0].{status:status,desired:desiredCount,running:runningCount,pending:pendingCount}' \
  --output table

echo "==> [6/6] Waiting for deployment to stabilize (this may take a few minutes)..."
aws ecs wait services-stable \
  --region "${ECS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE}"

echo ""
echo "Deployment complete."
aws ecs describe-services \
  --region "${ECS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE}" \
  --query 'services[0].deployments[*].{status:status,taskDef:taskDefinition,desired:desiredCount,running:runningCount,pending:pendingCount}' \
  --output table
