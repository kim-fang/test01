import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createMessage, listMessages } from "@/lib/messages";
import { messageInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "请求数据不合法：昵称需为 1-80 字，留言需为 1-500 字。",
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: "请求体不是合法的 JSON。",
      },
      { status: 400 },
    );
  }

  const message =
    error instanceof Error ? error.message : "服务器发生未知错误。";

  return NextResponse.json(
    {
      error: message,
    },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const data = await listMessages();
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = messageInputSchema.parse(await request.json());
    const data = await createMessage(payload);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
