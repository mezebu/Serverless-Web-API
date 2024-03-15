import { Aws } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/reviews";

type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
};

export class AppApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AppApiProps) {
    super(scope, id);

    // Main
    const movieReviewsTable = new dynamodb.Table(this, "MovieReviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "rating", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieReviews",
    });

    movieReviewsTable.addLocalSecondaryIndex({
      indexName: "reviewer_nameIx",
      sortKey: { name: "reviewer_name", type: dynamodb.AttributeType.STRING },
    });

    movieReviewsTable.addLocalSecondaryIndex({
      indexName: "review_dateIx",
      sortKey: { name: "review_date", type: dynamodb.AttributeType.STRING },
    });

    // REST API
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
        TABLE_NAME: movieReviewsTable.tableName,
      },
    };

    // Functions
    const fetchMovieReviewsFn = new lambdanode.NodejsFunction(
      this,
      "FetchMovieReviewsFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/public/fetchReviewsByRating.ts`,
      }
    );

    const newMovieReviewFn = new lambdanode.NodejsFunction(
      this,
      "AddMovieReviewFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/protected/addMovieReview.ts`,
      }
    );

    const fetchReviewsByRatingFn = new lambdanode.NodejsFunction(
      this,
      "FetchReviewsByRatingFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/public/fetchReviewsByRating.ts`,
      }
    );

    const fetchReviewByReviewerFn = new lambdanode.NodejsFunction(
      this,
      "FetchReviewByReviewerFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/public/fetchReviewByReviewer.ts`,
      }
    );

    const fetchReviewByNameFn = new lambdanode.NodejsFunction(
      this,
      "FetchReviewByNameFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/public/fetchReviewByName.ts`,
      }
    );

    const updateReviewByReviewerFn = new lambdanode.NodejsFunction(
      this,
      "UpdateReviewByReviewerFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/protected/updateReviewByReviewer.ts`,
      }
    );

    // Translation Lambda function
    const translateReviewFn = new lambdanode.NodejsFunction(
      this,
      "TranslateReviewFn",
      {
        ...appCommonFnProps,
        entry: `${__dirname}/../lambdas/public/translateReview.ts`,
      }
    );

    const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: `${__dirname}/../lambdas/auth/authorizer.ts`,
    });

    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );

    new custom.AwsCustomResource(this, "movieReviewsddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [movieReviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of(
          "movieReviewsddbInitData"
        ), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [movieReviewsTable.tableArn],
      }),
    });

    // Permissions
    movieReviewsTable.grantReadData(fetchMovieReviewsFn);
    movieReviewsTable.grantReadWriteData(newMovieReviewFn);
    movieReviewsTable.grantReadData(fetchReviewsByRatingFn);
    movieReviewsTable.grantReadData(fetchReviewByReviewerFn);
    movieReviewsTable.grantReadData(fetchReviewByNameFn);
    movieReviewsTable.grantReadWriteData(updateReviewByReviewerFn);

    // Root resources for the endpoints
    const moviesEndpoint = api.root.addResource("movies");
    const reviewsEndpoint = api.root.addResource("reviews");

    const addMovieReviewsEndpoint = moviesEndpoint.addResource("reviews");
    const getMovieReviewEndpoint = moviesEndpoint
      .addResource("{movieId}")
      .addResource("reviews");
    const getReviewByReviewerEndpoint =
      getMovieReviewEndpoint.addResource("{reviewerName}");

    const getReviewByNameEndpoint =
      reviewsEndpoint.addResource("{reviewerName}");

    // Add translation endpoint
    const translateReviewEndpoint = getReviewByNameEndpoint
      .addResource("{movieId}")
      .addResource("translation");

    // GET /movies/{movieID}/reviews
    getMovieReviewEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(fetchMovieReviewsFn, { proxy: true })
    );

    // GET /reviews/{reviewerName}
    getReviewByNameEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(fetchReviewByNameFn, { proxy: true })
    );

    // GET /movies/{movieID}/reviews/{reviewerName}
    getReviewByReviewerEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(fetchReviewByReviewerFn, { proxy: true })
    );

    // PUT /movies/{movieID}/reviews/{reviewerName}
    getReviewByReviewerEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(updateReviewByReviewerFn),
      {
        authorizer: requestAuthorizer,
        authorizationType: apig.AuthorizationType.CUSTOM,
      }
    );

    //POST /movies/reviews
    addMovieReviewsEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieReviewFn),
      {
        authorizer: requestAuthorizer,
        authorizationType: apig.AuthorizationType.CUSTOM,
      }
    );

    // GET /reviews/{reviewerName}/{movieId}/translation?language=code
    translateReviewEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(translateReviewFn, { proxy: true })
    );
  }
}
