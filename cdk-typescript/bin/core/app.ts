#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import "source-map-support/register";
import { getContextOrDefault } from "../../lib/util";
import { CoreStack } from "../../lib/stacks";
import { Maybe } from "../../lib/types";
import { APP_TAG_KEY, APP_NAME, PRODUCT_NAME, APP_ENV_NAME, INFRASTRUCTURE_VERSION_KEY } from "../../lib/constants";

const app = new App();

const account: string = process.env.CDK_DEFAULT_ACCOUNT!;
const region: string = 'ap-southeast-1';

const infrastructureVersion = "1.0.0";
const vpcId = getContextOrDefault<Maybe<string>>(app.node, "VPC_ID");
const bucketName = getContextOrDefault(app.node, `${APP_ENV_NAME}_BUCKET_NAME`, `${APP_NAME}-${account}-${region}`);
const createNewBucket = getContextOrDefault(app.node, `CREATE_${APP_ENV_NAME}_BUCKET`, "false").toLowerCase() == "true";
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

new CoreStack(app, `${PRODUCT_NAME}-Core`, {
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
  },
  parameters: stackParameters,
  subnetIds: subnetIds,
  imageId: imageId,
});
