import { CfnOutput, RemovalPolicy, Size, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, ITable, ProjectionType, Table } from "aws-cdk-lib/aws-dynamodb";
import { IParameter, StringListParameter, StringParameter } from "aws-cdk-lib/aws-ssm";
import { GatewayVpcEndpointAwsService, InterfaceVpcEndpointService, ISubnet, IVpc, MachineImage, Subnet, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Bucket, BucketEncryption, IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import {
  PRODUCT_NAME,
  VPC_NUMBER_SUBNETS_PARAMETER_NAME,
  VPC_PARAMETER_ID,
  VPC_PARAMETER_NAME,
  VPC_SUBNETS_PARAMETER_NAME,
  WES_BUCKET_NAME,
  WES_KEY_PARAMETER_NAME,
  ENGINE_NEXTFLOW,
} from "../constants";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { EcsOptimizedImage } from "aws-cdk-lib/aws-ecs";

import { IMachineImage, SubnetSelection } from "aws-cdk-lib/aws-ec2";
import { createEcrImage, subnetSelectionFromIds } from "../util";
import { ContextAppParameters } from "../env";
import { BatchConstruct, BatchConstructProps } from "./engines/batch-construct";
import { NextflowEngineConstruct } from "./engines/nextflow-engine-construct";

export interface ParameterProps {
  /**
   * The name of this parameter.
   *
   * All parameter names are prefixed with "/gedac/_common/".
   */
  name: string;
  /**
   * The value stored in this parameter
   */
  value: string;
  /**
   * The description for this parameter
   *
   * @default none
   */
  description?: string;
}

export interface ParameterListProps {
  /**
   * The name of this parameter.
   *
   * All parameter names are prefixed with "/gedac/_common/".
   */
  name: string;
  /**
   * The values stored in this parameter. Values must not contain commas
   */
  values: string[];

  /**
   * The description of this parameter
   *
   * @default none
   */
  description?: string;
}

export interface ContextStackProps extends StackProps {
  readonly contextParameters: ContextAppParameters;
}

export interface CoreStackProps extends StackProps {
  /**
   * Name of S3 bucket to create or import
   */
  bucketName: string;
  /**
   * Key used to determine uniqueness of assets.
   */
  idempotencyKey: string;
  /**
   * Whether the bucket should be created or imported using bucketName
   *
   * @default true
   */
  createNewBucket?: boolean;
  /**
   * The name of the VPC the service should use
   *
   * @default - A new VPC is created
   */
  vpcId?: string;

  /**
   * A list of subnet ids from within the VPC specified by vpcId to use for infrastructure deployment
   * @default - All private subnets are used
   */
  subnetIds?: string[];

  /**
   * A list of SSM parameters to create with the stack.
   *
   * @default none
   */
  parameters?: ParameterProps[];
  /**
   * If true, spawn a VPC with no NAT gateways or VPC endpoints (ie, no private subnets).
   * This **must** be used in conjunction with the uesPublicSubnets option for any context deployed within this account.
   *
   * Note that this option risks security vulnerabilities if security groups are manually modified.
   *
   * @default false
   */
  usePublicSubnets?: boolean;

  /**
   * The AMI id used for compute environments and stored in SSM parameter store
   */
  imageId?: string;
  /**
   * The name of the parameter store context parameters
   *
   * @default none
   */
  imageIdParameterName?: string;

  contextParameters: ContextAppParameters;
}

const parameterPrefix = `/gedac/_common/`;

export class MainStack extends Stack {
  public readonly vpc: IVpc;
  public readonly table: ITable;
  public readonly bucket: IBucket;
  private readonly iops: Size;
  private readonly subnets: SubnetSelection;
  private readonly computeEnvImage: IMachineImage;
  private readonly wesAdapterAsset: Asset;

  constructor(scope: Construct, id: string, props: CoreStackProps) {
    super(scope, id, props);

    this.vpc = this.renderVpc(props.vpcId, props.usePublicSubnets);
    this.table = this.renderTable();
    this.bucket = this.renderBucket(props.bucketName, props.createNewBucket);

    new BucketDeployment(this, "BatchArtifacts", {
      sources: [Source.asset(path.join(__dirname, "../artifacts"))],
      destinationBucket: this.bucket,
      destinationKeyPrefix: "artifacts",
      prune: false,
      metadata: {
        "idempotency-key": props.idempotencyKey,
      },
    });

    new CfnOutput(this, VPC_PARAMETER_ID, { value: this.vpc.vpcId });

    this.wesAdapterAsset = new Asset(this, "WesAdapter", {
      path: path.join(__dirname, "../../assets/wes_adapter.zip"),
    });

    new CfnOutput(this, WES_BUCKET_NAME, { value: this.wesAdapterAsset.s3BucketName, exportName: WES_BUCKET_NAME });

    this.addParameter({ name: WES_KEY_PARAMETER_NAME, value: this.wesAdapterAsset.s3ObjectKey, description: "The s3 key for the wes_adapter zip file" });

    this.addParameter({ name: VPC_PARAMETER_NAME, value: this.vpc.vpcId, description: `VPC ID for ${PRODUCT_NAME}` });

    props.parameters?.forEach((parameterProps) => this.addParameter(parameterProps));

    new CfnOutput(this, "TableName", { value: this.table.tableName });

    const subnets = this.getSubnets(props);
    this.addStringListParameter({ name: VPC_SUBNETS_PARAMETER_NAME, values: subnets.map((s) => s.subnetId) });
    this.addParameter({ name: VPC_NUMBER_SUBNETS_PARAMETER_NAME, value: `${subnets.length}` });
    this.subnets = subnetSelectionFromIds(this, subnets.map((s) => s.subnetId));

    // print props
    console.log(props);
    this.computeEnvImage = props.imageId
      ? MachineImage.genericLinux({ [this.region]: props.imageId })
      : EcsOptimizedImage.amazonLinux2();

    console.log(this.computeEnvImage);

    const { engineName } = props.contextParameters;
    const { filesystemType } = props.contextParameters;
    const { fsProvisionedThroughput } = props.contextParameters;
    this.iops = Size.mebibytes(fsProvisionedThroughput!);

    switch (engineName) {
      case ENGINE_NEXTFLOW:
        if (filesystemType != "S3") {
          throw Error(`'Nextflow' requires filesystem type 'S3'`);
        }
        this.renderNextflowStack(props);
        break;
      default:
        throw Error(`Engine '${engineName}' is not supported`);
    }


  }

  private getSubnets(props: CoreStackProps): ISubnet[] {
    if (props.subnetIds) {
      const subnets = props.subnetIds!.filter((v) => v.trim() != "");
      if (subnets.length > 0) {
        return subnets.map((s, i) => Subnet.fromSubnetId(this, `InfraSubnet${i}`, s));
      }
    }
    if (props.usePublicSubnets) {
      return this.vpc.publicSubnets;
    }
    return this.vpc.privateSubnets;
  }

  private renderVpc(vpcId?: string, publicSubnets?: boolean): IVpc {
    if (vpcId) {
      return Vpc.fromLookup(this, "Vpc", { vpcId });
    } else if (publicSubnets) {
      return new Vpc(this, "Vpc", {
        subnetConfiguration: [
          {
            subnetType: SubnetType.PUBLIC,
            name: "Public",
          },
        ],
      });
    }

    const vpc = new Vpc(this, "Vpc", {
      gatewayEndpoints: {
        S3Endpoint: { service: GatewayVpcEndpointAwsService.S3 },
        DynamoDBEndpoint: { service: GatewayVpcEndpointAwsService.DYNAMODB },
      },
      subnetConfiguration: Vpc.DEFAULT_SUBNETS,
    });

    const subnetSelection = { subnets: vpc.privateSubnets, onePerAz: true };
    vpc.addInterfaceEndpoint(`${PRODUCT_NAME}LogsEndpoint`, {
      service: new InterfaceVpcEndpointService(`com.amazonaws.${this.region}.logs`),
      subnets: subnetSelection,
      open: true,
    });
    vpc.addInterfaceEndpoint(`${PRODUCT_NAME}EcrDkrEndpoint`, {
      service: new InterfaceVpcEndpointService(`com.amazonaws.${this.region}.ecr.dkr`),
      subnets: subnetSelection,
      open: true,
    });
    vpc.addInterfaceEndpoint(`${PRODUCT_NAME}EcrApiEndpoint`, {
      service: new InterfaceVpcEndpointService(`com.amazonaws.${this.region}.ecr.api`),
      subnets: subnetSelection,
      open: true,
    });
    vpc.addInterfaceEndpoint(`${PRODUCT_NAME}EcsAgentEndpoint`, {
      service: new InterfaceVpcEndpointService(`com.amazonaws.${this.region}.ecs-agent`),
      subnets: subnetSelection,
      open: true,
    });
    vpc.addInterfaceEndpoint(`${PRODUCT_NAME}EcsTelemEndpoint`, {
      service: new InterfaceVpcEndpointService(`com.amazonaws.${this.region}.ecs-telemetry`),
      subnets: subnetSelection,
      open: true,
    });
    vpc.addInterfaceEndpoint(`${PRODUCT_NAME}EcsEndpoint`, {
      service: new InterfaceVpcEndpointService(`com.amazonaws.${this.region}.ecs`),
      subnets: subnetSelection,
      open: true,
    });
    vpc.addInterfaceEndpoint(`${PRODUCT_NAME}Ec2Endpoint`, {
      service: new InterfaceVpcEndpointService(`com.amazonaws.${this.region}.ec2`),
      subnets: subnetSelection,
      open: true,
    });

    return vpc;
  }

  private renderTable(): ITable {
    const table = new Table(this, "Table", {
      tableName: PRODUCT_NAME,
      partitionKey: {
        name: "PK",
        type: AttributeType.STRING,
      },
      sortKey: {
        name: "SK",
        type: AttributeType.STRING,
      },
      timeToLiveAttribute: "expiry",
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: "gsi1",
      partitionKey: { name: "GSI1_PK", type: AttributeType.STRING },
      sortKey: { name: "GSI1_SK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    table.addLocalSecondaryIndex({
      indexName: "lsi1",
      sortKey: { name: "LSI1_SK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    table.addLocalSecondaryIndex({
      indexName: "lsi2",
      sortKey: { name: "LSI2_SK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    table.addLocalSecondaryIndex({
      indexName: "lsi3",
      sortKey: { name: "LSI3_SK", type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    return table;
  }

  private renderBucket(bucketName: string, createNew?: boolean): IBucket {
    if (createNew ?? true) {
      return new Bucket(this, "Bucket", {
        bucketName: bucketName,
        encryption: BucketEncryption.KMS_MANAGED,
        enforceSSL: true,
      });
    }
    return Bucket.fromBucketName(this, "Bucket", bucketName);
  }

  private addParameter(props: ParameterProps): IParameter {
    return new StringParameter(this, props.name, {
      parameterName: `${parameterPrefix}${props.name}`,
      stringValue: props.value,
      description: props.description,
    });
  }

  private addStringListParameter(props: ParameterListProps): StringListParameter {
    return new StringListParameter(this, props.name, {
      parameterName: `${parameterPrefix}${props.name}`,
      stringListValue: props.values,
      description: props.description,
    });
  }

  private renderNextflowStack(props: ContextStackProps) {
    const batchProps = this.getNextflowBatchProps(props);
    const batchStack = this.renderBatchStack(batchProps);

    // Nextflow submits workflow head jobs to an on demand queue, and
    // optionally workflow jobs to a spot queue. There is no server, just an
    // adapter lambda.
    let jobQueue, headQueue;
    if (props.contextParameters.requestSpotInstances) {
      jobQueue = batchStack.batchSpot.jobQueue;
      headQueue = batchStack.batchOnDemand.jobQueue;
    } else {
      headQueue = jobQueue = batchStack.batchOnDemand.jobQueue;
    }

    const commonEngineProps = this.getCommonEngineProps(props);
    const computeEnvImage = this.computeEnvImage;

    const ecrImage = createEcrImage(this);

    new NextflowEngineConstruct(this, "nextflow-engine", this.wesAdapterAsset, {
      ...commonEngineProps,
      jobQueue,
      headQueue,
      computeEnvImage,
      ecrImage,
    }).outputToParent();
  }

  private getCommonBatchProps(props: ContextStackProps) {
    const { contextParameters } = props;
    return {
      vpc: this.vpc,
      subnets: this.subnets,
      iops: this.iops,
      computeEnvImage: this.computeEnvImage,
      contextParameters,
    };
  }

  private getNextflowBatchProps(props: ContextStackProps) {
    const commonBatchProps = this.getCommonBatchProps(props);
    const { requestSpotInstances } = props.contextParameters;
    return {
      ...commonBatchProps,
      createSpotBatch: requestSpotInstances,
      createOnDemandBatch: true,
      parent: this,
    };
  }

  private renderBatchStack(props: BatchConstructProps) {
    return new BatchConstruct(this, "Batch", props);
  }

  private getCommonEngineProps(props: ContextStackProps) {
    return {
      vpc: this.vpc,
      subnets: this.subnets,
      iops: this.iops,
      contextParameters: props.contextParameters,
      policyOptions: {
        managedPolicies: [],
      },
      computeEnvImage: this.computeEnvImage,
    };
  }
}
