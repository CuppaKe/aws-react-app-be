import { randomUUID } from "crypto";

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
}

export const validateProduct = (
  data: any
): { isValid: boolean; message?: string } => {
  if (!data.title) {
    return { isValid: false, message: "Title is required" };
  }
  if (!data.description) {
    return { isValid: false, message: "Description is required" };
  }
  if (!data.price) {
    return { isValid: false, message: "Price is required" };
  }
  if (typeof data.price !== "number" || data.price <= 0) {
    return { isValid: false, message: "Price must be a positive number" };
  }
  if (!data.count) {
    return { isValid: false, message: "Count is required" };
  }
  if (typeof data.count !== "number" || data.count < 0) {
    return { isValid: false, message: "Count must be a positive number" };
  }

  return { isValid: true };
};

export const productMapper: (item: any) => Product = (item) => ({
  id: randomUUID(),
  title: <string>item.title,
  description: <string>item.description,
  price: <number>item.price,
});
