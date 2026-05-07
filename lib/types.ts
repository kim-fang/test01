import type {
  OrderDraftRow,
  OrderFieldKey,
  OrderHistoryItem,
  OrderPreviewColumn,
  OrderValues,
  SavedTemplateRule,
  TemperatureOption,
  TemplateMapping,
  WorkbookSheetSnapshot,
} from "@/lib/order";

export type {
  OrderDraftRow,
  OrderFieldKey,
  OrderHistoryItem,
  OrderPreviewColumn,
  OrderValues,
  SavedTemplateRule,
  TemperatureOption,
  TemplateMapping,
  WorkbookSheetSnapshot,
};

export type ImportProgress = {
  percent: number;
  current: number;
  total: number;
  stage: string;
};

export type TemplateRuleMatchMode = "exact" | "similar" | "none";

export type TemplateRuleMatchInfo = {
  mode: TemplateRuleMatchMode;
  score: number;
};

export type HistoryDuplicateReference = {
  externalCode: string;
  orderId: string;
  submittedAt: string;
  receiverName: string;
  sourceTemplateName: string | null;
  sourceSheetName: string | null;
  displayLabel: string;
};

export type RawWorkbookContext = {
  selectedSheetName: string;
  sheets: Array<{
    sheetName: string;
    headers: string[];
    headerRowIndex: number;
    fingerprint: string;
    rowCount: number;
    rows: string[][];
  }>;
};

export type ImportSessionPayload = {
  fileName: string;
  selectedSheetName: string;
  fingerprint: string;
  headers: string[];
  headerRowIndex: number;
  rows: OrderDraftRow[];
  mapping: TemplateMapping;
  suggestedMapping: TemplateMapping;
  savedRule: SavedTemplateRule | null;
  supportedSheets: WorkbookSheetSnapshot[];
  existingExternalCodes: string[];
  existingExternalCodeDetails: HistoryDuplicateReference[];
  templateRuleMatch: TemplateRuleMatchInfo;
  workbookContext: {
    selectedSheetName: string;
    sheets: Array<{
      sheetName: string;
      headers: string[];
      headerRowIndex: number;
      fingerprint: string;
      rowCount: number;
      rows: string[][];
    }>;
  };
  validationMessages: string[];
  invalidCount: number;
  validCount: number;
};

export type ParseImportPayload = {
  fileName: string;
  workbookContext: RawWorkbookContext;
};

export type SubmitResult = {
  successCount: number;
  failureCount: number;
  failures: Array<{
    rowNumber: number;
    reason: string;
  }>;
};

export type HistoryListPayload = {
  items: OrderHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
};
