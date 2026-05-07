import { NextResponse } from "next/server";
import { rebuildRowsWithMapping } from "@/lib/excel-import";
import { remapPayloadSchema } from "@/lib/validation";
import type { TemplateMapping } from "@/lib/types";

export const runtime = "nodejs";

function handleError(error: unknown) {
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "重新映射失败，请稍后重试。",
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  try {
    const payload = remapPayloadSchema.parse(await request.json());
    const selectedSheet = payload.workbookContext.sheets.find(
      (sheet) => sheet.sheetName === payload.selectedSheetName,
    );

    if (!selectedSheet) {
      return NextResponse.json({ error: "未找到对应的 Sheet 数据。" }, { status: 400 });
    }

    const validation = await rebuildRowsWithMapping({
      mapping: payload.mapping as TemplateMapping,
      fingerprint: payload.fingerprint,
      headerRowIndex: payload.headerRowIndex,
      selectedSheetName: payload.selectedSheetName,
      matrixRows: selectedSheet.rows,
    });

    return NextResponse.json({
      data: {
        rows: validation.rows,
        validationMessages: validation.messages,
        invalidCount: validation.invalidCount,
        validCount: validation.validCount,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
