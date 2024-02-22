#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PermissionsStack } from '../../lib/permission/permissions-stack';

const app = new cdk.App();
new PermissionsStack(app, 'PermissionsStack', {});
