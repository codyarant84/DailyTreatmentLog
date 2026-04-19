#!/bin/bash
set -e

docker run --rm -p 3001:3001 \
  -e PORT=3001 \
  -e SUPABASE_URL=https://wfnihoupdqqqwmafpwbw.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY \
  -e ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY \
  -e DATABASE_URL='postgresql://fieldside:YOUR_DB_PASSWORD@fieldside-db.cvsei0img6dl.us-east-2.rds.amazonaws.com:5432/postgres?sslmode=require' \
  -e JWT_SECRET=YOUR_JWT_SECRET \
  -e AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY \
  -e AWS_REGION=us-east-2 \
  -e S3_BUCKET_NAME=fieldside-logos \
  -e ECR_REGISTRY=470309606015.dkr.ecr.us-east-2.amazonaws.com \
  -e ECR_REPOSITORY=fieldside-server \
  -e RESEND_API_KEY=YOUR_RESEND_API_KEY \
  fieldside-server
