import { z } from "zod";
import {
  orderColumns,
  orderFieldKeys,
  requiredOrderFieldKeys,
  temperatureOptions,
} from "@/lib/order";

const trimmedString = z.string().transform((value) => value.trim());

export const orderFieldEnum = z.enum(orderFieldKeys);

export const orderValuesSchema = z.object({
  externalCode: trimmedString,
  senderName: trimmedString,
  senderPhone: trimmedString,
  senderAddress: trimmedString,
  receiverName: trimmedString,
  receiverPhone: trimmedString,
  receiverAddress: trimmedString,
  weightKg: trimmedString,
  quantity: trimmedString,
  temperature: trimmedString,
  remark: trimmedString,
});

export const rowErrorSchema = z.object(
  Object.fromEntries(orderFieldKeys.map((field) => [field, z.array(z.string()).optional()])),
);

export const orderDraftRowSchema = z.object({
  id: z.string().min(1),
  rowNumber: z.number().int().positive(),
  sourceSheet: z.string(),
  values: orderValuesSchema,
  errors: rowErrorSchema,
});

export const templateMappingSchema = z.object(
  Object.fromEntries(orderFieldKeys.map((field) => [field, z.number().int().nonnegative().nullable()])),
);

export const workbookSheetSnapshotSchema = z.object({
  sheetName: z.string().min(1),
  headers: z.array(z.string()),
  headerRowIndex: z.number().int().nonnegative(),
  fingerprint: z.string().min(1),
  mapping: templateMappingSchema,
  confidence: z.number().min(0).max(1),
  rows: z.array(z.array(z.string())),
});

export const savedTemplateRuleSchema = z.object({
  fingerprint: z.string().min(1),
  sheetName: z.string().min(1),
  headerRowIndex: z.number().int().nonnegative(),
  headers: z.array(z.string()),
  mapping: templateMappingSchema,
  updatedAt: z.string().min(1),
});

export const importSessionPayloadSchema = z.object({
  fileName: z.string().min(1),
  selectedSheetName: z.string().min(1),
  fingerprint: z.string().min(1),
  headers: z.array(z.string()),
  headerRowIndex: z.number().int().nonnegative(),
  rows: z.array(orderDraftRowSchema),
  mapping: templateMappingSchema,
  suggestedMapping: templateMappingSchema,
  savedRule: savedTemplateRuleSchema.nullable(),
  supportedSheets: z.array(workbookSheetSnapshotSchema),
  existingExternalCodes: z.array(z.string()),
  workbookContext: z.object({
    sheets: z.array(
      z.object({
        sheetName: z.string().min(1),
        headers: z.array(z.string()),
        headerRowIndex: z.number().int().nonnegative(),
        fingerprint: z.string().min(1),
        rows: z.array(z.array(z.string())),
      }),
    ),
  }),
  validationMessages: z.array(z.string()),
  invalidCount: z.number().int().nonnegative(),
  validCount: z.number().int().nonnegative(),
});

export const rawWorkbookContextSchema = z.object({
  sheets: z.array(
    z.object({
      sheetName: z.string().min(1),
      rows: z.array(z.array(z.string())),
    }),
  ),
});

export const parseImportPayloadSchema = z.object({
  fileName: z.string().min(1),
  workbookContext: rawWorkbookContextSchema,
});

export const templateLearnPayloadSchema = z.object({
  fingerprint: z.string().min(1),
  sheetName: z.string().min(1),
  headerRowIndex: z.number().int().nonnegative(),
  headers: z.array(z.string()).min(1),
  mapping: templateMappingSchema,
});

export const remapPayloadSchema = z.object({
  selectedSheetName: z.string().min(1),
  headers: z.array(z.string()),
  headerRowIndex: z.number().int().nonnegative(),
  fingerprint: z.string().min(1),
  mapping: templateMappingSchema,
  workbookContext: z.object({
    sheets: z.array(
      z.object({
        sheetName: z.string().min(1),
        headers: z.array(z.string()),
        headerRowIndex: z.number().int().nonnegative(),
        fingerprint: z.string().min(1),
        rows: z.array(z.array(z.string())),
      }),
    ),
  }),
});

export const submitOrdersPayloadSchema = z.object({
  rows: z.array(orderDraftRowSchema).min(1),
  sourceTemplateName: z.string().min(1),
  sourceSheetName: z.string().min(1),
  sourceFingerprint: z.string().min(1),
});

export const historyQuerySchema = z.object({
  externalCode: z.string().trim().default(""),
  receiverName: z.string().trim().default(""),
  dateFrom: z.string().trim().default(""),
  dateTo: z.string().trim().default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
});

export const exportColumns = orderColumns;
export const exportHeaders = orderColumns.map((column) => column.label);
export const requiredFields = requiredOrderFieldKeys;
export const temperatureChoices = [...temperatureOptions];
