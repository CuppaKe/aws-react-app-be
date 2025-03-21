import { SQSEvent, Context, SQSBatchResponse, SQSRecord } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { handler } from "./catalogBatchProcess";

// Mock AWS clients
const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);

const validProduct = {
  id: "test-id",
  title: "Test Product",
  description: "Test Description",
  price: 100,
  count: 5,
};

const createSQSEvent = (messages: any[]): SQSEvent => ({
  Records: messages.map(
    (message, index) =>
      <SQSRecord>{
        messageId: `msg-${index}`,
        body: JSON.stringify(message),
      }
  ),
});

describe("catalogBatchProcess handler", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    ddbMock.reset();
    snsMock.reset();

    ddbMock.on(TransactWriteCommand).resolves({});
    snsMock.on(PublishCommand).resolves({});

    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should successfully process valid products", async () => {
    const event = createSQSEvent([validProduct]);
    const result = (await handler(
      event,
      <Context>{},
      () => {}
    )) as SQSBatchResponse;

    expect(result.batchItemFailures).toHaveLength(0);

    const ddbCalls = ddbMock.commandCalls(TransactWriteCommand);
    expect(ddbCalls).toHaveLength(1);
    expect(ddbCalls[0].args[0].input).toMatchObject({
      TransactItems: expect.any(Array),
    });

    const snsCalls = snsMock.commandCalls(PublishCommand);
    expect(snsCalls).toHaveLength(1);
    expect(snsCalls[0].args[0].input).toMatchObject({
      Message: JSON.stringify(validProduct),
    });
  });

  it("should handle invalid product data", async () => {
    const invalidProduct = { title: "Test Product" };
    const event = createSQSEvent([invalidProduct]);

    const result = (await handler(
      event,
      <Context>{},
      () => {}
    )) as SQSBatchResponse;

    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
    expect(result.batchItemFailures).toHaveLength(0);
  });

  it("should handle DynamoDB errors", async () => {
    ddbMock.on(TransactWriteCommand).rejects(new Error("DynamoDB error"));

    const event = createSQSEvent([validProduct]);
    const result = (await handler(
      event,
      <Context>{},
      () => {}
    )) as SQSBatchResponse;

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg-0" }]);
    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "DynamoDB Error for product test-id:",
      expect.any(Error)
    );
  });

  it("should process multiple records independently", async () => {
    ddbMock
      .on(TransactWriteCommand)
      .resolvesOnce({})
      .rejectsOnce(new Error("DynamoDB error"));

    snsMock.on(PublishCommand).resolves({});

    const event = createSQSEvent([
      validProduct,
      { ...validProduct, id: "test-id-2" },
    ]);

    const result = (await handler(
      event,
      <Context>{},
      () => {}
    )) as SQSBatchResponse;

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg-1" }]);
    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
  });

  it("should handle JSON parsing errors", async () => {
    const event: SQSEvent = {
      Records: [
        <SQSRecord>{
          messageId: "msg-1",
          body: "invalid-json",
        },
      ],
    };

    const result = (await handler(
      event,
      <Context>{},
      () => {}
    )) as SQSBatchResponse;

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: "msg-1" }]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error processing record:",
      "msg-1",
      expect.any(Error)
    );
  });
});
