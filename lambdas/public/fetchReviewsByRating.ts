import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MovieReviewQueryParams"] || {}
);

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, X-Requested-With, Authorization",
};

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // Handle preflight for CORS
    if (event.requestContext.http.method === "OPTIONS") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "CORS preflight successful" }),
      };
    }

    // Application logic here
    const pathParams = event.pathParameters;
    const queryParams = event.queryStringParameters || {};

    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "Incorrect type. Must match Query parameters schema",
          schema: schema.definitions["MovieReviewQueryParams"],
        }),
      };
    }

    const movieId = pathParams?.movieId
      ? parseInt(pathParams.movieId)
      : undefined;
    const minRating = queryParams?.minRating
      ? parseInt(queryParams.minRating)
      : undefined;

    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "movieId = :m",
      ExpressionAttributeValues: { ":m": movieId },
    };

    if (minRating !== undefined) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m and rating >= :r",
        ExpressionAttributeValues: { ":m": movieId, ":r": minRating },
      };
    }

    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ data: commandOutput.Items }),
    };
  } catch (error) {
    console.error(JSON.stringify(error));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server Error" }),
    };
  }
};

function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = { wrapNumbers: false };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
