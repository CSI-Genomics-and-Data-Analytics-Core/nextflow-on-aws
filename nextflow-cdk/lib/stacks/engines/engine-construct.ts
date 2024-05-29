import { CfnOutput, Duration, Stack, Fn } from "aws-cdk-lib";
import { ILogGroup } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { IVpc, SubnetSelection } from "aws-cdk-lib/aws-ec2";
import { IRole } from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Asset } from "aws-cdk-lib/aws-s3-assets";

export interface EngineOutputs {
  accessLogGroup: ILogGroup;
  adapterLogGroup?: ILogGroup;
  engineLogGroup: ILogGroup;
  wesUrl: string;
  apiKey: string;
}

export abstract class EngineConstruct extends Construct {
  private readonly asset: Asset;
  protected constructor(scope: Construct, id: string, asset: Asset) {
    super(scope, id);
    this.asset = asset;
  }

  public outputToParent(): void {
    const outputs = this.getOutputs();
    new CfnOutput(Stack.of(this), "AccessLogGroupName", { value: outputs.accessLogGroup.logGroupName });
    new CfnOutput(Stack.of(this), "AdapterLogGroupName", { value: outputs.adapterLogGroup ? outputs.adapterLogGroup.logGroupName : "" });
    new CfnOutput(Stack.of(this), "EngineLogGroupName", { value: outputs.engineLogGroup.logGroupName });
    new CfnOutput(Stack.of(this), "WesUrl", { value: outputs.wesUrl });
    new CfnOutput(Stack.of(this), "ApiKey", { value: outputs.apiKey });
  }

  // create ptr to the lambda function from aws-cdk-lib 
  public renderPythonLambda(scope: Construct, id: string, role: IRole, environment: Record<string, string>, vpc?: IVpc, vpcSubnets?: SubnetSelection): Function {
    return new Function(scope, id, {
      vpc,
      vpcSubnets,
      code: Code.fromBucket(Bucket.fromBucketName(scope, "WesAdapter", this.asset.s3BucketName), this.asset.s3ObjectKey),
      handler: "index.handler",
      runtime: Runtime.PYTHON_3_12,
      environment,
      role,
      timeout: Duration.seconds(60),
      memorySize: 256,
    });
  }

  protected abstract getOutputs(): EngineOutputs;
}
