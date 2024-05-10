import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MovieReviewQueryParams } from "../../shared/types";
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
const ddbDocClient = createDocumentClient();

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: H", event);
    const pathParams = event?.pathParameters;
    const queryParams = event?.queryStringParameters || {};
    if (!queryParams) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "Missing query parameters" }),
      };
    }
    // Check if rating is within the range of 1 to 5
    const rating = queryParams?.minRating
      ? parseInt(queryParams.minRating)
      : undefined;
    if (rating && (rating < 1 || rating > 5)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Rating must be between 1 and 5" }),
      };
    }
    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          message: `Incorrect type. Must match Query parameters schema`,
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
    };

    if ("minRating" in queryParams) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m and rating > :r",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": minRating,
        },
      };
    } else {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m",
        ExpressionAttributeValues: {
          ":m": movieId,
        },
      };
    }
    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: commandOutput.Items,
      }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error }),
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
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
