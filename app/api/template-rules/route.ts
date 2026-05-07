import { NextResponse } from "next/server";
import { saveTemplateRule } from "@/lib/orders";
import { templateLearnPayloadSchema } from "@/lib/validation";
import type { TemplateMapping } from "@/lib/types";

export const runtime = "nodejs";

function handleError(error: unknown) {
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "模板规则保存失败。",
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  try {
    const payload = templateLearnPayloadSchema.parse(await request.json());
    const data = await saveTemplateRule({
      fingerprint: payload.fingerprint,
      sheetName: payload.sheetName,
      headerRowIndex: payload.headerRowIndex,
      headers: payload.headers,
      mapping: payload.mapping as TemplateMapping,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
