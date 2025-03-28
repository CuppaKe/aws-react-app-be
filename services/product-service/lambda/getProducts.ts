import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async () => {
  try {
    const productsResult = await docClient.send(
      new ScanCommand({
        TableName: process.env.PRODUCTS_TABLE,
      })
    );

    const stocksResult = await docClient.send(
      new ScanCommand({
        TableName: process.env.STOCKS_TABLE,
      })
    );

    const products = productsResult.Items ?? [];
    const stocks = stocksResult.Items ?? [];

    const productsWithStock = products.map((product) => ({
      ...product,
      count:
        stocks.find((stock) => stock.product_id === product.id)?.count || 0,
    }));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: JSON.stringify(productsWithStock),
    };
  } catch (error) {
    console.error("Error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
