import { z } from "zod";

const trimmedString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max);

export const messageInputSchema = z.object({
  name: trimmedString(1, 80),
  content: trimmedString(1, 500),
});

export const messageIdSchema = z.string().uuid();
