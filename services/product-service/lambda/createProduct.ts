import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";

import { productMapper, Product, validateProduct } from "./product.mapper";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
          "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        body: JSON.stringify({
          message: "Product is required",
        }),
      };
    }

    let itemBody;

    try {
      itemBody = JSON.parse(event.body);
      console.log("itemBody:", itemBody);
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
          "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        body: JSON.stringify({
          message: "Invalid JSON in request body",
        }),
      };
    }

    const isItemBodyValidResult = validateProduct(itemBody);

    if (!isItemBodyValidResult.isValid) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
          "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        body: JSON.stringify({ message: isItemBodyValidResult.message }),
      };
    }

    const newProduct: Product = productMapper(itemBody);

    const transactionInput: TransactWriteCommandInput = {
      TransactItems: [
        {
          Put: {
            TableName: process.env.PRODUCTS_TABLE,
            Item: newProduct,
            ConditionExpression: "attribute_not_exists(id)",
          },
        },
        {
          Put: {
            TableName: process.env.STOCKS_TABLE,
            Item: {
              product_id: newProduct.id,
              count: itemBody.count || 0,
            },
            ConditionExpression: "attribute_not_exists(product_id)",
          },
        },
      ],
    };

    await docClient.send(new TransactWriteCommand(transactionInput));

    return {
      statusCode: 201,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: JSON.stringify({
        id: newProduct.id,
        message: "Product and stock created successfully",
      }),
    };
  } catch (error) {
    console.error("Error:", error);

    if ((error as any)?.name === "TransactionCanceledException") {
      return {
        statusCode: 409,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
          "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        body: JSON.stringify({
          message:
            "Product creation failed due to conflict. Product might already exist.",
        }),
      };
    }

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: JSON.stringify({
        message: "Internal server error",
      }),
    };
  }
};
