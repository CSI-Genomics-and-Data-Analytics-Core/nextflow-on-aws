#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import "source-map-support/register";
import {
  INFRASTRUCTURE_VERSION_KEY,
  APP_NAME,
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
import { ContextStack } from "../../lib/stacks/context-stack";

const app = new App();

const account: string = process.env.CDK_DEFAULT_ACCOUNT!;
const region: string = 'ap-southeast-1';
const contextParameters = new ContextAppParameters(app.node);

new ContextStack(app, `${PRODUCT_NAME}-Compute`, {
  contextParameters,
  env: {
    account,
    region,
  },
  tags: {
    ...contextParameters.customTags, // Spread customTags first, so our reserved keys aren't overridden
    [APP_TAG_KEY]: APP_NAME,
    [PROJECT_TAG_KEY]: contextParameters.projectName,
    [CONTEXT_TAG_KEY]: contextParameters.contextName,
    [USER_ID_TAG_KEY]: contextParameters.userId,
    [USER_EMAIL_TAG_KEY]: contextParameters.userEmail,
    [INFRASTRUCTURE_VERSION_KEY]: contextParameters.infrastructureVersion,
    [ENGINE_TAG_KEY]: contextParameters.engineName,
    [ENGINE_TYPE_TAG_KEY]: contextParameters.engineType,
  },
});
