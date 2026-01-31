#!/bin/bash
set -e

echo "🚀 Deploying Nextflow on AWS using profile: henry"

# Set AWS profile
export AWS_PROFILE=henry

# Get account and region from the profile
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=$(aws configure get region --profile henry || echo "us-east-1")

echo "📋 Account ID: $CDK_DEFAULT_ACCOUNT"
echo "🌍 Region: $CDK_DEFAULT_REGION"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from .env.local..."
    cp .env.local .env
    echo "✏️  Please edit .env file with your settings, then run this script again."
    exit 1
fi

# Source environment variables
set -a
source .env
set +a

echo ""
echo "📦 Building TypeScript..."
npm run build || true  # Continue even if there are dependency errors

echo ""
echo "🎯 Step 1: Bootstrap CDK (if not already done)"
read -p "Do you want to bootstrap CDK? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}
fi

echo ""
echo "🎯 Step 2: Deploy Image Builder"
read -p "Deploy Image Builder stack? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx cdk deploy NextflowImageBuilderStack -a "node bin/image-builder/app.js"
    
    echo ""
    echo "🔨 Trigger Nextflow image build?"
    read -p "Start CodeBuild? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        aws codebuild start-build --project-name nextflow-image-builder
        echo "⏳ Build started. Check progress at:"
        echo "   https://console.aws.amazon.com/codesuite/codebuild/projects/nextflow-image-builder"
        echo ""
        echo "⚠️  Wait for the build to complete (5-10 minutes) before deploying core infrastructure!"
        echo "   You can monitor with: aws logs tail /aws/codebuild/nextflow-image-builder --follow"
        exit 0
    fi
fi

echo ""
echo "🎯 Step 3: Deploy Core Infrastructure"
read -p "Deploy Core Infrastructure stack? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx cdk deploy -a "node bin/core/app.js" --all
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📝 Get your API key:"
    echo "   aws ssm get-parameter --name '/nextflow/wes/api-key' --with-decryption --query 'Parameter.Value' --output text"
    echo ""
    echo "📝 Get stack outputs:"
    echo "   aws cloudformation describe-stacks --stack-name NextflowStack --query 'Stacks[0].Outputs' --output table"
fi

echo ""
echo "✨ Done!"
