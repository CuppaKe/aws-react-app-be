import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "./getProducts";

// Create the mock client
const ddbMock = mockClient(DynamoDBDocumentClient);

describe("getProducts handler:", () => {
  const mockProducts = [
    { id: "1", title: "Product 1", price: 10 },
    { id: "2", title: "Product 2", price: 20 },
  ];

  const mockStocks = [
    { product_id: "1", count: 5 },
    { product_id: "2", count: 3 },
  ];

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should return products with stock counts", async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: mockProducts }) // First call for products
      .resolvesOnce({ Items: mockStocks }); // Second call for stocks

    const response = await handler();

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual([
      { ...mockProducts[0], count: 5 },
      { ...mockProducts[1], count: 3 },
    ]);
  });

  it("should handle empty results", async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [] })
      .resolvesOnce({ Items: [] });

    const response = await handler();

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([]);
  });

  it("should handle error cases", async () => {
    ddbMock.on(ScanCommand).rejects(new Error("DB Error"));

    const response = await handler();

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: "Internal server error",
    });
  });
});
