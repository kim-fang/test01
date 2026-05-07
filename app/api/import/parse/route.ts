import { NextResponse } from "next/server";
import { parseImportContext, parseImportWorkbook } from "@/lib/excel-import";
import { parseImportPayloadSchema } from "@/lib/validation";

export const runtime = "nodejs";

function handleError(error: unknown) {
  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "导入解析失败，请稍后重试。",
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = parseImportPayloadSchema.parse(await request.json());
      const data = await parseImportContext(payload.fileName, payload.workbookContext);
      return NextResponse.json({ data });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请先上传 Excel 文件。" }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
      return NextResponse.json({ error: "仅支持 .xlsx 或 .xls 文件。" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    if (!buffer.byteLength) {
      return NextResponse.json({ error: "上传文件为空，请检查后重试。" }, { status: 400 });
    }

    const data = await parseImportWorkbook(file.name, buffer);
    return NextResponse.json({ data });
  } catch (error) {
    return handleError(error);
  }
}
