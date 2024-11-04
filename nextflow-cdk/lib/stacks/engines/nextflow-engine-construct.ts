import { Aws } from "aws-cdk-lib";
import { NextflowEngine } from "../../constructs/engines/nextflow-engine";
import { EngineOptions } from "../../types";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { ApiProxy } from "../../constructs";
import { EngineOutputs, EngineConstruct } from "./engine-construct";
import { ILogGroup } from "aws-cdk-lib/aws-logs";
import { NextflowEngineRole } from "../../roles/nextflow-engine-role";
import { NextflowAdapterRole } from "../../roles/nextflow-adapter-role";
import { Construct } from "constructs";
import { IMachineImage, IVpc, SubnetSelection } from "aws-cdk-lib/aws-ec2";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { CfnJobQueue } from "aws-cdk-lib/aws-batch";
import { EcrImage } from "aws-cdk-lib/aws-ecs";

export interface NextflowEngineConstructProps extends EngineOptions {
  /**
   * AWS Batch JobQueue to use for running workflows.
   */
  readonly jobQueue: CfnJobQueue;
  /**
   * AWS Batch JobQueue to use for running workflows.
   */
  readonly headQueue: CfnJobQueue;
  /**
   * Image used for the Nextflow head node
   */
  readonly computeEnvImage: IMachineImage;

  /**
   * ECR Image used for the Nextflow engine
   */
  readonly ecrImage: EcrImage;
}

export class NextflowEngineConstruct extends EngineConstruct {
  public readonly apiProxy: ApiProxy;
  public readonly adapterLogGroup: ILogGroup;
  public readonly nextflowEngine: NextflowEngine;

  constructor(scope: Construct, id: string, asset: Asset, props: NextflowEngineConstructProps) {
    super(scope, id, asset);

    const params = props.contextParameters;
    const outputBucket = Bucket.fromBucketName(this, "OutputBucket", params.outputBucketName);
    const artifactBucket = Bucket.fromBucketName(this, "ArtifactBucket", params.artifactBucketName);

    const engineRole = new NextflowEngineRole(this, "NextflowEngineRole", {
      batchJobPolicyArns: [props.jobQueue.ref],
      readOnlyBucketArns: (params.readBucketArns ?? []).concat(artifactBucket.bucketArn),
      readWriteBucketArns: (params.readWriteBucketArns ?? []).concat(outputBucket.bucketArn),
      policies: props.policyOptions,
    });

    this.nextflowEngine = new NextflowEngine(this, "NextflowEngine", {
      vpc: props.vpc,
      subnets: props.subnets,
      jobQueueArn: props.jobQueue.ref,
      rootDirS3Uri: params.getEngineBucketPath(),
      taskRole: engineRole,
      ecrImage: props.ecrImage,
    });

    const adapterRole = new NextflowAdapterRole(this, "NextflowAdapterRole", {
      batchJobPolicyArns: [this.nextflowEngine.headJobDefinition.ref, props.headQueue.ref],
      readOnlyBucketArns: [],
      readWriteBucketArns: [outputBucket.bucketArn],
    });

    const engineLogGroup = this.nextflowEngine.logGroup;
    engineLogGroup.grant(engineRole, "logs:StartQuery");
    engineLogGroup.grant(engineRole, "logs:GetLogEvents");
    engineLogGroup.grant(adapterRole, "logs:StartQuery");

    const lambda = this.renderAdapterLambda({
      role: adapterRole,
      jobQueueArn: props.headQueue.ref,
      jobDefinitionArn: this.nextflowEngine.headJobDefinition.ref,
      engineLogGroupName: engineLogGroup.logGroupName,
      vpc: props.contextParameters.usePublicSubnets ? undefined : props.vpc,
      subnets: props.contextParameters.usePublicSubnets ? undefined : props.subnets,
    });
    this.adapterLogGroup = lambda.logGroup;

    this.apiProxy = new ApiProxy(this, {
      apiName: `${params.projectName}${params.userId}NextflowApiProxy`,
      lambda,
      allowedAccountIds: [Aws.ACCOUNT_ID],
    });
  }

  protected getOutputs(): EngineOutputs {
    return {
      accessLogGroup: this.apiProxy.accessLogGroup,
      adapterLogGroup: this.adapterLogGroup,
      engineLogGroup: this.nextflowEngine.logGroup,
      wesUrl: this.apiProxy.restApi.url,
      apiKey: this.apiProxy.apiKey.keyId,
    };
  }

  private renderAdapterLambda({ role, jobQueueArn, jobDefinitionArn, engineLogGroupName, vpc, subnets }: {
    role: NextflowAdapterRole,
    jobQueueArn: string,
    jobDefinitionArn: string,
    engineLogGroupName: string,
    vpc: IVpc | undefined,
    subnets: SubnetSelection | undefined
  }) {
    return super.renderPythonLambda(
      this,
      "NextflowWesAdapterLambda",
      role,
      {
        ENGINE_NAME: "nextflow",
        JOB_QUEUE: jobQueueArn,
        JOB_DEFINITION: jobDefinitionArn,
        ENGINE_LOG_GROUP: engineLogGroupName,
      },
      vpc,
      subnets
    );
  }
}
