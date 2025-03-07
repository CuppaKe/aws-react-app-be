import { S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as csv from "csv-parser";
import { Readable } from "stream";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

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

      // Process the CSV stream
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on("data", (data) => {
            // Log each row from CSV
            console.log("Parsed CSV row:", JSON.stringify(data, null, 2));
          })
          .on("error", (error) => {
            console.error("Error parsing CSV:", error);
            reject(error);
          })
          .on("end", () => {
            console.log("Finished processing CSV file");
            resolve(null);
          });
      });

      // After successful processing, move the file
      await moveFile(bucket, key);
      console.log("File successfully moved to parsed folder");
    }
  } catch (error) {
    console.error("Error in importFileParser:", error);
    throw error;
  }
};
