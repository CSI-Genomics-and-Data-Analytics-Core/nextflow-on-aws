import { Construct } from "constructs";
import { IRole } from "aws-cdk-lib/aws-iam";
import { EngineJobDefinition } from "./engine-job-definition";
import { Engine, EngineProps } from "./engine";
import { CfnJobDefinition, IJobDefinition } from "aws-cdk-lib/aws-batch";

export interface NextflowEngineProps extends EngineProps {
  readonly jobQueueArn: string;
  readonly taskRole: IRole;
}

export class NextflowEngine extends Engine {
  readonly headJobDefinition: CfnJobDefinition;

  constructor(scope: Construct, id: string, props: NextflowEngineProps) {
    super(scope, id);

    this.headJobDefinition = new EngineJobDefinition(this, "NexflowHeadJobDef", {
      logGroup: this.logGroup,
      retryAttempts: 1,
      retryStrategies: [],
      containerProperties: {
        vcpus: 2,
        memory: 8192,
        jobRoleArn: props.taskRole.roleArn,
        image: props.ecrImage.imageName,
        command: [],
        environment: [
          {
            name: 'NF_JOB_QUEUE',
            value: props.jobQueueArn
          },
          {
            name: 'NF_WORKDIR',
            value: `${props.rootDirS3Uri}/runs`
          },
          {
            name: 'NF_LOGSDIR',
            value: `${props.rootDirS3Uri}/logs`
          },
        ]
      },
    });
  }
}
