import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

import { itemsDto, stockItemsDto } from "./mockedData.js";

dotenv.config();

// Configure AWS
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

// Handler for inserting items into DynamoDB
const insertData = async (tableName, items) => {
  for (const item of items) {
    const params = {
      TableName: tableName,
      Item: item,
    };

    try {
      await docClient.send(new PutCommand(params));
      console.log(
        `Successfully inserted item with id: ${item.id || item.product_id}`
      );
    } catch (error) {
      console.error(
        `Failed to insert item with id: ${item.id || item.product_id}`,
        error
      );
    }
  }
};

// Handler for filling table with data
const fillTableWithData = async (tableName, items) => {
  if (!tableName) {
    throw new Error("Tablename variable is required");
  }

  try {
    console.log(`Starting data insertion for ${tableName} table...`);
    await insertData(tableName, items);
    console.log("Data insertion completed!");
  } catch (error) {
    console.error("Error:", error);
  }
};

fillTableWithData(process.env.DYNAMODB_PRODUCTS_TABLE, itemsDto);
fillTableWithData(process.env.DYNAMODB_STOCKS_TABLE, stockItemsDto);
