import * as cdk from '@aws-cdk/core';
import { ManagedPolicy, PolicyDocument } from '@aws-cdk/aws-iam';
import * as stmt from './policy-statements';
export class PermissionsStack extends cdk.Stack {
  adminPolicy: ManagedPolicy;
  userPolicyCDK: ManagedPolicy;
  userPolicy: ManagedPolicy;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here
    let gedacAdminPolicy = new ManagedPolicy(this, 'gedac-admin-policy', {
      description: "managed policy for admins"
    })

    let gedacUserPolicyCDK = new ManagedPolicy(this, 'gedac-user-policy-cdk', {
      description: "managed policy for users to run cdk"
    });

    let gedacUserPolicy = new ManagedPolicy(this, 'gedac-user-policy', {
      description: "managed policy part 2 for users to run WES API"
    });

    let perms = new stmt.GedacPermissions(this);

    gedacAdminPolicy.addStatements(
      // explicit permissions
      ...perms.s3Create(),
      ...perms.s3Destroy(),
      ...perms.s3Read(),
      ...perms.s3Write(),
      ...perms.dynamodbCreate(),
      ...perms.dynamodbRead(),
      ...perms.dynamodbWrite(),
      ...perms.dynamodbDestroy(),
      ...perms.ssmCreate(),
      ...perms.ssmRead(),
      ...perms.ssmDestroy(),
      ...perms.cloudformationAdmin(),
      ...perms.ecr(),
      ...perms.deactivate(),
      ...perms.sts(),
      ...perms.iam(),
    );

    gedacUserPolicyCDK.addStatements(
      ...perms.iam(),
      ...perms.sts(),
      ...perms.ec2(),
      ...perms.s3Create(),
      ...perms.s3Destroy(),
      ...perms.s3Write(),
      ...perms.ssmCreate(),
      ...perms.ssmDestroy(),
      ...perms.ecs(),
      ...perms.elb(),
      ...perms.apigw(),
      ...perms.route53(),
      ...perms.cloudformationUser(),
    );

    gedacUserPolicy.addStatements(
      ...perms.dynamodbRead(),
      ...perms.dynamodbWrite(),
      ...perms.s3Read(),
      ...perms.ssmRead(),
      ...perms.batch(),
      ...perms.ecr(),
      ...perms.efs(),
      ...perms.cloudmap(),
      ...perms.logs(),
    )

    this.adminPolicy = gedacAdminPolicy;
    this.userPolicyCDK = gedacUserPolicyCDK;
    this.userPolicy = gedacUserPolicy;

  }
}
