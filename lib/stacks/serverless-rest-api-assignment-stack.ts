import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { AuthApi } from "../constructs/auth-api";
import { APIApp } from "../constructs/app-api";
import { FrontendApp } from "../constructs/frontend";

type InfraStackProps = StackProps & {
  certificate?: acm.Certificate;
  zone: route53.IHostedZone;
};

export class ServerlessRestApiAssignmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
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

    const authAPI = new AuthApi(this, "AuthServiceApi", {
      userPoolId: userPoolId,
      userPoolClientId: userPoolClientId,
    });

    const apiApp = new APIApp(this, "APIApp");

    new FrontendApp(this, "FrontendApp", {
      apiUrl: apiApp.apiUrl,
      authUrl: authAPI.apiUrl,
      certificate: props.certificate,
      zone: props.zone,
    });
  }
}
