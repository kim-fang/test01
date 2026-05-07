export const temperatureOptions = ["常温", "冷藏", "冷冻"] as const;

export type TemperatureOption = (typeof temperatureOptions)[number];

export type OrderFieldKey =
  | "externalCode"
  | "senderName"
  | "senderPhone"
  | "senderAddress"
  | "receiverName"
  | "receiverPhone"
  | "receiverAddress"
  | "weightKg"
  | "quantity"
  | "temperature"
  | "remark";

export type OrderValues = Record<OrderFieldKey, string>;

export type OrderDraftRow = {
  id: string;
  rowNumber: number;
  sourceSheet: string;
  values: OrderValues;
  errors: Partial<Record<OrderFieldKey, string[]>>;
};

export type OrderPreviewColumn = {
  key: OrderFieldKey;
  label: string;
  required: boolean;
  width: number;
  aliases: string[];
  inputType: "text" | "number" | "select";
};

export type TemplateMapping = Record<OrderFieldKey, number | null>;

export type WorkbookSheetSnapshot = {
  sheetName: string;
  headers: string[];
  headerRowIndex: number;
  fingerprint: string;
  mapping: TemplateMapping;
  confidence: number;
  rowCount: number;
  rows: string[][];
};

export type SavedTemplateRule = {
  fingerprint: string;
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  mapping: TemplateMapping;
  updatedAt: string;
};

export type OrderHistoryItem = {
  id: string;
  externalCode: string | null;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weightKg: number;
  quantity: number;
  temperature: TemperatureOption;
  remark: string;
  sourceTemplateName: string | null;
  sourceSheetName: string | null;
  sourceFingerprint: string | null;
  submittedAt: string;
  updatedAt: string;
};

export const orderColumns: OrderPreviewColumn[] = [
  {
    key: "externalCode",
    label: "外部编码",
    required: false,
    width: 160,
    aliases: ["外部编码", "外部订单号", "客户单号", "客户订单号", "订单号", "Ref Code", "Ref", "External Code"],
    inputType: "text",
  },
  {
    key: "senderName",
    label: "发件人姓名",
    required: true,
    width: 130,
    aliases: ["发件人姓名", "发件人", "寄件人姓名", "寄件人", "发货人", "Sender", "Sender Name"],
    inputType: "text",
  },
  {
    key: "senderPhone",
    label: "发件人电话",
    required: true,
    width: 140,
    aliases: ["发件人电话", "发件电话", "寄件人电话", "寄件人联系方式", "发货电话", "Sender Tel", "Sender Phone", "Sender Phone Number"],
    inputType: "text",
  },
  {
    key: "senderAddress",
    label: "发件人地址",
    required: true,
    width: 220,
    aliases: ["发件人地址", "发货地址", "寄件人地址", "Sender Address", "Sender Addr"],
    inputType: "text",
  },
  {
    key: "receiverName",
    label: "收件人姓名",
    required: true,
    width: 130,
    aliases: ["收件人姓名", "收件人", "收货人姓名", "收货人", "收方", "Receiver", "Recipient", "Consignee"],
    inputType: "text",
  },
  {
    key: "receiverPhone",
    label: "收件人电话",
    required: true,
    width: 140,
    aliases: ["收件人电话", "收货人电话", "收件电话", "收货人联系方式", "Receiver Tel", "Receiver Phone", "Recipient Phone"],
    inputType: "text",
  },
  {
    key: "receiverAddress",
    label: "收件人地址",
    required: true,
    width: 220,
    aliases: ["收件人地址", "收货人地址", "收货地址", "Receiver Address", "Recipient Address"],
    inputType: "text",
  },
  {
    key: "weightKg",
    label: "重量 (kg)",
    required: true,
    width: 110,
    aliases: ["重量", "重量(kg)", "重量(KG)", "重量kg", "Weight", "Weight(kg)", "Weight KG", "货物重量", "货重"],
    inputType: "number",
  },
  {
    key: "quantity",
    label: "件数",
    required: true,
    width: 90,
    aliases: ["件数", "数量", "包裹数量", "Qty", "Quantity", "件"],
    inputType: "number",
  },
  {
    key: "temperature",
    label: "温层",
    required: true,
    width: 110,
    aliases: ["温层", "温度要求", "温区", "Temp Zone", "Temp", "Temperature"],
    inputType: "select",
  },
  {
    key: "remark",
    label: "备注",
    required: false,
    width: 200,
    aliases: ["备注", "附言", "说明", "Note", "Remark", "备注信息", "附加说明"],
    inputType: "text",
  },
];

export const orderFieldKeys = orderColumns.map((column) => column.key) as OrderFieldKey[];
export const requiredOrderFieldKeys = orderColumns.filter((column) => column.required).map((column) => column.key) as OrderFieldKey[];

export const canonicalHeaderLabels = orderColumns.map((column) => column.label);

export function createEmptyOrderValues(): OrderValues {
  return {
    externalCode: "",
    senderName: "",
    senderPhone: "",
    senderAddress: "",
    receiverName: "",
    receiverPhone: "",
    receiverAddress: "",
    weightKg: "",
    quantity: "",
    temperature: "",
    remark: "",
  };
}

export function normalizeText(value: unknown) {
  return `${value ?? ""}`
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeHeader(value: unknown) {
  return normalizeText(value).replace(/[\s\-_—–/\\|.,;:：，。()（）【】[\]{}'"'"'"`~!@#$%^&*+=<>?]/g, "");
}

export function normalizeCode(value: unknown) {
  return normalizeText(value).replace(/\s+/g, "");
}

export function legacyFingerprintHeaders(headers: string[]) {
  return headers.map((header) => normalizeHeader(header)).join("|");
}

export function fingerprintHeaders(headers: string[]) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const mapping = buildAutoMapping(headers);
  const usedIndices = new Set<number>();
  const segments: string[] = [];

  for (const field of orderFieldKeys) {
    const columnIndex = mapping[field];
    if (columnIndex === null || columnIndex === undefined) {
      continue;
    }

    usedIndices.add(columnIndex);
    const header = normalizedHeaders[columnIndex] ?? "";
    segments.push(`${field}@${columnIndex}:${header || "x"}`);
  }

  normalizedHeaders.forEach((header, index) => {
    if (!header || usedIndices.has(index)) {
      return;
    }

    segments.push(`u${index}:${header}`);
  });

  if (!segments.length) {
    return legacyFingerprintHeaders(headers);
  }

  return segments.join("|");
}

function aliasScore(header: string, alias: string) {
  const normalizedHeader = normalizeHeader(header);
  const normalizedAlias = normalizeHeader(alias);

  if (!normalizedHeader || !normalizedAlias) {
    return 0;
  }

  if (normalizedHeader === normalizedAlias) {
    return 100;
  }

  if (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)) {
    return 70;
  }

  if (normalizedHeader.startsWith(normalizedAlias) || normalizedAlias.startsWith(normalizedHeader)) {
    return 55;
  }

  return 0;
}

export function scoreHeaderForField(header: string, field: OrderFieldKey) {
  const column = orderColumns.find((item) => item.key === field);

  if (!column) {
    return 0;
  }

  return Math.max(...column.aliases.map((alias) => aliasScore(header, alias)), 0);
}

export function buildAutoMapping(headers: string[]): TemplateMapping {
  const mapping = Object.fromEntries(orderFieldKeys.map((key) => [key, null])) as TemplateMapping;

  for (const field of orderFieldKeys) {
    let bestIndex = -1;
    let bestScore = 0;

    headers.forEach((header, index) => {
      const score = scoreHeaderForField(header, field);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && bestScore >= 55) {
      mapping[field] = bestIndex;
    }
  }

  return mapping;
}

export function countMappedRequiredFields(mapping: TemplateMapping) {
  return requiredOrderFieldKeys.filter((key) => mapping[key] !== null && mapping[key] !== undefined).length;
}

export function countMappedFields(mapping: TemplateMapping) {
  return orderFieldKeys.filter((key) => mapping[key] !== null && mapping[key] !== undefined).length;
}

export function isValidTemperature(value: string) {
  return temperatureOptions.includes(value as TemperatureOption);
}

export function isValidPhone(value: string) {
  const normalized = value.replace(/[\s-]/g, "");
  return /^(\+?86)?1\d{10}$/.test(normalized) || /^[0-9]{7,15}$/.test(normalized);
}

export function validateOrderValues(values: OrderValues) {
  const errors = {} as Partial<Record<OrderFieldKey, string[]>>;
  const pushError = (field: OrderFieldKey, message: string) => {
    errors[field] = [...(errors[field] ?? []), message];
  };

  const requiredFields: OrderFieldKey[] = [
    "senderName",
    "senderPhone",
    "senderAddress",
    "receiverName",
    "receiverPhone",
    "receiverAddress",
    "weightKg",
    "quantity",
    "temperature",
  ];

  for (const field of requiredFields) {
    if (!values[field].trim()) {
      pushError(field, "必填字段不能为空");
    }
  }

  if (values.senderPhone.trim() && !isValidPhone(values.senderPhone.trim())) {
    pushError("senderPhone", "电话格式错误");
  }

  if (values.receiverPhone.trim() && !isValidPhone(values.receiverPhone.trim())) {
    pushError("receiverPhone", "电话格式错误");
  }

  const weight = Number(values.weightKg);
  if (values.weightKg.trim() && (!Number.isFinite(weight) || weight <= 0)) {
    pushError("weightKg", "重量必须为正数");
  }

  const quantity = Number(values.quantity);
  if (
    values.quantity.trim() &&
    (!Number.isInteger(quantity) || quantity <= 0)
  ) {
    pushError("quantity", "件数必须为正整数");
  }

  if (values.temperature.trim() && !isValidTemperature(values.temperature.trim())) {
    pushError("temperature", "温层只能是常温、冷藏或冷冻");
  }

  return errors;
}

export function createBlankOrderRow(rowNumber: number, sourceSheet = ""): OrderDraftRow {
  return {
    id: crypto.randomUUID(),
    rowNumber,
    sourceSheet,
    values: createEmptyOrderValues(),
    errors: {},
  };
}

type ExistingCodeIndex = {
  set: Set<string>;
  details?: Map<string, string>;
};

export function duplicateMessagesForCode(rows: OrderDraftRow[], existingCodes: ExistingCodeIndex) {
  const codeMap = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const code = normalizeCode(row.values.externalCode);
    if (!code) {
      return;
    }
    codeMap.set(code, [...(codeMap.get(code) ?? []), index]);
  });

  const nextRows = rows.map((row) => ({
    ...row,
    errors: {
      ...row.errors,
      externalCode: [...(row.errors.externalCode ?? [])],
    },
  }));

  const pushRowError = (index: number, message: string) => {
    const row = nextRows[index];
    row.errors.externalCode = [...(row.errors.externalCode ?? []), message];
  };

  for (const [code, indices] of codeMap.entries()) {
    if (indices.length > 1) {
      const lineNumbers = indices.map((index) => rows[index].rowNumber);
      for (const index of indices) {
        const currentLine = rows[index].rowNumber;
        const otherLine = lineNumbers.find((line) => line !== currentLine) ?? lineNumbers[0];
        pushRowError(index, `外部编码重复：与第 ${otherLine} 行重复`);
      }
    }

    if (existingCodes.set.has(code)) {
      const historyLabel = existingCodes.details?.get(code);
      for (const index of indices) {
        pushRowError(
          index,
          historyLabel ? `外部编码重复：与${historyLabel}重复` : "外部编码重复：与历史运单重复",
        );
      }
    }
  }

  return { rows: nextRows, messages: [] as string[] };
}

export function validateOrderRows(rows: OrderDraftRow[], existingCodes: ExistingCodeIndex) {
  const basicRows = rows.map((row) => ({
    ...row,
    errors: validateOrderValues(row.values),
  }));

  const basicMessages: string[] = [];

  basicRows.forEach((row) => {
    for (const field of orderFieldKeys) {
      const fieldErrors = row.errors[field];
      if (!fieldErrors?.length) {
        continue;
      }

      const label = orderColumns.find((column) => column.key === field)?.label ?? field;
      for (const message of fieldErrors) {
        basicMessages.push(`第 ${row.rowNumber} 行，${label}：${message}`);
      }
    }
  });

  const { rows: withDuplicateChecks, messages: duplicateMessages } = duplicateMessagesForCode(
    basicRows,
    existingCodes,
  );

  const duplicateRows = withDuplicateChecks.map((row) => {
    const existingErrors = row.errors.externalCode ?? [];
    return {
      ...row,
      errors: {
        ...row.errors,
        externalCode: existingErrors,
      },
    };
  });

  const duplicateRowMessages: string[] = [];
  duplicateRows.forEach((row) => {
    const fieldErrors = row.errors.externalCode;
    if (!fieldErrors?.length) {
      return;
    }

    for (const message of fieldErrors) {
      duplicateRowMessages.push(`第 ${row.rowNumber} 行，外部编码：${message}`);
    }
  });

  const allMessages = [...basicMessages, ...duplicateMessages, ...duplicateRowMessages];
  const invalidRows = duplicateRows.filter((row) =>
    orderFieldKeys.some((field) => (row.errors[field] ?? []).length > 0),
  );

  return {
    rows: duplicateRows,
    messages: allMessages,
    invalidCount: invalidRows.length,
    validCount: duplicateRows.length - invalidRows.length,
  };
}
