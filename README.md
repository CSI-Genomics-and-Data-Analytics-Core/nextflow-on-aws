# Nextflow Runner on AWS Infrastructure
The codebase was retrived from the [AWS AGC Project](https://github.com/aws/amazon-genomics-cli).
Since the AGC project has been archived by the AWS team, it no longer receives updates for the latest Nextflow versions or long-term support for nf-core pipelines.

Our focus is solely on the Nextflow infrastructure, with utilizing the WES API standard.

Nextflow is a workflow framework and domain-specific language (DSL) for scalable and reproducible scientific workflows, it can be run either locally or on a dedicated EC2 instance.

This AWS infrastructure is to run Nextflow using AWS Batch in a managed and cost effective fashion.

General Overview of Nextflow Compute Environment via AWS Batch.

![AWS](docs/nextflow-on-aws-infrastructure.jpg)

## Setup

1. **Build AWS-Friendly Nextflow docker, push to ECR**
2. **[Optional] Create WesAdapter.zip**
3. **Use CDK to provisioninng the entire infrastructure.**

### Nextflow Engine dockerrization

The `nextflow-engine` directory used for Nextflow Engine dockerrization, contains an AWS codebuild buildspec.yaml to build image and pushes to ECR.

### WES Adaptoer Modificaiton (Optional)
The `wes_adapter` directory contains python code for wes_adapter Lambda.

### Provisioning Infrastructure

The `nextflow-cdk` directory contains all the source code files for the CDK. This is where you will find the AWS infrastructure stacks.
