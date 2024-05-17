import { Fn, Names, Stack } from "aws-cdk-lib";
import { CfnComputeEnvironment, CfnJobQueue, FargateComputeEnvironment, IComputeEnvironment, ManagedEc2EcsComputeEnvironment, EcsMachineImage, AllocationStrategy, EcsMachineImageType } from "aws-cdk-lib/aws-batch";
import { CfnLaunchTemplate, InstanceType, IVpc, Vpc, SubnetSelection, LaunchTemplate, IMachineImage, MachineImage, UserData } from "aws-cdk-lib/aws-ec2";
import {
  CfnInstanceProfile,
  Grant,
  IGrantable,
  IManagedPolicy,
  IRole,
  InstanceProfile,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
import { getInstanceTypesForBatch } from "../util/instance-types";
import { batchArn, ec2Arn } from "../util";
import { APP_NAME, APP_TAG_KEY, TAGGED_RESOURCE_TYPES } from "../constants";
import { Construct } from "constructs";
import { ComputeResourceType } from "../types"
export interface ComputeOptions {
  /**
   * The VPC to run the batch in.
   */
  vpc: IVpc;
  /**
   * Private subnets of VPC to use for Batch compute environments
   */
  subnets: SubnetSelection;
  /**
   * User data to make available to the instances.
   *
   * @default none
   */
  launchTemplateData?: string;
  /**
   * The type of compute environment.
   *
   * @default ON_DEMAND
   */
  computeType?: ComputeResourceType;
  /**
   * The types of EC2 instances that may be launched in the compute environment.
   *
   * This property is only valid when using a non-Fargate compute type.
   *
   * @default optimal
   */
  instanceTypes?: InstanceType[];

  /**
   * The maximum number of EC2 vCPUs that a compute-environment can reach.
   *
   * Each vCPU is equivalent to 1,024 CPU shares.
   *
   * @default aws-batch:{@link ComputeResources#maxvCpus}
   */
  maxVCpus?: number;

  /**
   * The tags to apply to any compute resources
   * @default none
   */
  resourceTags?: { [p: string]: string };

  /**
   * If true, put EC2 instances into public subnets instead of private subnets.
   * This allows you to obtain significantly lower ongoing costs if used in conjunction with the usePublicSubnets option
   * Note that this option risks security vulnerabilities if security groups are manually modified.
   *
   * @default false
   */
  usePublicSubnets?: boolean;

  /**
   * The machine image to use for compute
   * @default managed by Batch
   */
  computeEnvImage?: MachineImage;
}

export interface BatchProps extends ComputeOptions {
  /**
   * The names of AWS managed policies to attach to the batch role.
   *
   * The batch role already includes "service-role/AmazonECSTaskExecutionRolePolicy" or
   * "service-role/AmazonEC2ContainerServiceforEC2Role" depending on whether the compute
   * type is Fargate or not.
   *
   * @default - No additional policies are added to the role
   */
  awsPolicyNames?: string[];

  /**
   * Use this if you need to pass the name of the workflow orchestrator to the LaunchTemplate so that `provision.sh` is
   * aware of the engine orchestrating the workflow tasks.
   */
  workflowOrchestrator?: string;
}

const defaultComputeType = ComputeResourceType.ON_DEMAND;

export class Batch extends Construct {
  // This is the role that the backing instances use, not the role that batch jobs run as.
  public readonly role: IRole;
  public readonly computeEnvironment: IComputeEnvironment;
  public readonly jobQueue: CfnJobQueue;

  constructor(scope: Construct, id: string, props: BatchProps) {
    super(scope, id);

    this.role = this.renderRole(props.computeType, props.awsPolicyNames);
    this.computeEnvironment = this.renderComputeEnvironment(props);

    this.jobQueue = new CfnJobQueue(this, "JobQueue", {
      computeEnvironmentOrder: [
        {
          order: 1,
          computeEnvironment: this.computeEnvironment.computeEnvironmentArn,
        },
      ],
      priority: 1,
      state: "ENABLED",
    });

    // convert above queue to IJobQueue class

  }

  public grantJobAdministration(grantee: IGrantable, jobDefinitionName = "*"): Grant {
    return Grant.addToPrincipal({
      grantee: grantee,
      actions: ["batch:SubmitJob"],
      resourceArns: [this.jobQueue.ref, batchArn(this, "job-definition", jobDefinitionName)],
    });
  }

  private renderRole(computeType?: ComputeResourceType, awsPolicyNames?: string[]): IRole {
    const awsPolicies = awsPolicyNames?.map((policyName) => ManagedPolicy.fromAwsManagedPolicyName(policyName));
    if (computeType == ComputeResourceType.FARGATE) {
      return this.renderEcsRole(awsPolicies);
    }
    return this.renderEc2Role(awsPolicies);
  }

  private renderEcsRole(managedPolicies?: IManagedPolicy[]): IRole {
    return new Role(this, "BatchRole", {
      assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [...(managedPolicies ?? []), ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")],
    });
  }

  private renderEc2Role(managedPolicies?: IManagedPolicy[]): IRole {
    const volumeArn = ec2Arn(this, "volume");

    return new Role(this, "BatchRole", {
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
      inlinePolicies: {
        "ebs-autoscaling": new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["ec2:DescribeVolumes", "ec2:CreateVolume", "ec2:CreateTags"],
              resources: [volumeArn],
            }),
            new PolicyStatement({
              actions: ["ec2:AttachVolume", "ec2:ModifyInstanceAttribute"],
              resources: [ec2Arn(this, "instance"), volumeArn],
            }),
            new PolicyStatement({
              actions: ["ec2:DeleteVolume"],
              resources: [volumeArn],
              conditions: {
                StringEquals: {
                  [`aws:ResourceTag/${APP_TAG_KEY}`]: APP_NAME,
                },
              },
            }),
          ],
        }),
        "instance-health": new PolicyDocument({
          statements: [
            new PolicyStatement({
              actions: ["autoscaling:SetInstanceHealth"],
              // ideally this would be limited to the autoscaler for this batch stacks compute environment, but we can't know it here
              resources: ["*"],
            }),
          ],
        }),
      },
      managedPolicies: [...(managedPolicies ?? []), ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2ContainerServiceforEC2Role")],
    });
  }

  private renderComputeEnvironment(options: ComputeOptions): IComputeEnvironment {
    const computeType = options.computeType || defaultComputeType;
    if (computeType == "FARGATE" || computeType == "FARGATE_SPOT") {
      return new FargateComputeEnvironment(this, "ComputeEnvironment", {
        vpc: options.vpc,
        vpcSubnets: options.subnets,
        maxvCpus: options.maxVCpus ?? 256,
      });

    }

    const launchTemplateProps = this.renderLaunchTemplateProps(options.launchTemplateData, options.resourceTags);

    /*
     * TAKE NOTE! If you change the launch template you will need to destroy any existing contexts and deploy. A CDK update won't
     * be enough to trigger an update of the Batch compute environment to use the new template.
     */
    // const cfnLaunchTemplate = launchTemplateProps ? new CfnLaunchTemplate(this, "cfnLaunchTemplate", launchTemplateProps) : undefined;

    let userdata = UserData.custom( options.launchTemplateData || "");
    
  

    // new launchTemplate
    const launchTemplate = new LaunchTemplate(this, "LaunchTemplate", {
      userData: userdata,
    });
    

    const instanceProfile = new InstanceProfile(this, "ComputeProfile", {
      role: this.role,
    });

    // // create MachineImage with ami-id
    // const machineImage = MachineImage.genericLinux({
    //   "ap-southeast-1": "ami-000e3c1953aef9f7d",
    //   "us-east-1": "ami-0c76be34ffbfb0b14",
    //   "us-east-2": "ami-076214eda80ae72ef",
    //   "us-west-1": "ami-0d54a8e02fa6fbeec",
    //   "us-west-2": "ami-0c6ee50d15e7364d4",
    // }) as EcsMachineImage;

    return new ManagedEc2EcsComputeEnvironment(this, "ComputeEnvironment", {
        vpc: options.vpc,
        // images: [machineImage],
        instanceRole: instanceProfile.role,
        instanceTypes: getInstanceTypesForBatch(options.instanceTypes, computeType, Stack.of(this).region),
        launchTemplate: launchTemplate,
        vpcSubnets: options.subnets,
        maxvCpus: options.maxVCpus ?? 256,
        allocationStrategy: computeType == "SPOT" ? AllocationStrategy.SPOT_CAPACITY_OPTIMIZED : AllocationStrategy.BEST_FIT,
        spot: computeType == "SPOT",
    });

    // create ECS Machine Image from MachineImage
    // create ManagedEc2EcsComputeEnvironment
    return new ManagedEc2EcsComputeEnvironment(this, "ComputeEnvironment", {
        vpc: options.vpc,
        images: [machineImage],
        instanceRole: instanceProfile.role,
        instanceTypes: getInstanceTypesForBatch(options.instanceTypes, computeType, Stack.of(this).region),
        launchTemplate: launchTemplate,
        vpcSubnets: options.subnets,
        maxvCpus: options.maxVCpus ?? 256,
        allocationStrategy: computeType == "SPOT" ? AllocationStrategy.SPOT_CAPACITY_OPTIMIZED : AllocationStrategy.BEST_FIT,
        spot: computeType == "SPOT",
    });




  }

  private renderLaunchTemplateProps(launchTemplateData?: string, resourceTags?: { [p: string]: string }) {
    if (launchTemplateData) {
      let tagSpecifications;

      if (resourceTags) {
        tagSpecifications = TAGGED_RESOURCE_TYPES.map((resourceTypeToTag) => ({
          resourceType: resourceTypeToTag,
          tags: Object.keys(resourceTags).map((key) => ({
            key,
            value: resourceTags[key],
          })),
        }));
      }

      return {
        launchTemplateName: Names.uniqueId(this),
        launchTemplateData: {
          userData: Fn.base64(launchTemplateData),
          tagSpecifications,
        },
      };
    }

    return undefined;
  }
}
