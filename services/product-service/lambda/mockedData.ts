export interface Item {
  id: number;
  title: string;
  description: string;
  price: number;
}

export const items: Item[] = [
  {
    id: 1,
    title: "Item 1",
    description: "Description for Item 1",
    price: 19,
  },
  {
    id: 2,
    title: "Item 2",
    description: "Description for Item 2",
    price: 29,
  },
  {
    id: 3,
    title: "Item 3",
    description: "Description for Item 3",
    price: 39,
  },
];
