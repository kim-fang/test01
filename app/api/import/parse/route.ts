import { NextResponse } from "next/server";
import { parseImportWorkbook } from "@/lib/excel-import";

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
