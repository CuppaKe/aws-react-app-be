import { items } from "./mockedData";

export const handler = async (event: any) => {
  const productId = event.pathParameters?.id;

  const product = items.find((item) => item.id === parseInt(productId));

  if (product) {
    return {
      statusCode: 200,
      body: JSON.stringify(product),
    };
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Product not found" }),
    };
  }
};
