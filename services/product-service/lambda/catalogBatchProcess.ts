import { SQSEvent, SQSHandler, SQSBatchResponse } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

import { productMapper, Product, validateProduct } from "./product.mapper";

const snsClient = new SNSClient({});
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE!;
const STOCKS_TABLE = process.env.STOCKS_TABLE!;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;

export const handler: SQSHandler = async (
  event: SQSEvent
): Promise<SQSBatchResponse> => {
  console.log(`Received ${event.Records.length} messages`);
  console.log("Processing batch of messages:", JSON.stringify(event, null, 2));

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const productData = JSON.parse(record.body);
      const isProductDataValid = validateProduct(productData);

      if (!isProductDataValid.isValid) {
        console.log("Invalid product data:", isProductDataValid.message);
      } else {
        const newProduct: Product = productMapper(productData);
        const { count, ...productWithoutCount } = newProduct;

        const transactItems = [
          {
            Put: {
              TableName: PRODUCTS_TABLE,
              Item: productWithoutCount,
              ConditionExpression: "attribute_not_exists(id)",
            },
          },
          {
            Put: {
              TableName: STOCKS_TABLE,
              Item: {
                product_id: newProduct.id,
                count: count,
              },
              ConditionExpression: "attribute_not_exists(product_id)",
            },
          },
        ];

        const command: TransactWriteCommandInput = {
          TransactItems: transactItems,
        };

        try {
          await docClient.send(new TransactWriteCommand(command));
          console.log(`Successfully processed product: ${newProduct.id}`);
          await snsClient.send(
            new PublishCommand({
              TopicArn: SNS_TOPIC_ARN,
              Message: JSON.stringify(newProduct),
              Subject: "New Product Created",
              MessageAttributes: {
                count: {
                  DataType: "Number",
                  StringValue: count.toString(),
                },
              },
            })
          );

          console.log(`SNS notification sent for product: ${newProduct.id}`);
        } catch (dbError) {
          console.error(
            `DynamoDB Error for product ${newProduct.id}:`,
            dbError
          );
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      }
    } catch (error) {
      console.error("Error processing record:", record.messageId, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  console.log("Batch item failures:", batchItemFailures);
  return {
    batchItemFailures,
  };
};
