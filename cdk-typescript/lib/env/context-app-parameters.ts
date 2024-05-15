import { getEnvNumber, getEnvBoolOrDefault, getEnvString, getEnvStringListOrDefault, getEnvStringOrDefault } from "./";
import { InstanceType } from "aws-cdk-lib/aws-ec2";
import { Node } from "constructs";
import { ServiceContainer } from "../types";

const oneCpuUnit = 1024;
const oneGBinMiB = 1024;

export class ContextAppParameters {
  /**
   * Name of the project.
   */
  public readonly projectName: string;
  /**
   * Name of the context.
   */
  public readonly contextName: string;
  /**
   * The user's ID.
   */
  public readonly userId: string;
  /**
   * The user's email.
   */
  public readonly userEmail: string;

  /**
   * Bucket used to store outputs.
   */
  public readonly outputBucketName: string;
  /**
   * Bucket that stores artifacts.
   */
  public readonly artifactBucketName: string;
  /**
   * A list of ARNs that batch will access for workflow reads.
   */
  public readonly readBucketArns?: string[];
  /**
   * A list of ARNs that batch will access for workflow reads and writes.
   */
  public readonly readWriteBucketArns?: string[];
  /**
   * A KMS Policy to enable cross account S3 SSE-KMS.
   */
  public readonly kmsDecryptPolicy?: string;

  /**
   * Name of the engine to run.
   */
  public readonly engineName: string;
  /**
   * Workflow language supported by the engine.
   */
  public readonly engineType: string;
  /**
   * Name of the filesystem type to use (e.g. EFS, S3).
   */
  public readonly filesystemType?: string;
  /**
   * Amount of provisioned IOPS to use.
   */
  public readonly fsProvisionedThroughput?: number;
  /**
   * Name of the engine ECR image.
   */
  public readonly engineDesignation: string;
  /**
   * Health check path for the engine.
   */
  public readonly engineHealthCheckPath: string;
  /**
   * Whether to enable workflow call caching for the engine.
   */
  public readonly callCachingEnabled: boolean;

  /**
   * Name of the WES adapter.
   */
  public readonly adapterName: string;
  /**
   * Name of the WES adapter ECR image.
   */
  public readonly adapterDesignation: string;

  /**
   * The maximum number of Amazon EC2 vCPUs that an environment can reach.
   */
  public readonly maxVCpus?: number;
  /**
   * Property to specify if the compute environment uses On-Demand or Spot compute resources.
   */
  public readonly requestSpotInstances: boolean;
  /**
   * The types of EC2 instances that may be launched in the compute environment.
   */
  public readonly instanceTypes?: InstanceType[];
  /**
   * If true, put EC2 instances into public subnets instead of private subnets.
   * This allows you to obtain significantly lower ongoing costs if used in conjunction with the usePublicSubnets option
   * Note that this option risks security vulnerabilities if security groups are manually modified.
   *
   * @default false
   */
  public readonly usePublicSubnets?: boolean;
  /**
   * Infrastructure version being deployed.
   */
  public readonly infrastructureVersion: string;

  /**
   * Map of custom tags to be applied to all the infrastructure in the context.
   */
  public readonly customTags: { [key: string]: string };

  constructor(node: Node) {
    const instanceTypeStrings = getEnvStringListOrDefault(node, "BATCH_COMPUTE_INSTANCE_TYPES");

    this.projectName = 'gedac';
    this.contextName = 'nextflow-engine';
    this.userId = 'gedac';
    this.userEmail = 'admin@gedac.org';

    this.outputBucketName = 'gedac-bucket-profile';
    this.artifactBucketName = 'gedac-862363609447-ap-southeast-1';
     //create sring[] 
    this.readBucketArns = ['arn:aws:s3:::ngi-igenomes'];

    this.readWriteBucketArns = ['arn:aws:s3:::gedac-bucket-profile', 'arn:aws:s3:::gedac-862363609447-ap-southeast-1'];

    this.kmsDecryptPolicy = getEnvStringOrDefault(node, "KMS_DECRYPT_POLICY", undefined);

    this.engineName = 'nextflow';
    this.filesystemType = getEnvStringOrDefault(node, "FILESYSTEM_TYPE", this.getDefaultFilesystem());
    this.fsProvisionedThroughput = getEnvNumber(node, "FS_PROVISIONED_THROUGHPUT");
    this.engineDesignation = "nextflow";
    this.engineHealthCheckPath = getEnvStringOrDefault(node, "ENGINE_HEALTH_CHECK_PATH", "/engine/v1/status")!;
    this.callCachingEnabled = getEnvBoolOrDefault(node, "CALL_CACHING_ENABLED", true)!;

    this.adapterName = getEnvStringOrDefault(node, "ADAPTER_NAME", "wesAdapter")!;
    this.adapterDesignation = getEnvStringOrDefault(node, "ADAPTER_DESIGNATION", "wes")!;

    this.maxVCpus = 256;
    this.requestSpotInstances = getEnvBoolOrDefault(node, "REQUEST_SPOT_INSTANCES", true)!;
    this.instanceTypes = instanceTypeStrings ? instanceTypeStrings.map((instanceType) => new InstanceType(instanceType.trim())) : undefined;

    this.usePublicSubnets = getEnvBoolOrDefault(node, "PUBLIC_SUBNETS", true);
    this.infrastructureVersion = "1.0.0";

    const tagsJson = getEnvStringOrDefault(node, "CUSTOM_TAGS", '{"ENV":"COST","USER":"GEDAC", "SAMPLE_COUNT":"15", "DATE": "31 MARCH 2024"}' );
    if (tagsJson != null) {
      this.customTags = JSON.parse(tagsJson);
    } else {
      this.customTags = {};
    }

    this.engineType = this.getEngineType();
  }

  public getContextBucketPath(): string {
    return `s3://${this.outputBucketName}/${this.projectName}`;
  }

  public getEngineBucketPath(): string {
    return `${this.getContextBucketPath()}/${this.engineName}-execution`;
  }

  /**
   * This function defines the container that server-based engines (like Toil
   * or Cromwell) will run their servers in. It is going to run on Fargate.
   */
  public getEngineContainer(jobQueueArn: string, additionalEnvVars?: { [key: string]: string }): ServiceContainer {
    return {
      serviceName: this.engineName,
      imageConfig: { designation: this.engineDesignation },
      containerPort: 8000,
      cpu: this.callCachingEnabled ? oneCpuUnit * 2 : oneCpuUnit / 2,
      memoryLimitMiB: this.callCachingEnabled ? oneGBinMiB * 16 : oneGBinMiB * 2,
      healthCheckPath: this.engineHealthCheckPath,
      environment: {
        S3BUCKET: this.outputBucketName,
        ROOT_DIR: this.getEngineBucketPath(),
        JOB_QUEUE_ARN: jobQueueArn,
        ...additionalEnvVars,
      },
    };
  }

  public getAdapterContainer(additionalEnvVars?: { [key: string]: string }): ServiceContainer {
    return {
      serviceName: this.adapterName,
      imageConfig: { designation: this.adapterDesignation },
      cpu: oneCpuUnit / 2,
      memoryLimitMiB: oneGBinMiB * 4,
      environment: {
        PROJECT_NAME: this.projectName,
        CONTEXT_NAME: this.contextName,
        USER_ID: this.userId,
        ENGINE_NAME: this.engineName,
        ...additionalEnvVars,
      },
    };
  }

  public getDefaultFilesystem(): string {
    let defFilesystem: string;
    switch (this.engineName) {
      case "nextflow":
        defFilesystem = "S3";
        break;
      default:
        throw Error(`Engine '${this.engineName}' is not supported`);
    }
    return defFilesystem;
  }

  public getEngineType(): string {
    let engineType: string;
    switch (this.engineName.toLowerCase()) {
      case "nextflow":
        engineType = "nextflow";
        break;
      default:
        engineType = "(unknown)";
        break;
    }
    return engineType;
  }
}
