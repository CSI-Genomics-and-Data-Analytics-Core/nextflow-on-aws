#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import "source-map-support/register";
import { getContextOrDefault } from "../../lib/util";
import { MainStack } from "../../lib/stacks";
import { Maybe } from "../../lib/types";
import {
  INFRASTRUCTURE_VERSION_KEY,
  APP_NAME,
  APP_ENV_NAME,
  APP_TAG_KEY,
  CONTEXT_TAG_KEY,
  PRODUCT_NAME,
  PROJECT_TAG_KEY,
  USER_EMAIL_TAG_KEY,
  USER_ID_TAG_KEY,
  ENGINE_TAG_KEY,
  ENGINE_TYPE_TAG_KEY,
} from "../../lib/constants";
import { ContextAppParameters } from "../../lib/env";

console.log("Starting CDK deployment");
const app = new App();

const account: string = process.env.CDK_DEFAULT_ACCOUNT!;
const region: string = process.env.CDK_DEFAULT_REGION ?? "ap-southeast-1";
const contextParameters = new ContextAppParameters(app.node);

const infrastructureVersion = "1.0.0";
const vpcId = getContextOrDefault<Maybe<string>>(app.node, "VPC_ID");
const bucketName = getContextOrDefault(app.node, `${APP_ENV_NAME}_BUCKET_NAME`, `${APP_NAME}-${account}-${region}`);
const createNewBucket = getContextOrDefault(app.node, `CREATE_${APP_ENV_NAME}_BUCKET`, "true").toLowerCase() == "true";
const usePublicSubnets = getContextOrDefault(app.node, `${APP_ENV_NAME}_USE_PUBLIC_SUBNETS`, "false").toLowerCase() == "true";
const subnetIds = getContextOrDefault<Maybe<string>>(app.node, `${APP_ENV_NAME}_VPC_SUBNETS`)?.split(",");
const imageId = getContextOrDefault(app.node, `${APP_ENV_NAME}_AMI`, "ami-000e3c1953aef9f7d");

const stackParameters = [
  {
    name: "bucket",
    value: bucketName,
    description: "S3 bucket which contains outputs, intermediate results, and other project-specific data",
  },
  {
    name: "installed-artifacts/s3-root-url",
    value: `s3://${bucketName}/artifacts/batch-artifacts`,
    description: "S3 root url for batch assets",
  },
];

// If user specified custom tags, add them to the stack parameters, so they will be persisted in SSM Parameter Store.
const customTagsJsonString = getContextOrDefault<Maybe<string>>(app.node, "CUSTOM_TAGS");
let customTagsMap = {};
if (customTagsJsonString) {
  stackParameters.push({
    name: "customTags",
    value: customTagsJsonString,
    description: "JSON string of custom tags to be used to tag all infrastructure",
  });
  customTagsMap = JSON.parse(customTagsJsonString);
}

new MainStack(app, `${PRODUCT_NAME}-Core`, {
  vpcId,
  bucketName,
  createNewBucket,
  usePublicSubnets,
  idempotencyKey: infrastructureVersion,
  env: {
    account,
    region,
  },
  tags: {
    // Add tags here so all infra in the core stack will be tagged as well.
    ...customTagsMap,
    [APP_TAG_KEY]: APP_NAME,
    [INFRASTRUCTURE_VERSION_KEY]: infrastructureVersion,
    [PROJECT_TAG_KEY]: contextParameters.projectName,
    [CONTEXT_TAG_KEY]: contextParameters.contextName,
    [USER_ID_TAG_KEY]: contextParameters.userId,
    [USER_EMAIL_TAG_KEY]: contextParameters.userEmail,
    [ENGINE_TAG_KEY]: contextParameters.engineName,
    [ENGINE_TYPE_TAG_KEY]: contextParameters.engineType,
  },
  parameters: stackParameters,
  subnetIds: subnetIds,
  imageId: imageId,
  contextParameters: contextParameters,
});