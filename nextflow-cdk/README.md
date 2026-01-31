# Nextflow Infrastructure provisioning via CDK (TypeScript)

This directory contains the AWS CDK infrastructure code for deploying Nextflow on AWS.

## Quick Start

### Prerequisites

- Node.js 14+ and npm
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`
- Docker (optional, for manual image builds)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   
   Copy and edit the `.env` file:
   ```bash
   cp .env.local .env
   ```

   Update with your values:
   ```env
   PROJECT_NAME=your-project-name
   USER_ID=your-username
   USER_EMAIL=your-email@example.com

   OUTPUT_BUCKET_NAME=your-output-bucket
   ARTIFACT_BUCKET_NAME=your-artifact-bucket

   # Comma-separated S3 bucket ARNs
   READ_BUCKET_ARNS=arn:aws:s3:::ngi-igenomes,arn:aws:s3:::your-ref-data
   READ_WRITE_BUCKET_ARNS=arn:aws:s3:::your-shared-bucket
   ```

3. **Set AWS environment**
   ```bash
   export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
   export CDK_DEFAULT_REGION="us-east-1"  # your preferred region
   ```

4. **Bootstrap CDK** (first time only)
   ```bash
   npx cdk bootstrap aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}
   ```

## Deployment Options

### Option 1: Full Deployment (Recommended for New Environments)

Deploy everything including automated image builder:

```bash
# 1. Deploy image builder first
npm run deploy:image-builder

# 2. Trigger Nextflow image build
aws codebuild start-build --project-name nextflow-image-builder

# 3. Wait for build to complete (5-10 minutes), then deploy core infrastructure
npm run deploy:core

# 4. (Optional) Deploy permissions stack
npm run deploy:permissions
```

### Option 2: Quick Deployment (Existing Image)

If you already have a Nextflow image in ECR:

```bash
npm run deploy:core
```

### Option 3: Manual Deployment Commands

```bash
# Build TypeScript
npm run build

# Deploy all stacks
npm run deploy

# Deploy specific stack
npx cdk deploy NextflowStack

# Preview changes
npm run diff

# Generate CloudFormation template
npm run synth > cloudformation.yml
```

## Available NPM Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for development
- `npm run test` - Run Jest tests
- `npm run deploy` - Build and deploy all stacks
- `npm run deploy:core` - Deploy main infrastructure
- `npm run deploy:permissions` - Deploy IAM permissions stack
- `npm run deploy:image-builder` - Deploy CodeBuild image builder
- `npm run synth` - Synthesize CloudFormation templates
- `npm run diff` - Show differences from deployed stack
- `npm run clean` - Remove compiled JavaScript files

## Project Structure

### Directories

```
nextflow-cdk/
├── bin/                    # CDK app entry points
│   ├── core/              # Main infrastructure app
│   ├── permission/        # IAM permissions app
│   └── image-builder/     # Image builder app (NEW!)
├── lib/                   # CDK constructs and stacks
│   ├── constructs/        # Reusable CDK constructs
│   │   ├── batch.ts              # AWS Batch setup
│   │   ├── api-proxy.ts          # API Gateway config
│   │   ├── secure-service.ts     # ECS service
│   │   └── nextflow-image-builder.ts  # CodeBuild (NEW!)
│   ├── stacks/            # CDK stack definitions
│   │   ├── main-stack.ts         # Primary stack
│   │   └── engines/              # Engine-specific constructs
│   ├── roles/             # IAM role definitions
│   ├── permission/        # Permission policies
│   ├── env/               # Environment configuration
│   └── util/              # Helper utilities
├── assets/                # Static assets (Lambda zips, etc.)
├── test/                  # Jest unit tests
├── cdk.json              # CDK configuration
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
└── .env                  # Environment variables (create from .env.local)
```

### Key Files

- **bin/core/app.ts** - Main entry point for infrastructure deployment
- **lib/stacks/main-stack.ts** - Defines all AWS resources
- **lib/constructs/nextflow-image-builder.ts** - Automated image building (NEW!)
- **lib/env/app-parameters.ts** - Environment configuration handling
- **cdk.json** - CDK app configuration

## Stack Components

### Core Stack (bin/core/app.ts)

Deploys the main infrastructure:

1. **Networking**
   - VPC with public/private subnets
   - Security groups
   - VPC endpoints (S3, ECR, etc.)

2. **Compute**
   - AWS Batch compute environments (On-Demand & Spot)
   - Job queues
   - Launch templates

3. **Storage**
   - S3 buckets (output, artifacts)
   - DynamoDB table (workflow state)

4. **API**
   - Lambda function (WES adapter)
   - API Gateway (REST endpoint)
   - API key management

5. **Monitoring**
   - CloudWatch log groups
   - CloudWatch alarms

### Permissions Stack (bin/permission/app.ts)

Optional stack for managing IAM policies:
- User access policies for WES API
- Cross-account permissions
- CDK deployment permissions

### Image Builder Stack (bin/image-builder/app.ts) 🆕

**NEW!** Automated Nextflow image building:
- CodeBuild project for Docker builds
- ECR repository management
- Automated image lifecycle policies
- No local Docker required!

See [docs/AUTOMATED_IMAGE_BUILD.md](../docs/AUTOMATED_IMAGE_BUILD.md) for details.

## Configuration

### Environment Variables

Configure via `.env` file:

```env
# Required
PROJECT_NAME=my-nextflow-project
USER_ID=username
USER_EMAIL=email@example.com
OUTPUT_BUCKET_NAME=nextflow-outputs
ARTIFACT_BUCKET_NAME=nextflow-artifacts

# S3 Access (comma-separated ARNs)
READ_BUCKET_ARNS=arn:aws:s3:::bucket1,arn:aws:s3:::bucket2
READ_WRITE_BUCKET_ARNS=arn:aws:s3:::bucket3

# Optional: Batch Configuration
BATCH_COMPUTE_INSTANCE_TYPES=m5.large,m5.xlarge,r5.large
MAX_VCPUS=256

# Optional: Networking
# VPC_ID=vpc-xxxxx
# VPC_SUBNETS=subnet-xxx,subnet-yyy

# Optional: Nextflow Version
NEXTFLOW_VERSION=25.10.2

# Optional: Custom Tags (JSON)
CUSTOM_TAGS={"Environment":"production","CostCenter":"research"}
```

### CDK Context

Override settings via command-line context:

```bash
# Use existing VPC
npx cdk deploy -c VPC_ID=vpc-xxxxx

# Use specific subnets
npx cdk deploy -c VPC_SUBNETS=subnet-xxx,subnet-yyy

# Custom AMI
npx cdk deploy -c AMI=ami-xxxxx

# Create new bucket
npx cdk deploy -c CREATE_BUCKET=true
```

## Post-Deployment

### Get Stack Outputs

```bash
# View all outputs
aws cloudformation describe-stacks \
    --stack-name NextflowStack \
    --query 'Stacks[0].Outputs' \
    --output table

# Get specific output
aws cloudformation describe-stacks \
    --stack-name NextflowStack \
    --query 'Stacks[0].Outputs[?OutputKey==`WESApiEndpoint`].OutputValue' \
    --output text
```

### Retrieve API Key

```bash
aws ssm get-parameter \
    --name "/nextflow/wes/api-key" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text
```

### Test Deployment

```bash
# Test WES API
curl -H "x-api-key: YOUR_API_KEY" \
     https://YOUR_API_ENDPOINT/ga4gh/wes/v1/service-info
```

## Development

### Build and Test

```bash
# Compile TypeScript
npm run build

# Watch mode (auto-compile on changes)
npm run watch

# Run tests
npm run test

# Lint code
npm run lint
```

### Adding New Constructs

1. Create construct in `lib/constructs/`
2. Export from `lib/constructs/index.ts`
3. Import and use in stack
4. Add tests in `test/`

Example:
```typescript
// lib/constructs/my-construct.ts
import { Construct } from "constructs";

export class MyConstruct extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    // Your construct code
  }
}

// Export it
// lib/constructs/index.ts
export { MyConstruct } from "./my-construct";
```

## Troubleshooting

### Build Errors

**Issue**: TypeScript compilation errors
```bash
npm run clean
npm install
npm run build
```

### Deployment Failures

**Issue**: Stack already exists
```bash
# Delete and redeploy
npx cdk destroy NextflowStack
npx cdk deploy NextflowStack
```

**Issue**: Insufficient permissions
- Check IAM policies
- Ensure bootstrapped: `npx cdk bootstrap`

**Issue**: Resource limits
- Check AWS service quotas
- Request limit increases if needed

### Image Build Issues

**Issue**: Nextflow image not found in ECR
```bash
# Deploy image builder and trigger build
npm run deploy:image-builder
aws codebuild start-build --project-name nextflow-image-builder
```

**Issue**: CodeBuild build fails
- Check CloudWatch logs: `/aws/codebuild/nextflow-image-builder`
- Verify IAM permissions
- Check Dockerfile in `nextflow-engine/`

## Best Practices

1. **Version Control**: Always commit `.env.local` as template, never commit `.env`
2. **Tagging**: Use meaningful tags via `CUSTOM_TAGS` for cost allocation
3. **Testing**: Test in dev environment before production
4. **Monitoring**: Set up CloudWatch alarms for critical metrics
5. **Security**: Rotate API keys regularly, use least-privilege IAM
6. **Cost**: Use Spot instances where possible, monitor spend

## Resources

- [Full Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Automated Image Build Guide](../docs/AUTOMATED_IMAGE_BUILD.md)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Nextflow Documentation](https://www.nextflow.io/docs/latest/)
- [GA4GH WES API Spec](https://github.com/ga4gh/workflow-execution-service-schemas)

## Support

For issues:
1. Check CloudWatch Logs
2. Review AWS Batch job logs  
3. Consult troubleshooting section above
4. Check project issues on GitHub

