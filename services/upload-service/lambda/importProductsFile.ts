import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.UPLOAD_BUCKET || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Event:", JSON.stringify(event));

    // Get the filename from query parameters
    const fileName = event.queryStringParameters?.name;

    if (!fileName || !fileName.toLowerCase().endsWith(".csv")) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message:
            "Invalid or missing file name. Please provide a CSV file name.",
        }),
      };
    }

    // Create the S3 key in the uploaded folder
    const fileKey = `uploaded/${fileName}`;

    // Create command for S3 put operation
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: "text/csv",
    });

    // Generate presigned URL (valid for 15 minutes)
    const signedUrl = await getSignedUrl(s3Client, command);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Credentials": true,
      },
      body: signedUrl, // Return just the URL as a string
    };
  } catch (error) {
    console.error("Error generating import URL:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Error generating import URL",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
