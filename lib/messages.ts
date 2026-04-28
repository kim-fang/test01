import { getSql } from "@/lib/db";
import type { Message, MessageInput } from "@/lib/types";

type MessageRow = {
  id: string;
  name: string;
  content: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listMessages() {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, content, created_at, updated_at
    FROM messages
    ORDER BY created_at DESC;
  `) as MessageRow[];

  return rows.map(mapMessage);
}

export async function findMessageById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, content, created_at, updated_at
    FROM messages
    WHERE id = ${id}
    LIMIT 1;
  `) as MessageRow[];

  return rows[0] ? mapMessage(rows[0]) : null;
}

export async function createMessage(input: MessageInput) {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO messages (name, content)
    VALUES (${input.name}, ${input.content})
    RETURNING id, name, content, created_at, updated_at;
  `) as MessageRow[];

  return mapMessage(rows[0]);
}

export async function updateMessage(id: string, input: MessageInput) {
  const sql = getSql();
  const rows = (await sql`
    UPDATE messages
    SET
      name = ${input.name},
      content = ${input.content}
    WHERE id = ${id}
    RETURNING id, name, content, created_at, updated_at;
  `) as MessageRow[];

  return rows[0] ? mapMessage(rows[0]) : null;
}

export async function deleteMessage(id: string) {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM messages
    WHERE id = ${id}
    RETURNING id;
  `) as Array<{ id: string }>;

  return rows.length > 0;
}
