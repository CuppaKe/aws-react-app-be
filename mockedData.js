import { randomUUID } from "crypto";

const items = [
  {
    title: "Item 1",
    description: "Description for Item 1",
    price: 19,
  },
  {
    title: "Item 2",
    description: "Description for Item 2",
    price: 29,
  },
  {
    title: "Item 3",
    description: "Description for Item 3",
    price: 39,
  },
];

const ItemDtoMapper = ({ title, description, price }) => ({
  id: randomUUID(),
  title,
  description,
  price,
});

export const itemsDto = items.map(ItemDtoMapper);
export const stockItemsDto = itemsDto.map(({ id }) => ({
  product_id: id,
  count: Math.floor(Math.random() * 10),
}));
