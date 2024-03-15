import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";

type AuthApiProps = {
  userPoolId: string;
  userPoolClientId: string;
};

export class AuthApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AuthApiProps) {
    super(scope, id);

    const { userPoolId, userPoolClientId } = props;

    const api = new apig.RestApi(this, "AuthServiceApi", {
      description: "Authentication Service RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

    const auth = api.root.addResource("auth");

    this.addAuthRoute(
      auth,
      "signup",
      "POST",
      "SignupFn",
      "signup.ts",
      userPoolId,
      userPoolClientId
    );
    this.addAuthRoute(
      auth,
      "confirm_signup",
      "POST",
      "ConfirmFn",
      "confirm-signup.ts",
      userPoolId,
      userPoolClientId
    );
    this.addAuthRoute(
      auth,
      "signout",
      "GET",
      "SignoutFn",
      "signout.ts",
      userPoolId,
      userPoolClientId
    );
    this.addAuthRoute(
      auth,
      "signin",
      "POST",
      "SigninFn",
      "signin.ts",
      userPoolId,
      userPoolClientId
    );
  }

  private addAuthRoute(
    auth: apig.IResource,
    resourceName: string,
    method: string,
    fnName: string,
    fnEntry: string,
    userPoolId: string,
    userPoolClientId: string
  ): void {
    const commonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: userPoolId,
        CLIENT_ID: userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    const resource = auth.addResource(resourceName);

    const fn = new node.NodejsFunction(this, fnName, {
      ...commonFnProps,
      entry: `${__dirname}/../lambdas/auth/${fnEntry}`,
    });

    resource.addMethod(method, new apig.LambdaIntegration(fn));
  }
}
