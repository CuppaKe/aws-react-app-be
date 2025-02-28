import { items } from "./mockedData";

export const handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify(items),
  };
};
