import { Construct } from "constructs";
import {
  AccessLogField,
  AccessLogFormat,
  ApiKey,
  ApiKeySourceType,
  AuthorizationType,
  ConnectionType,
  EndpointType,
  HttpIntegration,
  Integration,
  LambdaIntegration,
  LogGroupLogDestination,
  MethodLoggingLevel,
  Period,
  RestApi,
  UsagePlan,
  CfnUsagePlanKey,
  UsagePlanPerApiStage,
  VpcLink,
  Cors,
} from "aws-cdk-lib/aws-apigateway";
import { INetworkLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { AccountPrincipal, AnyPrincipal, PolicyDocument, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { ILogGroup, LogGroup } from "aws-cdk-lib/aws-logs";
import { IFunction } from "aws-cdk-lib/aws-lambda";
import { CfnOutput } from "aws-cdk-lib";

export interface ApiProxyProps {
  /**
   * An allowlist of AWS account IDs that can all this API.
   */
  allowedAccountIds: string[];
  /**
   * The load balancer to proxy.
   *
   * Required if lambda is not specified.
   */
  loadBalancer?: INetworkLoadBalancer;
  /**
   * The lambda to proxy.
   *
   * Required if loadBalancer is not specified.
   */
  lambda?: IFunction;
  /**
   * The name of the REST API.
   *
   * @default - ID of the RestApi construct.
   */
  apiName?: string;
}

export class ApiProxy extends Construct {
  public readonly accessLogGroup: ILogGroup;
  public readonly restApi: RestApi;
  public readonly apiKey: ApiKey;

  constructor(scope: Construct, props: ApiProxyProps) {
    super(scope, "ApiProxy");

    if ((props.lambda && props.loadBalancer) || (!props.lambda && !props.loadBalancer)) {
      throw Error("Either lambda or loadBalancer must be specified, but not both");
    }

    this.accessLogGroup = new LogGroup(this, "AccessLogGroup");
    this.restApi = new RestApi(this, "Resource", {
      restApiName: props.apiName,
      endpointTypes: [EndpointType.REGIONAL],
      description: "API proxy endpoint for a service",
      apiKeySourceType: ApiKeySourceType.HEADER,
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogFormat: this.renderAccessLogFormat(),
        accessLogDestination: new LogGroupLogDestination(this.accessLogGroup),
      },
      // policy: new PolicyDocument({
      //   statements: [
      //     new PolicyStatement({
      //       actions: ["execute-api:Invoke"],
      //       resources: ["execute-api:/*/*"],
      //       // allow all accounts
      //       principals: [new AnyPrincipal()],
      //     }),
      //   ],
      // }),
    });

    const apiTarget = props.lambda ? new LambdaIntegration(props.lambda) : this.renderHttpTarget(props.loadBalancer!);

    this.restApi.root.addProxy({
      defaultIntegration: apiTarget,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
      defaultMethodOptions: {
        authorizationType: AuthorizationType.NONE,
        apiKeyRequired: true,
      },
    });

    // Add API key
    this.apiKey = new ApiKey(this, 'ApiKey', {
      description: 'API key for nextflow lambda invocation',
    });

    // Create a usage plan
    const usagePlan = new UsagePlan(this, 'UsagePlan', {
      name: 'Basic',
      description: 'Basic usage plan',
      apiStages: [{
        api: this.restApi,
        stage: this.restApi.deploymentStage,
      }],
      throttle: {
        rateLimit: 10, // requests per second
        burstLimit: 100, // maximum concurrent requests
      },
      quota: {
        limit: 1000, // requests per month
        period: Period.MONTH,
      },
    });

    // Associate the API key with the usage plan
    usagePlan.addApiKey(this.apiKey);
  }

  private renderAccessLogFormat(): AccessLogFormat {
    return AccessLogFormat.custom(
      JSON.stringify({
        requestId: AccessLogField.contextRequestId(),
        caller: AccessLogField.contextIdentityCaller(),
        callerAccountId: AccessLogField.contextOwnerAccountId(),
        user: AccessLogField.contextIdentityUser(),
        requestTime: AccessLogField.contextRequestTime(),
        httpMethod: AccessLogField.contextHttpMethod(),
        resourcePath: AccessLogField.contextResourcePath(),
        status: AccessLogField.contextStatus(),
        protocol: AccessLogField.contextProtocol(),
        responseLength: AccessLogField.contextResponseLength(),
        message: AccessLogField.contextErrorMessage(),
        validationError: AccessLogField.contextErrorValidationErrorString(),
      })
    );
  }

  private renderHttpTarget(loadBalancer: INetworkLoadBalancer): Integration {
    const vpcLink = new VpcLink(this, "VpcLink", { targets: [loadBalancer] });
    const apiUrl = `http://${loadBalancer.loadBalancerDnsName}/{proxy}`;
    return new HttpIntegration(apiUrl, {
      httpMethod: "ANY",
      options: {
        connectionType: ConnectionType.VPC_LINK,
        vpcLink,
        requestParameters: { "integration.request.path.proxy": "method.request.path.proxy" },
      },
    });
  }
}
