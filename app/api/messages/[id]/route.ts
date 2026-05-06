import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { deleteMessage, findMessageById, updateMessage } from "@/lib/messages";
import { messageIdSchema, messageInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "请求参数或内容不合法。",
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

async function getId(context: RouteContext) {
  const { id } = await context.params;
  return messageIdSchema.parse(id);
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const id = await getId(context);
    const data = await findMessageById(id);

    if (!data) {
      return NextResponse.json({ error: "网点记录不存在。" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const id = await getId(context);
    const payload = messageInputSchema.parse(await request.json());
    const data = await updateMessage(id, payload);

    if (!data) {
      return NextResponse.json({ error: "网点记录不存在。" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const id = await getId(context);
    const deleted = await deleteMessage(id);

    if (!deleted) {
      return NextResponse.json({ error: "网点记录不存在。" }, { status: 404 });
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return handleRouteError(error);
  }
}
