import { S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import * as csv from "csv-parser";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL!;

async function moveFile(bucket: string, sourceKey: string): Promise<void> {
  try {
    // Create the new key for parsed folder
    const parsedKey = sourceKey.replace("uploaded/", "parsed/");

    // Copy the file to parsed folder
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: parsedKey,
      })
    );

    console.log(`File copied to: ${parsedKey}`);

    // Delete the file from uploaded folder
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: sourceKey,
      })
    );

    console.log(`Original file deleted: ${sourceKey}`);
  } catch (error) {
    console.error("Error moving file:", error);
    throw error;
  }
}

async function sendMessageToSQS(message: Record<string, any>): Promise<void> {
  try {
    console.log("Sending message to SQS:", message);

    const result = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MessageBody: JSON.stringify(message),
      })
    );

    if (!result.MessageId) {
      throw new Error("Message not sent to SQS");
    }

    console.log(`Successfully sent message with ID:`, result.MessageId);
  } catch (error) {
    console.error(`Failed to send message:`, error);
    throw error;
  }
}

async function processCSVStream(stream: Readable): Promise<void> {
  await pipeline(stream, csv(), async function* (source) {
    for await (const data of source) {
      try {
        await sendMessageToSQS(data);
      } catch (error) {
        console.error("Error processing CSV row:", error);
      }
    }
  });
}

export const handler = async (event: S3Event): Promise<void> => {
  try {
    console.log(
      "ImportFileParser lambda invoked with event:",
      JSON.stringify(event, null, 2)
    );

    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      console.log(`Processing file: ${key} from bucket: ${bucket}`);

      // Get the file from S3
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error("No body in S3 response");
      }

      // Create readable stream from S3 object body
      const stream = response.Body as Readable;

      // Process the CSV stream and get all records
      await processCSVStream(stream);

      console.log("All records sent to SQS successfully");

      // After successful processing, move the file
      await moveFile(bucket, key);
      console.log("File successfully moved to parsed folder");
    }
  } catch (error) {
    console.error("Error in importFileParser:", error);
    throw error;
  }
};
