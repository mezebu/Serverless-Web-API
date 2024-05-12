import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MovieReviewQueryParams } from "../shared/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MovieReviewQueryParams"] || {}
);

const ddbDocClient = createDocumentClient();

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, X-Requested-With, Authorization",
};

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", event);
    const queryParams = event.pathParameters;
    if (!queryParams) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "Missing query parameters" }),
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

    const movieId = queryParams?.movieId
      ? parseInt(queryParams.movieId)
      : undefined;
    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
    };

    commandInput = {
      ...commandInput,
      KeyConditionExpression: "movieId = :m",
      ExpressionAttributeValues: {
        ":m": movieId,
      },
    };

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
