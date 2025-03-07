import { handler } from "./importProductsFile";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";

const s3Mock = mockClient(S3Client);

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

describe.only("Lambda Handler Tests", () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules(); // Clears any cached modules
    process.env = {
      ...OLD_ENV,
      UPLOAD_BUCKET: "test-bucket",
      ALLOWED_ORIGIN: "*",
    };
    s3Mock.reset();
  });

  afterEach(() => {
    process.env = OLD_ENV; // Restore original environment
  });

  it("should return a signed URL for a valid CSV filename", async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue("https://signed-url.com");

    const event = {
      queryStringParameters: {
        name: "test.csv",
      },
    } as unknown as APIGatewayProxyEvent;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("https://signed-url.com");
  });

  it("should return 400 if filename is missing", async () => {
    const event = {
      queryStringParameters: {},
    } as unknown as APIGatewayProxyEvent;
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe(
      "Invalid or missing file name. Please provide a CSV file name."
    );
  });

  it("should return 400 if filename is not a CSV", async () => {
    const event = {
      queryStringParameters: {
        name: "test.txt",
      },
    } as unknown as APIGatewayProxyEvent;
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toBe(
      "Invalid or missing file name. Please provide a CSV file name."
    );
  });

  it("should return 500 if an error occurs", async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(new Error("AWS error"));
    const event = {
      queryStringParameters: {
        name: "test.csv",
      },
    } as unknown as APIGatewayProxyEvent;
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toBe(
      "Error generating import URL"
    );
  });
});
