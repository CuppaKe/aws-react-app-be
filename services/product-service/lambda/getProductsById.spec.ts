import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "./getProductById";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("getProductById handler:", () => {
  const mockEvent = (productId: string) => <APIGatewayProxyEvent>(<unknown>{
      pathParameters: { id: productId },
    });

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should return product when valid ID is provided", async () => {
    const mockProduct = {
      id: "1",
      title: "Item 1",
      description: "Description for Item 1",
      price: 19,
    };

    const mockStock = {
      product_id: "1",
      count: 5,
    };

    ddbMock
      .on(GetCommand)
      .resolvesOnce({ Item: mockProduct }) // Products table response
      .resolvesOnce({ Item: mockStock }); // Stocks table response

    const result = await handler(mockEvent("1"));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      ...mockProduct,
      count: mockStock.count,
    });
  });

  it("should return 404 when product is not found", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: undefined });

    const result = await handler(mockEvent("999"));

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      message: "Product not found",
    });
  });

  it("should handle missing path parameters", async () => {
    const result = await handler(mockEvent(""));

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      message: "Product Id is required",
    });
  });

  it("should handle database errors", async () => {
    ddbMock.on(GetCommand).rejects(new Error("Database error"));

    const result = await handler(mockEvent("1"));

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      message: "Something went wrong",
    });
  });

  it("should handle case when stock is not found", async () => {
    const mockProduct = {
      id: "1",
      title: "Item 1",
      description: "Description for Item 1",
      price: 19,
    };

    ddbMock
      .on(GetCommand)
      .resolvesOnce({ Item: mockProduct }) // Products table response
      .resolvesOnce({ Item: undefined }); // Stock not found

    const result = await handler(mockEvent("1"));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      ...mockProduct,
      count: 0, // Default count when stock not found
    });
  });
});
