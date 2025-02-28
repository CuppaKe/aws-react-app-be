import { handler } from "./getProducts";

describe("Get Products Lambda:", () => {
  it("should return list of products with status 200", async () => {
    // Act
    const result = await handler();

    // Assert
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body as string);
    expect(Array.isArray(body)).toBeTruthy();
    expect(body.length).toEqual(3);
  });
});
