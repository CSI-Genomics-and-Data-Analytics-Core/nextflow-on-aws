#!/bin/bash
set -e

echo "Setting up API Gateway CloudWatch Logs role..."

# Create trust policy
cat > /tmp/trust-policy.json << 'TRUST'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
TRUST

# Create the role (or get existing)
ROLE_ARN=$(aws iam create-role \
  --role-name APIGatewayCloudWatchLogsRole \
  --assume-role-policy-document file:///tmp/trust-policy.json \
  --query 'Role.Arn' \
  --output text 2>/dev/null || aws iam get-role --role-name APIGatewayCloudWatchLogsRole --query 'Role.Arn' --output text)

echo "Role ARN: $ROLE_ARN"

# Attach the managed policy
aws iam attach-role-policy \
  --role-name APIGatewayCloudWatchLogsRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs 2>/dev/null || echo "Policy already attached"

echo "Waiting for role to propagate..."
sleep 10

# Set the role in API Gateway account settings
aws apigateway update-account \
  --patch-operations op=replace,path=/cloudwatchRoleArn,value=$ROLE_ARN

echo ""
echo "✅ API Gateway CloudWatch Logs role configured successfully!"
echo "You can now deploy your CDK stack."

# Cleanup
rm -f /tmp/trust-policy.json
