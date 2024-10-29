import { Construct } from "constructs";
import { renderBatchLogConfiguration } from "../../util";
import { ILogGroup } from "aws-cdk-lib/aws-logs";
import { CfnJobDefinition, JobDefinitionProps } from "aws-cdk-lib/aws-batch";

interface EngineJobDefinitionProps extends JobDefinitionProps {
  readonly logGroup: ILogGroup;
  readonly containerProperties: CfnJobDefinition.ContainerPropertiesProperty
}

export class EngineJobDefinition extends CfnJobDefinition {
  constructor(scope: Construct, id: string, props: EngineJobDefinitionProps) {
    super(scope, id, {
      // put all the mandatory fields here
      type: "container",
      containerProperties:{
        ...props.containerProperties,
        vcpus: props.containerProperties.vcpus || 1,
        memory: props.containerProperties.memory || 2048,
        jobRoleArn: props.containerProperties.jobRoleArn || "",
        executionRoleArn: props.containerProperties.executionRoleArn || "",
        image: props.containerProperties.image || "",
        logConfiguration: renderBatchLogConfiguration(scope, props.logGroup),
        environment: [
          ...(props.containerProperties.environment as Array<CfnJobDefinition.EnvironmentProperty> ?? []),
          { name: 'AWS_METADATA_SERVICE_TIMEOUT', value: '10' },
          { name: 'AWS_METADATA_SERVICE_NUM_ATTEMPTS', value: '10' },
        ]

      },
      retryStrategy: {
        attempts: 1
      },
    });
  }
}
