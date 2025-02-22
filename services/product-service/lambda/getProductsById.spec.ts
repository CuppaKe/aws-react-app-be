import { handler } from "./getProductById";

describe("Get Product By ID Lambda:", () => {
  const mockEvent = (productId: string): any => ({
    pathParameters: { id: productId },
  });

  it("should return product when valid ID is provided", async () => {
    // Arrange
    const event = mockEvent("1");
    const expectedProduct = {
      id: 1,
      title: "Item 1",
      description: "Description for Item 1",
      price: 19,
    };

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual(expectedProduct);
  });

  it("should return 404 when product is not found", async () => {
    // Arrange
    const event = mockEvent("999");

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body as string)).toEqual({
      message: "Product not found",
    });
  });

  it("should handle missing path parameters", async () => {
    // Arrange
    const event = {};

    // Act
    const result = await handler(event);

    // Assert
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body as string)).toEqual({
      message: "Product not found",
    });
  });
});
