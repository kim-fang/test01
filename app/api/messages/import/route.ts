import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { importMessages } from "@/lib/messages";
import { importPayloadSchema } from "@/lib/validation";

export const runtime = "nodejs";

function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => issue.message);

    return NextResponse.json(
      {
        error: details[0] ?? "导入数据不合法。",
        details,
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

export async function POST(request: Request) {
  try {
    const payload = importPayloadSchema.parse(await request.json());
    const data = await importMessages(payload.rows);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
