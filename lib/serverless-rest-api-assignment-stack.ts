import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { AuthApiStack } from "./auth-api";
import { AppApiStack } from "./app-api";

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
  }
}
