#!/usr/bin/env node
import { App, Stack, StackProps } from "aws-cdk-lib";
import "source-map-support/register";
import { NextflowImageBuilder } from "../../lib/constructs/nextflow-image-builder";

/**
 * Standalone stack for building and managing Nextflow Docker images.
 * Deploy this stack first to ensure the Nextflow image is available in ECR
 * before deploying the main infrastructure stack.
 * 
 * Usage:
 *   npx cdk deploy NextflowImageBuilderStack
 * 
 * To trigger a build after deployment:
 *   aws codebuild start-build --project-name nextflow-image-builder
 */

export interface NextflowImageBuilderStackProps extends StackProps {
  /**
   * Nextflow version to build
   * @default "25.10.3"
   */
  nextflowVersion?: string;
}

export class NextflowImageBuilderStack extends Stack {
  public readonly imageBuilder: NextflowImageBuilder;

  constructor(scope: App, id: string, props?: NextflowImageBuilderStackProps) {
    super(scope, id, props);

    // Create the Nextflow image builder
    this.imageBuilder = new NextflowImageBuilder(this, "NextflowImageBuilder", {
      repositoryName: "nextflow",
      nextflowVersion: props?.nextflowVersion ?? process.env.NEXTFLOW_VERSION ?? "25.10.3",
      triggerInitialBuild: false, // Set to true to trigger build on first deployment
    });
  }
}

// Instantiate the stack
const app = new App();

const account: string = process.env.CDK_DEFAULT_ACCOUNT!;
const region: string = process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1";

new NextflowImageBuilderStack(app, "NextflowImageBuilderStack", {
  env: {
    account,
    region,
  },
  description: "Stack for building and managing Nextflow Docker images in ECR",
  stackName: "NextflowImageBuilder",
});

app.synth();
