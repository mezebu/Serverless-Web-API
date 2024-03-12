import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/reviews";

import { Construct } from "constructs";

export class ServerlessRestApiAssignmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    // Functions
    const fetchMovieReviewsFn = new lambdanode.NodejsFunction(
      this,
      "FetchMovieReviewsFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/fetchReviewsByRating.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const newMovieReviewFn = new lambdanode.NodejsFunction(
      this,
      "AddMovieReviewFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/addMovieReview.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const fetchReviewsByRatingFn = new lambdanode.NodejsFunction(
      this,
      "FetchReviewsByRatingFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/fetchReviewsByRating.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const fetchReviewByReviewerFn = new lambdanode.NodejsFunction(
      this,
      "FetchReviewByReviewerFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/fetchReviewByReviewer.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const fetchReviewByNameFn = new lambdanode.NodejsFunction(
      this,
      "FetchReviewByNameFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/fetchReviewByName.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const updateReviewByReviewerFn = new lambdanode.NodejsFunction(
      this,
      "UpdateReviewByReviewerFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/updateReviewByReviewer.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieReviewsTable.tableName,
          REGION: "eu-west-1",
        },
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
      new apig.LambdaIntegration(updateReviewByReviewerFn, { proxy: true })
    );

    //POST /movies/reviews
    addMovieReviewsEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newMovieReviewFn, { proxy: true })
    );
  }
}
