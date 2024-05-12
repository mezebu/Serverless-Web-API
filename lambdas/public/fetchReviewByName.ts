import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommandInput,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

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
    const reviewerName = event.pathParameters?.reviewerName;

    if (!reviewerName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "Missing reviewerName path parameter",
        }),
      };
    }

    const commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
      IndexName: "reviewer_nameIx",
      FilterExpression: "begins_with(reviewer_name, :r)",
      ExpressionAttributeValues: {
        ":r": reviewerName,
      },
    };

    const commandOutput = await ddbDocClient.send(
      new ScanCommand(commandInput)
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
      body: JSON.stringify({ error: error.message }),
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
