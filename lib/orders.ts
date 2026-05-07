import { getSql } from "@/lib/db";
import { normalizeHeader } from "@/lib/order";
import type {
  HistoryListPayload,
  OrderDraftRow,
  OrderHistoryItem,
  SavedTemplateRule,
  SubmitResult,
  TemplateMapping,
} from "@/lib/types";

type TemplateRuleRow = {
  fingerprint: string;
  sheet_name: string;
  header_row_index: number;
  headers: string[];
  mapping: TemplateMapping;
  updated_at: Date | string;
};

type ShippingOrderRow = {
  id: string;
  external_code: string | null;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  weight_kg: number | string;
  quantity: number;
  temperature: string;
  remark: string;
  source_template_name: string | null;
  source_sheet_name: string | null;
  source_fingerprint: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapTemplateRule(row: TemplateRuleRow): SavedTemplateRule {
  return {
    fingerprint: row.fingerprint,
    sheetName: row.sheet_name,
    headerRowIndex: row.header_row_index,
    headers: row.headers,
    mapping: row.mapping,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function ruleSimilarity(rule: SavedTemplateRule, headers: string[]) {
  const current = new Set(headers.map((header) => normalizeHeader(header)).filter(Boolean));
  const source = rule.headers.map((header) => normalizeHeader(header)).filter(Boolean);

  if (!source.length || !current.size) {
    return 0;
  }

  let matches = 0;
  for (const header of source) {
    if (current.has(header)) {
      matches += 1;
      continue;
    }

    for (const currentHeader of current) {
      if (currentHeader.includes(header) || header.includes(currentHeader)) {
        matches += 0.7;
        break;
      }
    }
  }

  return matches / Math.max(source.length, current.size);
}

function mapShippingOrder(row: ShippingOrderRow): OrderHistoryItem {
  return {
    id: row.id,
    externalCode: row.external_code,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    senderAddress: row.sender_address,
    receiverName: row.receiver_name,
    receiverPhone: row.receiver_phone,
    receiverAddress: row.receiver_address,
    weightKg: Number(row.weight_kg),
    quantity: row.quantity,
    temperature: row.temperature as OrderHistoryItem["temperature"],
    remark: row.remark,
    sourceTemplateName: row.source_template_name,
    sourceSheetName: row.source_sheet_name,
    sourceFingerprint: row.source_fingerprint,
    submittedAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function findTemplateRuleByFingerprint(fingerprint: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT fingerprint, sheet_name, header_row_index, headers, mapping, updated_at
    FROM template_rules
    WHERE fingerprint = ${fingerprint}
    LIMIT 1;
  `) as TemplateRuleRow[];

  return rows[0] ? mapTemplateRule(rows[0]) : null;
}

export async function findTemplateRuleByHeaderSimilarity(headers: string[]) {
  const sql = getSql();
  const rows = (await sql`
    SELECT fingerprint, sheet_name, header_row_index, headers, mapping, updated_at
    FROM template_rules;
  `) as TemplateRuleRow[];

  if (!rows.length) {
    return null;
  }

  const rules = rows.map(mapTemplateRule);
  const bestRule = rules
    .map((rule) => ({ rule, score: ruleSimilarity(rule, headers) }))
    .sort((left, right) => right.score - left.score)[0];

  if (!bestRule || bestRule.score < 0.55) {
    return null;
  }

  return bestRule.rule;
}

export async function saveTemplateRule(rule: SavedTemplateRule) {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO template_rules (
      fingerprint,
      sheet_name,
      header_row_index,
      headers,
      mapping
    )
    VALUES (
      ${rule.fingerprint},
      ${rule.sheetName},
      ${rule.headerRowIndex},
      ${JSON.stringify(rule.headers)},
      ${JSON.stringify(rule.mapping)}
    )
    ON CONFLICT (fingerprint)
    DO UPDATE SET
      sheet_name = EXCLUDED.sheet_name,
      header_row_index = EXCLUDED.header_row_index,
      headers = EXCLUDED.headers,
      mapping = EXCLUDED.mapping
    RETURNING fingerprint, sheet_name, header_row_index, headers, mapping, updated_at;
  `) as TemplateRuleRow[];

  return mapTemplateRule(rows[0]);
}

export async function listExistingExternalCodes() {
  const sql = getSql();
  const rows = (await sql`
    SELECT external_code
    FROM shipping_orders
    WHERE external_code IS NOT NULL
      AND external_code <> '';
  `) as Array<{ external_code: string | null }>;

  const codes = rows
    .map((row) => row.external_code?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  return {
    set: new Set(codes),
    list: [...new Set(codes)],
  };
}

export async function submitOrders(input: {
  rows: OrderDraftRow[];
  sourceTemplateName: string;
  sourceSheetName: string;
  sourceFingerprint: string;
}) {
  const sql = getSql();
  const result: SubmitResult = {
    successCount: 0,
    failureCount: 0,
    failures: [],
  };

  for (const row of input.rows) {
    try {
      await sql`
        INSERT INTO shipping_orders (
          external_code,
          sender_name,
          sender_phone,
          sender_address,
          receiver_name,
          receiver_phone,
          receiver_address,
          weight_kg,
          quantity,
          temperature,
          remark,
          source_template_name,
          source_sheet_name,
          source_fingerprint
        )
        VALUES (
          ${row.values.externalCode.trim() || null},
          ${row.values.senderName.trim()},
          ${row.values.senderPhone.trim()},
          ${row.values.senderAddress.trim()},
          ${row.values.receiverName.trim()},
          ${row.values.receiverPhone.trim()},
          ${row.values.receiverAddress.trim()},
          ${Number(row.values.weightKg)},
          ${Number(row.values.quantity)},
          ${row.values.temperature.trim()},
          ${row.values.remark.trim()},
          ${input.sourceTemplateName},
          ${input.sourceSheetName},
          ${input.sourceFingerprint}
        );
      `;

      result.successCount += 1;
    } catch (error) {
      result.failureCount += 1;
      result.failures.push({
        rowNumber: row.rowNumber,
        reason: error instanceof Error ? error.message : "提交失败",
      });
    }
  }

  return result;
}

export async function listHistory(params: {
  externalCode: string;
  receiverName: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
}) {
  const sql = getSql();
  const externalCodeFilter = `%${params.externalCode}%`;
  const receiverNameFilter = `%${params.receiverName}%`;
  const dateFrom = params.dateFrom ? new Date(`${params.dateFrom}T00:00:00+08:00`) : null;
  const dateTo = params.dateTo ? new Date(`${params.dateTo}T23:59:59+08:00`) : null;
  const offset = (params.page - 1) * params.pageSize;

  const countRows = (await sql`
    SELECT COUNT(*)::int AS total
    FROM shipping_orders
    WHERE (${params.externalCode} = '' OR COALESCE(external_code, '') ILIKE ${externalCodeFilter})
      AND (${params.receiverName} = '' OR receiver_name ILIKE ${receiverNameFilter})
      AND (${dateFrom}::timestamptz IS NULL OR created_at >= ${dateFrom})
      AND (${dateTo}::timestamptz IS NULL OR created_at <= ${dateTo});
  `) as Array<{ total: number }>;

  const itemRows = (await sql`
    SELECT
      id,
      external_code,
      sender_name,
      sender_phone,
      sender_address,
      receiver_name,
      receiver_phone,
      receiver_address,
      weight_kg,
      quantity,
      temperature,
      remark,
      source_template_name,
      source_sheet_name,
      source_fingerprint,
      created_at,
      updated_at
    FROM shipping_orders
    WHERE (${params.externalCode} = '' OR COALESCE(external_code, '') ILIKE ${externalCodeFilter})
      AND (${params.receiverName} = '' OR receiver_name ILIKE ${receiverNameFilter})
      AND (${dateFrom}::timestamptz IS NULL OR created_at >= ${dateFrom})
      AND (${dateTo}::timestamptz IS NULL OR created_at <= ${dateTo})
    ORDER BY created_at DESC
    LIMIT ${params.pageSize}
    OFFSET ${offset};
  `) as ShippingOrderRow[];

  const payload: HistoryListPayload = {
    items: itemRows.map(mapShippingOrder),
    total: countRows[0]?.total ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };

  return payload;
}
