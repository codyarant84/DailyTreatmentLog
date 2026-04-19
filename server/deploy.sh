#!/bin/bash
set -euo pipefail

REGION="us-east-2"
ACCOUNT_ID="470309606015"
REPO="fieldside-server"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE="${ECR_REGISTRY}/${REPO}"

echo "==> Building Docker image..."
docker build -t "${REPO}" .

echo "==> Authenticating Docker with ECR..."
aws ecr get-login-password --region "${REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

echo "==> Tagging image..."
docker tag "${REPO}:latest" "${IMAGE}:latest"

echo "==> Pushing image to ECR..."
docker push "${IMAGE}:latest"

echo ""
echo "Done. Image pushed to: ${IMAGE}:latest"
