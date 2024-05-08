import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { AuthApiStack } from "./auth-api";
import { AppApiStack } from "./app-api";
import { aws_s3 as s3 } from "aws-cdk-lib";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";

export class ServerlessRestApiAssignmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new UserPool(this, "UserPool", {
      signInAliases: { username: true, email: true },
      selfSignUpEnabled: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolId = userPool.userPoolId;

    const appClient = userPool.addClient("AppClient", {
      authFlows: { userPassword: true },
    });

    const userPoolClientId = appClient.userPoolClientId;

    // Create AuthApiStack
    new AuthApiStack(this, "AuthApiStack", {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
    });

    // Create AppApiStack
    new AppApiStack(this, "AppApiStack", {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
    });

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      websiteIndexDocument: "index.html",
    });

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset("./dist")],
      destinationBucket: siteBucket,
    });

    new cdk.CfnOutput(this, "WebsiteURL", {
      value: siteBucket.bucketWebsiteUrl,
    });
  }
}
