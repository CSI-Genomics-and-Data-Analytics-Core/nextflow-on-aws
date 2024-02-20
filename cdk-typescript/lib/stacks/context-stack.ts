import { Size, Stack, StackProps } from "aws-cdk-lib";
import { IMachineImage, IVpc, MachineImage, SubnetSelection, Vpc } from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { getCommonParameter, getCommonParameterList, subnetSelectionFromIds } from "../util";
import {
  ENGINE_NEXTFLOW,
  VPC_NUMBER_SUBNETS_PARAMETER_NAME,
  VPC_PARAMETER_NAME,
  VPC_SUBNETS_PARAMETER_NAME,
  COMPUTE_IMAGE_PARAMETER_NAME,
  APP_NAME,
} from "../constants";
import { ContextAppParameters } from "../env";
import { BatchConstruct, BatchConstructProps } from "./engines/batch-construct";
import { NextflowEngineConstruct } from "./engines/nextflow-engine-construct";

export interface ContextStackProps extends StackProps {
  readonly contextParameters: ContextAppParameters;
}

export class ContextStack extends Stack {
  private readonly vpc: IVpc;
  private readonly iops: Size;
  private readonly subnets: SubnetSelection;
  private readonly computeEnvImage: IMachineImage;

  constructor(scope: Construct, id: string, props: ContextStackProps) {
    super(scope, id, props);

    const vpcId = getCommonParameter(this, VPC_PARAMETER_NAME);
    this.vpc = Vpc.fromLookup(this, "Vpc", { vpcId });
    const subnetIds = getCommonParameterList(this, VPC_SUBNETS_PARAMETER_NAME, VPC_NUMBER_SUBNETS_PARAMETER_NAME);
    this.subnets = subnetSelectionFromIds(this, subnetIds);
    this.computeEnvImage = MachineImage.fromSsmParameter(`/gedac/_common/${COMPUTE_IMAGE_PARAMETER_NAME}`);

    const { contextParameters } = props;
    const { engineName } = contextParameters;
    const { filesystemType } = contextParameters;
    const { fsProvisionedThroughput } = contextParameters;
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
    new NextflowEngineConstruct(this, ENGINE_NEXTFLOW, {
      ...commonEngineProps,
      jobQueue,
      headQueue,
      computeEnvImage,
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
