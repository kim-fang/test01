/// <reference lib="webworker" />

import * as XLSX from "xlsx";

type WorkerProgress = {
  stage: string;
  current: number;
  total: number;
  percent: number;
};

type WorkerInput = {
  fileName: string;
  buffer: ArrayBuffer;
};

type WorkerSheet = {
  sheetName: string;
  rows: string[][];
};

type WorkerOutput = {
  fileName: string;
  workbookContext: {
    sheets: WorkerSheet[];
  };
};

declare const self: DedicatedWorkerGlobalScope;

function cellToText(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? `${value}` : `${value}`;
  }

  return `${value}`.trim();
}

function toProgress(stage: string, current: number, total: number): WorkerProgress {
  return {
    stage,
    current,
    total,
    percent: total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0,
  };
}

function estimateSheetRows(worksheet: XLSX.WorkSheet) {
  const rangeText = worksheet["!ref"];
  if (!rangeText) {
    return 0;
  }

  const range = XLSX.utils.decode_range(rangeText);
  return Math.max(0, range.e.r - range.s.r + 1);
}

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const { fileName, buffer } = event.data;

  try {
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: false,
      raw: false,
    });

    const sheets = workbook.SheetNames.map((sheetName) => ({
      sheetName,
      worksheet: workbook.Sheets[sheetName],
    }));

    const totalRows = sheets.reduce((sum, sheet) => sum + estimateSheetRows(sheet.worksheet), 0);
    let processedRows = 0;
    const workbookContext: WorkerOutput["workbookContext"] = { sheets: [] };

    for (const [sheetIndex, sheet] of sheets.entries()) {
      const matrix = XLSX.utils
        .sheet_to_json<(string | number | null)[]>(sheet.worksheet, {
          header: 1,
          blankrows: false,
          defval: "",
          raw: false,
        })
        .map((row) => row.map((cell) => cellToText(cell)));

      const rows: string[][] = [];
      for (const row of matrix) {
        rows.push(row);
        processedRows += 1;

        if (processedRows % 40 === 0 || processedRows === totalRows) {
          self.postMessage({
            type: "progress",
            payload: toProgress(
              "解析 Excel 内容",
              processedRows,
              Math.max(totalRows, 1),
            ),
          });
        }
      }

      workbookContext.sheets.push({
        sheetName: sheet.sheetName,
        rows,
      });

      self.postMessage({
        type: "progress",
        payload: toProgress(
          `已完成 Sheet ${sheetIndex + 1}/${sheets.length}`,
          Math.max(processedRows, 1),
          Math.max(totalRows, 1),
        ),
      });
    }

    const result: WorkerOutput = {
      fileName,
      workbookContext,
    };

    self.postMessage({
      type: "result",
      payload: result,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: error instanceof Error ? error.message : "Excel 解析失败。",
    });
  }
};

export {};
