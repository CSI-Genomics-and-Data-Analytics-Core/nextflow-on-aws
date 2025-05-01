# Nextflow Runner on AWS Infrastructure

## Overview

This project provisions a robust, production-ready AWS infrastructure for running [Nextflow](https://www.nextflow.io/) workflows using AWS Batch, following the [GA4GH WES API](https://github.com/ga4gh/workflow-execution-service-schemas) standard. It is inspired by the [Amazon Genomics CLI (AGC)](https://github.com/aws/amazon-genomics-cli) but is actively maintained and modernized for cost-effectiveness, scalability, and maintainability.

---

## Features

- **End-to-End Infrastructure**: Provisions VPC, networking, AWS Batch compute environments, job queues, Lambda-based WES API adapter, and supporting resources.
- **WES API Support**: Submit and manage workflows using the GA4GH Workflow Execution Service API.
- **Nextflow Engine**: Dockerized Nextflow engine for reproducible, portable workflow execution.
- **Customizable**: Easily adapt compute environments, job queues, and storage to your needs via CDK configuration.
- **Cost-Effective**: Designed for efficient resource usage and minimal operational overhead.
- **Extensible**: Add support for additional workflow engines or custom orchestration logic.

---

## Architecture

![AWS Architecture](docs/nextflow-on-aws-infrastructure.jpg)

- **Users** submit workflows via the WES API endpoint (Lambda).
- **Lambda** triggers AWS Batch jobs, which run Nextflow containers in a managed compute environment.
- **S3 Buckets** are used for input, output, and artifact storage.
- **IAM Roles/Policies** ensure secure, least-privilege access.

---

## Quick Start

### 1. Build and Push Nextflow Docker Image

- Go to `nextflow-engine/`.
- Use `buildspec.yml` or the provided Dockerfile to build the Nextflow image.
- Push the image to your AWS ECR repository.

### 2. [Optional] Build WES Adapter Lambda Package

- Go to `wes_adapter/`.
- Run `make` or use the provided scripts to build `wes_adapter.zip`.
- Update the CDK asset reference if you customize the Lambda.

### 3. Deploy Infrastructure with AWS CDK

- Go to `nextflow-cdk/`.
- Install dependencies: `npm install`
- Configure your AWS credentials and environment variables (see below).
- Deploy: `npx cdk deploy`

---

## Configuration

### Environment Variables

You can configure deployment parameters using a `.env` file in the `nextflow-cdk/` directory. Example:

```env
PROJECT_NAME=your-project-name
USER_ID=your-user-id
USER_EMAIL=your-email@example.com
OUTPUT_BUCKET_NAME=your-output-bucket
ARTIFACT_BUCKET_NAME=your-artifact-bucket
READ_BUCKET_ARNS=arn:aws:s3:::your-read-bucket
READ_WRITE_BUCKET_ARNS=arn:aws:s3:::your-readwrite-bucket-1,arn:aws:s3:::your-readwrite-bucket-2
BUCKET_NAME_1=your-bucket-1
BUCKET_NAME_2=your-bucket-2
```

### Directory Structure

- `nextflow-cdk/` – AWS CDK code for infrastructure provisioning
- `nextflow-engine/` – Dockerization and build scripts for the Nextflow engine
- `wes_adapter/` – Source code for the WES Adapter Lambda function
- `job-orchestrator/` – (Optional) Additional orchestration logic
- `docs/` – Architecture diagrams and documentation

---

## Usage

- **Submit Workflows**: Use the WES API endpoint output by the CDK deployment to submit Nextflow workflows.
- **Monitor Jobs**: Track job status in AWS Batch and CloudWatch Logs.
- **Customize**: Edit CDK code or environment variables to adjust compute resources, storage, or permissions.

---

## API Testing with Postman

A ready-to-use **Postman collection** is provided in the `docs/` directory as `WES REST API.postman_collection.json`.

- Import this collection into [Postman](https://www.postman.com/).
- Update the environment variables (such as the API endpoint and API key) as needed.
- Use the pre-configured requests to submit, monitor, and manage workflows via the WES API after deployment.

---

## Advanced Topics

- **Multiple Environments**: Deploy multiple stacks (e.g., dev, staging, prod) by instantiating the CDK stack with different parameters.
- **Cross-Stack References**: Export/import resources (e.g., S3 bucket names) between stacks using `CfnOutput` and `Fn.importValue`.
- **Tag Propagation**: Tags set in CDK are propagated to AWS Batch jobs and other resources for cost tracking and organization.
- **Security**: IAM roles and policies are configured for least-privilege access. Review and adjust as needed for your organization.

---

## References & Further Reading

- [Nextflow Documentation](https://www.nextflow.io/docs/latest/index.html)
- [AWS Batch Documentation](https://docs.aws.amazon.com/batch/)
- [WES API Standard](https://github.com/ga4gh/workflow-execution-service-schemas)
- [Amazon Genomics CLI (AGC) - Archived](https://github.com/aws/amazon-genomics-cli)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)

---

For detailed setup, customization, and troubleshooting, see the `docs/` directory and comments in the CDK source files. Contributions and issues are welcome!
