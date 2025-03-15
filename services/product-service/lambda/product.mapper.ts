import { randomUUID } from "crypto";

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
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
  if (typeof Number(data.price) !== "number" || Number(data.price) <= 0) {
    return { isValid: false, message: "Price must be a positive number" };
  }
  if (!data.count) {
    return { isValid: false, message: "Count is required" };
  }
  if (typeof Number(data.count) !== "number" || Number(data.count) < 0) {
    return { isValid: false, message: "Count must be a positive number" };
  }

  return { isValid: true };
};

export const productMapper: (item: any) => Product = (item) => ({
  id: item?.id ?? randomUUID(),
  title: <string>item.title,
  description: <string>item.description,
  price: Number(item.price),
  count: Number(item.count),
});
