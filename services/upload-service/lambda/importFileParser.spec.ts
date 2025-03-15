import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { S3Event, S3EventRecord } from "aws-lambda";
import { Readable } from "stream";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

import { handler } from "./importFileParser";

const s3Mock = mockClient(S3Client);
const sqsMock = mockClient(SQSClient);

describe("ImportFileParser Lambda Tests", () => {
  beforeEach(() => {
    jest.resetModules();
    s3Mock.reset();
    sqsMock.reset();
  });

  const mockS3Event: S3Event = {
    Records: [
      <S3EventRecord>{
        eventSource: "aws:s3",
        eventTime: new Date().toISOString(),
        s3: {
          bucket: { name: "test-bucket" },
          object: { key: "uploaded/test.csv" },
        },
      },
    ],
  };

  const createMockStream = (content: string) => {
    const stream = new Readable();
    stream.push(content);
    stream.push(null);
    return sdkStreamMixin(stream);
  };

  it("should process a CSV file and move it to parsed folder", async () => {
    const mockCsvContent =
      "id,title,description\n1,Test Product,Test Description";
    const mockStream = createMockStream(mockCsvContent);

    s3Mock.on(GetObjectCommand).resolves({ Body: mockStream });
    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});

    sqsMock.on(SendMessageCommand).resolves({});

    await handler(mockS3Event);

    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(1);
    expect(s3Mock.commandCalls(CopyObjectCommand)).toHaveLength(1);
    expect(s3Mock.commandCalls(DeleteObjectCommand)).toHaveLength(1);
  });

  it("should throw an error if no body is present in the S3 response", async () => {
    s3Mock.on(GetObjectCommand).resolves({ Body: undefined });

    await expect(handler(mockS3Event)).rejects.toThrow(
      "No body in S3 response"
    );
  });

  it("should throw an error if S3 operations fail", async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error("S3 GetObject Error"));

    await expect(handler(mockS3Event)).rejects.toThrow("S3 GetObject Error");
  });
});
