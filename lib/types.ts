export type Message = {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type MessageInput = {
  name: string;
  content: string;
};
