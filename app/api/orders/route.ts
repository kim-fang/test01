import { NextResponse } from "next/server";
import { listHistory, submitOrders } from "@/lib/orders";
import { historyQuerySchema, submitOrdersPayloadSchema } from "@/lib/validation";
import type { OrderDraftRow } from "@/lib/types";

export const runtime = "nodejs";

function handleError(error: unknown, status = 400) {
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "请求处理失败。",
    },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await listHistory(
      historyQuerySchema.parse({
        externalCode: searchParams.get("externalCode") ?? "",
        receiverName: searchParams.get("receiverName") ?? "",
        dateFrom: searchParams.get("dateFrom") ?? "",
        dateTo: searchParams.get("dateTo") ?? "",
        page: searchParams.get("page") ?? "1",
        pageSize: searchParams.get("pageSize") ?? "10",
      }),
    );

    return NextResponse.json({ data });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = submitOrdersPayloadSchema.parse(await request.json());
    const hasErrors = payload.rows.some((row) =>
      Object.values(row.errors).some(
        (messages) => Array.isArray(messages) && messages.length > 0,
      ),
    );

    if (hasErrors) {
      return NextResponse.json(
        { error: "当前仍有错误行，修正后才能提交下单。" },
        { status: 400 },
      );
    }

    const data = await submitOrders({
      rows: payload.rows as OrderDraftRow[],
      sourceTemplateName: payload.sourceTemplateName,
      sourceSheetName: payload.sourceSheetName,
      sourceFingerprint: payload.sourceFingerprint,
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
