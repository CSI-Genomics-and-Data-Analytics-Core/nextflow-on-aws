#!/usr/bin/env node
import 'source-map-support/register';
import { App } from "aws-cdk-lib";
import { PermissionsStack } from '../../lib/permission/permissions-stack';

const app = new App();
new PermissionsStack(app, 'PermissionsStack', {});
