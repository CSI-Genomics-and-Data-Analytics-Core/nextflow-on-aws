import { Construct } from "constructs";
import { Project, BuildSpec, LinuxBuildImage, BuildEnvironmentVariableType, ComputeType, Source } from "aws-cdk-lib/aws-codebuild";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Effect, PolicyStatement, Role, ServicePrincipal, IGrantable } from "aws-cdk-lib/aws-iam";
import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import * as path from "path";

export interface NextflowImageBuilderProps {
  /**
   * The name of the ECR repository to push the image to
   * @default "nextflow"
   */
  readonly repositoryName?: string;

  /**
   * The Nextflow version to build
   * @default "25.10.3"
   */
  readonly nextflowVersion?: string;

  /**
   * Whether to trigger an initial build on deployment
   * @default false
   */
  readonly triggerInitialBuild?: boolean;

  /**
   * Compute type for the build
   * @default ComputeType.SMALL
   */
  readonly computeType?: ComputeType;

  /**
   * Path to the nextflow-engine directory
   * @default - assumes standard project structure
   */
  readonly nextflowEngineSourcePath?: string;
}

/**
 * Construct that automates the building and pushing of Nextflow Docker images to ECR using CodeBuild.
 * This eliminates the manual process of building the Nextflow image.
 */
export class NextflowImageBuilder extends Construct {
  public readonly repository: Repository;
  public readonly buildProject: Project;

  constructor(scope: Construct, id: string, props: NextflowImageBuilderProps = {}) {
    super(scope, id);

    const repositoryName = props.repositoryName ?? "nextflow";
    const nextflowVersion = props.nextflowVersion ?? "25.10.3";
    const computeType = props.computeType ?? ComputeType.SMALL;
    const region = Stack.of(this).region;
    const account = Stack.of(this).account;

    // Create or reference ECR repository
    this.repository = new Repository(this, "NextflowRepository", {
      repositoryName: repositoryName,
      removalPolicy: RemovalPolicy.RETAIN, // Keep images even if stack is deleted
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: "Keep last 10 images",
          maxImageCount: 10,
        },
      ],
    });

    // Create IAM role for CodeBuild
    const buildRole = new Role(this, "NextflowImageBuilderRole", {
      assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
      description: "Role used by CodeBuild to build and push Nextflow images",
    });

    // Grant ECR permissions
    this.repository.grantPullPush(buildRole);

    // Add permissions for ECR repository creation (in case it doesn't exist)
    buildRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ecr:DescribeRepositories", "ecr:CreateRepository"],
        resources: [`arn:aws:ecr:${region}:${account}:repository/${repositoryName}`],
      })
    );

    // Add permissions for ECR login
    buildRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      })
    );

    // Add CloudWatch Logs permissions
    buildRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        resources: [
          `arn:aws:logs:${region}:${account}:log-group:/aws/codebuild/*`,
        ],
      })
    );

    // Create the CodeBuild project
    this.buildProject = new Project(this, "NextflowImageBuildProject", {
      projectName: "nextflow-image-builder",
      description: "Builds and pushes Nextflow Docker images to ECR",
      role: buildRole,
      source: Source.gitHub({
        owner: "CSI-Genomics-and-Data-Analytics-Core",
        repo: "nextflow-on-aws",
        branchOrRef: "main",
      }),
      environment: {
        buildImage: LinuxBuildImage.STANDARD_7_0,
        privileged: true, // Required for Docker builds
        computeType: computeType,
      },
      environmentVariables: {
        AWS_REGION: {
          type: BuildEnvironmentVariableType.PLAINTEXT,
          value: region,
        },
        AWS_ACCOUNT_ID: {
          type: BuildEnvironmentVariableType.PLAINTEXT,
          value: account,
        },
        NEXTFLOW_IMAGE_NAME: {
          type: BuildEnvironmentVariableType.PLAINTEXT,
          value: repositoryName,
        },
        NEXTFLOW_VERSION: {
          type: BuildEnvironmentVariableType.PLAINTEXT,
          value: nextflowVersion,
        },
      },
      buildSpec: BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              'echo "Logging in to Amazon ECR..."',
              "aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com",
              'echo "Checking if ECR repository exists..."',
              "aws ecr describe-repositories --region $AWS_REGION --repository-names $NEXTFLOW_IMAGE_NAME > /dev/null 2>&1 || aws ecr create-repository --repository-name $NEXTFLOW_IMAGE_NAME --region $AWS_REGION",
            ],
          },
          build: {
            commands: [
              'echo "Building Nextflow Docker image..."',
              'echo "Build started on `date`"',
              "NEXTFLOW_IMAGE_URI=$NEXTFLOW_IMAGE_NAME:$NEXTFLOW_VERSION",
              "docker build -t $NEXTFLOW_IMAGE_URI --build-arg NEXTFLOW_VERSION=$NEXTFLOW_VERSION ./nextflow-engine",
              "docker tag $NEXTFLOW_IMAGE_URI $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$NEXTFLOW_IMAGE_URI",
            ],
          },
          post_build: {
            commands: [
              'echo "Pushing Docker image to ECR..."',
              "docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$NEXTFLOW_IMAGE_URI",
              'echo "Build completed on `date`"',
              'echo "Image pushed: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$NEXTFLOW_IMAGE_URI"',
            ],
          },
        },
        artifacts: {
          files: ["**/*"],
        },
      }),
    });

    // Outputs
    new CfnOutput(this, "NextflowRepositoryUri", {
      value: this.repository.repositoryUri,
      description: "ECR repository URI for Nextflow images",
      exportName: "NextflowRepositoryUri",
    });

    new CfnOutput(this, "NextflowImageUri", {
      value: `${this.repository.repositoryUri}:${nextflowVersion}`,
      description: "Full URI of the Nextflow image",
      exportName: "NextflowImageUri",
    });

    new CfnOutput(this, "CodeBuildProjectName", {
      value: this.buildProject.projectName,
      description: "CodeBuild project name for building Nextflow images",
      exportName: "NextflowCodeBuildProject",
    });

    new CfnOutput(this, "BuildCommand", {
      value: `aws codebuild start-build --project-name ${this.buildProject.projectName}`,
      description: "Command to trigger a new build",
    });
  }
}
