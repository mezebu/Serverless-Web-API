import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", event);
    const movieId = event.pathParameters?.movieId
      ? parseInt(event.pathParameters.movieId)
      : undefined;
    const reviewerName = event.pathParameters?.reviewerName;

    if (!movieId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "Missing movieId path parameter",
        }),
      };
    }

    let commandInput: QueryCommandInput;

    if (reviewerName && isNaN(parseInt(reviewerName))) {
      commandInput = {
        TableName: process.env.TABLE_NAME,
        IndexName: "reviewer_nameIx",
        KeyConditionExpression: "movieId = :m and reviewer_name = :r",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": reviewerName,
        },
      };
    } else if (reviewerName && !isNaN(parseInt(reviewerName))) {
      commandInput = {
        TableName: process.env.TABLE_NAME,
        IndexName: "review_dateIx",
        KeyConditionExpression: "movieId = :m and begins_with(review_date, :r)",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": reviewerName,
        },
      };
    } else {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: "Missing reviewerName or year path parameter",
        }),
      };
    }

    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: commandOutput.Items,
      }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
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
