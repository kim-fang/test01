/// <reference lib="webworker" />

import * as XLSX from "xlsx";
import {
  buildAutoMapping,
  countMappedFields,
  countMappedRequiredFields,
  fingerprintHeaders,
} from "@/lib/order";

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
  headers: string[];
  headerRowIndex: number;
  fingerprint: string;
  rowCount: number;
  rows: string[][];
};

type WorkerOutput = {
  fileName: string;
  workbookContext: {
    selectedSheetName: string;
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

function normalizeMatrix(worksheet: XLSX.WorkSheet) {
  return XLSX.utils
    .sheet_to_json<(string | number | null)[]>(worksheet, {
      header: 1,
      blankrows: false,
      defval: "",
      raw: false,
    })
    .map((row) => row.map((cell) => cellToText(cell)));
}

function pickHeaderRow(matrix: string[][]) {
  let bestIndex = -1;
  let bestHeaders: string[] = [];
  let bestMapping = buildAutoMapping([]);
  let bestScore = -1;

  matrix.forEach((row, index) => {
    const headers = row.slice(0, 30).map((cell) => cellToText(cell));
    const mapping = buildAutoMapping(headers);
    const score = countMappedRequiredFields(mapping) * 10 + countMappedFields(mapping);

    if (score > bestScore) {
      bestIndex = index;
      bestHeaders = headers;
      bestMapping = mapping;
      bestScore = score;
    }
  });

  return {
    headerRowIndex: bestIndex,
    headers: bestHeaders,
    mapping: bestMapping,
    requiredMatches: bestMapping ? countMappedRequiredFields(bestMapping) : 0,
  };
}

function buildSnapshot(sheetName: string, matrix: string[][], retainRows = false): WorkerSheet | null {
  if (!matrix.length) {
    return null;
  }

  const candidate = pickHeaderRow(matrix.slice(0, Math.min(matrix.length, 8)));
  if (candidate.headerRowIndex < 0 || candidate.requiredMatches < 4) {
    return null;
  }

  const rows = matrix.slice(candidate.headerRowIndex + 1).filter((row) =>
    row.some((cell) => cellToText(cell).trim().length > 0),
  );

  return {
    sheetName,
    headers: candidate.headers,
    headerRowIndex: candidate.headerRowIndex,
    fingerprint: fingerprintHeaders(candidate.headers),
    rowCount: rows.length,
    rows: retainRows ? rows : [],
  };
}

function chooseBestSheet(sheets: WorkerSheet[]) {
  return [...sheets].sort((left, right) => {
    if (right.rowCount !== left.rowCount) {
      return right.rowCount - left.rowCount;
    }

    if (right.headerRowIndex !== left.headerRowIndex) {
      return left.headerRowIndex - right.headerRowIndex;
    }

    return left.sheetName.localeCompare(right.sheetName);
  })[0] ?? null;
}

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const { fileName, buffer } = event.data;

  try {
    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: false,
      raw: false,
    });

    const sheets: WorkerSheet[] = [];
    let selectedSheet: WorkerSheet | null = null;
    let selectedMatrix: string[][] | null = null;
    const totalSheets = workbook.SheetNames.length;

    for (const [index, sheetName] of workbook.SheetNames.entries()) {
      const matrix = normalizeMatrix(workbook.Sheets[sheetName]);
      const snapshot = buildSnapshot(sheetName, matrix);

      if (!snapshot) {
        self.postMessage({
          type: "progress",
          payload: toProgress(`scanning sheet ${index + 1}/${totalSheets}`, index + 1, totalSheets),
        });
        continue;
      }

      sheets.push(snapshot);
      self.postMessage({
        type: "progress",
        payload: toProgress(`scanning sheet ${index + 1}/${totalSheets}`, index + 1, totalSheets),
      });

      if (!selectedSheet) {
        selectedSheet = snapshot;
        selectedMatrix = matrix;
        continue;
      }

      const nextBest = chooseBestSheet([selectedSheet, snapshot]);
      if (nextBest?.sheetName === snapshot.sheetName) {
        selectedSheet = snapshot;
        selectedMatrix = matrix;
      }
    }

    if (!selectedSheet || !selectedMatrix || !sheets.length) {
      self.postMessage({
        type: "error",
        payload: "未识别到有效表头，请检查模板内容。",
      });
      return;
    }

    const workbookContext: WorkerOutput["workbookContext"] = {
      selectedSheetName: selectedSheet.sheetName,
      sheets: sheets.map((sheet) =>
        sheet.sheetName === selectedSheet.sheetName
          ? {
              ...sheet,
              rows: selectedMatrix,
            }
          : sheet,
      ),
    };

    self.postMessage({
      type: "result",
      payload: {
        fileName,
        workbookContext,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: error instanceof Error ? error.message : "Excel 解析失败。",
    });
  }
};

export {};
