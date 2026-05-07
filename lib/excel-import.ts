import * as XLSX from "xlsx";
import {
  buildAutoMapping,
  countMappedFields,
  countMappedRequiredFields,
  createEmptyOrderValues,
  fingerprintHeaders,
  normalizeHeader,
  orderColumns,
  orderFieldKeys,
  validateOrderRows,
} from "@/lib/order";
import {
  listExistingExternalCodes,
  resolveTemplateRule,
  saveTemplateRule,
} from "@/lib/orders";
import type {
  ImportSessionPayload,
  OrderDraftRow,
  RawWorkbookContext,
  SavedTemplateRule,
  TemplateMapping,
  WorkbookSheetSnapshot,
} from "@/lib/types";

function cellToText(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? `${value}` : `${value}`;
  }

  return `${value}`.trim();
}

function buildSheetSnapshotFromMatrix(sheetName: string, matrix: string[][]): WorkbookSheetSnapshot | null {
  if (matrix.length === 0) {
    return null;
  }

  const candidate = pickHeaderRow(matrix.slice(0, Math.min(matrix.length, 8)));

  if (candidate.headerRowIndex < 0 || candidate.requiredMatches < 4) {
    return null;
  }

  const headers = candidate.headers;
  const rows = matrix.slice(candidate.headerRowIndex + 1).filter((row) =>
    row.some((cell) => cellToText(cell).trim().length > 0),
  );

  return {
    sheetName,
    headers,
    headerRowIndex: candidate.headerRowIndex,
    fingerprint: fingerprintHeaders(headers),
    mapping: candidate.mapping,
    confidence: Math.min(1, candidate.requiredMatches / orderColumns.filter((column) => column.required).length),
    rows,
  };
}

function rowsFromMatrix(
  matrix: string[][],
  sheetName: string,
  headerRowIndex: number,
  mapping: TemplateMapping,
) {
  const rows: OrderDraftRow[] = [];

  for (let index = headerRowIndex + 1; index < matrix.length; index += 1) {
    const cells = matrix[index] ?? [];
    const hasAnyValue = cells.some((cell) => cellToText(cell).trim().length > 0);

    if (!hasAnyValue) {
      continue;
    }

    const values = createEmptyOrderValues();
    for (const field of orderFieldKeys) {
      const columnIndex = mapping[field];
      values[field] =
        columnIndex === null || columnIndex === undefined
          ? ""
          : cellToText(cells[columnIndex]);
    }

    rows.push({
      id: crypto.randomUUID(),
      rowNumber: index + 1,
      sourceSheet: sheetName,
      values,
      errors: {},
    });
  }

  return rows;
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
  let bestMapping: TemplateMapping | null = null;
  let bestScore = -1;

  matrix.forEach((row, index) => {
    const headers = row.map((cell) => cellToText(cell)).filter((cell, cellIndex) => cellIndex < 30);
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
    mapping: bestMapping ?? buildAutoMapping([]),
    requiredMatches: bestMapping ? countMappedRequiredFields(bestMapping) : 0,
    totalMatches: bestMapping ? countMappedFields(bestMapping) : 0,
  };
}

function buildSheetSnapshot(sheetName: string, worksheet: XLSX.WorkSheet): WorkbookSheetSnapshot | null {
  const matrix = normalizeMatrix(worksheet);

  if (matrix.length === 0) {
    return null;
  }

  const candidate = pickHeaderRow(matrix.slice(0, Math.min(matrix.length, 8)));

  if (candidate.headerRowIndex < 0 || candidate.requiredMatches < 4) {
    return null;
  }

  return buildSheetSnapshotFromMatrix(sheetName, matrix);
}

function remapSavedRuleToHeaders(rule: SavedTemplateRule, headers: string[]) {
  const mapping = Object.fromEntries(orderFieldKeys.map((field) => [field, null])) as TemplateMapping;
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const usedIndices = new Set<number>();

  for (const field of orderFieldKeys) {
    const sourceIndex = rule.mapping[field];
    if (sourceIndex === null || sourceIndex === undefined) {
      continue;
    }

    const sourceHeader = rule.headers[sourceIndex] ?? "";
    const normalizedSource = normalizeHeader(sourceHeader);

    let bestIndex = -1;
    let bestScore = 0;

    normalizedHeaders.forEach((header, index) => {
      if (usedIndices.has(index)) {
        return;
      }

      let score = 0;
      if (!header || !normalizedSource) {
        score = 0;
      } else if (header === normalizedSource) {
        score = 100;
      } else if (header.includes(normalizedSource) || normalizedSource.includes(header)) {
        score = 70;
      } else if (header.startsWith(normalizedSource) || normalizedSource.startsWith(header)) {
        score = 55;
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && bestScore >= 55) {
      mapping[field] = bestIndex;
      usedIndices.add(bestIndex);
    }
  }

  return mapping;
}

function chooseBestSheet(sheets: WorkbookSheetSnapshot[]) {
  return [...sheets].sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }

    if (right.rows.length !== left.rows.length) {
      return right.rows.length - left.rows.length;
    }

    return left.headerRowIndex - right.headerRowIndex;
  })[0] ?? null;
}

export async function parseImportWorkbook(fileName: string, buffer: ArrayBuffer) {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: false,
      raw: false,
    });
  } catch {
    throw new Error("文件解析失败，请确认上传的是有效的 Excel 文件。");
  }

  if (!workbook.SheetNames.length) {
    throw new Error("Excel 中没有可用的 Sheet。");
  }

  const snapshots = workbook.SheetNames
    .map((sheetName) => buildSheetSnapshot(sheetName, workbook.Sheets[sheetName]))
    .filter((sheet): sheet is WorkbookSheetSnapshot => Boolean(sheet));

  if (!snapshots.length) {
    throw new Error("未识别到有效表头，请检查模板内容或手动选择列映射。");
  }

  const selectedSheet = chooseBestSheet(snapshots);

  if (!selectedSheet) {
    throw new Error("未找到可导入的数据 Sheet。");
  }

  const templateRule = await resolveTemplateRule(selectedSheet.headers, selectedSheet.fingerprint);
  const savedRule = templateRule.rule;
  const effectiveMapping = savedRule ? remapSavedRuleToHeaders(savedRule, selectedSheet.headers) : selectedSheet.mapping;
  const draftRows = rowsFromMatrix(
    selectedSheet.rows.map((row) => row.map((cell) => cellToText(cell))),
    selectedSheet.sheetName,
    -1,
    effectiveMapping,
  ).map((row, index) => ({
    ...row,
    rowNumber: selectedSheet.headerRowIndex + index + 2,
  }));

  const existingCodes = await listExistingExternalCodes();
  const validation = validateOrderRows(draftRows, existingCodes.set);

  const payload: ImportSessionPayload = {
    fileName,
    selectedSheetName: selectedSheet.sheetName,
    fingerprint: selectedSheet.fingerprint,
    headers: selectedSheet.headers,
    headerRowIndex: selectedSheet.headerRowIndex,
    rows: validation.rows,
    mapping: effectiveMapping,
    suggestedMapping: selectedSheet.mapping,
    savedRule,
    templateRuleMatch: templateRule.match,
    supportedSheets: snapshots,
    existingExternalCodes: existingCodes.list,
    workbookContext: {
      sheets: snapshots.map((sheet) => ({
        sheetName: sheet.sheetName,
        headers: sheet.headers,
        headerRowIndex: sheet.headerRowIndex,
        fingerprint: sheet.fingerprint,
        rows: sheet.rows,
      })),
    },
    validationMessages: validation.messages,
    invalidCount: validation.invalidCount,
    validCount: validation.validCount,
  };

  return payload;
}

export async function parseImportContext(fileName: string, workbookContext: RawWorkbookContext) {
  const snapshots = workbookContext.sheets
    .map((sheet) => buildSheetSnapshotFromMatrix(sheet.sheetName, sheet.rows))
    .filter((sheet): sheet is WorkbookSheetSnapshot => Boolean(sheet));

  if (!snapshots.length) {
    throw new Error("未识别到有效表头，请检查模板内容或手动选择列映射。");
  }

  const selectedSheet = chooseBestSheet(snapshots);

  if (!selectedSheet) {
    throw new Error("未找到可导入的数据 Sheet。");
  }

  const templateRule = await resolveTemplateRule(selectedSheet.headers, selectedSheet.fingerprint);
  const savedRule = templateRule.rule;
  const effectiveMapping = savedRule ? remapSavedRuleToHeaders(savedRule, selectedSheet.headers) : selectedSheet.mapping;
  const draftRows = rowsFromMatrix(
    selectedSheet.rows,
    selectedSheet.sheetName,
    -1,
    effectiveMapping,
  ).map((row, index) => ({
    ...row,
    rowNumber: selectedSheet.headerRowIndex + index + 2,
  }));

  const existingCodes = await listExistingExternalCodes();
  const validation = validateOrderRows(draftRows, existingCodes.set);

  return {
    fileName,
    selectedSheetName: selectedSheet.sheetName,
    fingerprint: selectedSheet.fingerprint,
    headers: selectedSheet.headers,
    headerRowIndex: selectedSheet.headerRowIndex,
    rows: validation.rows,
    mapping: effectiveMapping,
    suggestedMapping: selectedSheet.mapping,
    savedRule,
    templateRuleMatch: templateRule.match,
    supportedSheets: snapshots,
    existingExternalCodes: existingCodes.list,
    workbookContext: {
      sheets: snapshots.map((sheet) => ({
        sheetName: sheet.sheetName,
        headers: sheet.headers,
        headerRowIndex: sheet.headerRowIndex,
        fingerprint: sheet.fingerprint,
        rows: sheet.rows,
      })),
    },
    validationMessages: validation.messages,
    invalidCount: validation.invalidCount,
    validCount: validation.validCount,
  } satisfies ImportSessionPayload;
}

export async function rebuildRowsWithMapping(params: {
  mapping: TemplateMapping;
  fingerprint: string;
  headerRowIndex: number;
  selectedSheetName: string;
  matrixRows: string[][];
}) {
  const draftRows = rowsFromMatrix(
    params.matrixRows,
    params.selectedSheetName,
    params.headerRowIndex,
    params.mapping,
  );
  const existingCodes = await listExistingExternalCodes();
  return validateOrderRows(draftRows, existingCodes.set);
}

export function deserializeWorkbookFromJson(jsonText: string) {
  try {
    const workbook = JSON.parse(jsonText) as {
      fileName: string;
      sheets: Array<{
        sheetName: string;
        headers: string[];
        headerRowIndex: number;
        fingerprint: string;
        rows: string[][];
      }>;
    };

    return workbook;
  } catch {
    throw new Error("导入上下文损坏，请重新上传 Excel。");
  }
}

export async function learnTemplateRule(rule: SavedTemplateRule) {
  return saveTemplateRule(rule);
}
