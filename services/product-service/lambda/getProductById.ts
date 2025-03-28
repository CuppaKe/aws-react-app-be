import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const itemId = event.pathParameters?.id;

    if (!itemId) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message: "Product Id is required",
        }),
      };
    }

    console.log("productId:", itemId);

    const productResult = await docClient.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE,
        Key: {
          id: itemId,
        },
      })
    );

    if (!productResult.Item) {
      return {
        statusCode: 404,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message: "Product not found",
        }),
      };
    }

    const stockResult = await docClient.send(
      new GetCommand({
        TableName: process.env.STOCKS_TABLE,
        Key: {
          product_id: itemId,
        },
      })
    );

    const response = {
      ...productResult.Item,
      count: stockResult.Item?.count || 0,
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Something went wrong",
      }),
    };
  }
};
