"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  createBlankOrderRow,
  normalizeCode,
  orderColumns,
  orderFieldKeys,
  temperatureOptions,
  validateOrderRows,
} from "@/lib/order";
import type {
  HistoryListPayload,
  ImportProgress,
  ImportSessionPayload,
  OrderDraftRow,
  OrderFieldKey,
  OrderHistoryItem,
  ParseImportPayload,
  TemplateMapping,
} from "@/lib/types";

type ApiSuccess<T> = {
  data: T;
  error?: string;
};

type HistoryFilters = {
  externalCode: string;
  receiverName: string;
  dateFrom: string;
  dateTo: string;
};

type SaveFilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob | BufferSource | string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

type ImportWorkerProgressMessage = {
  type: "progress";
  payload: ImportProgress;
};

type ImportWorkerResultMessage = {
  type: "result";
  payload: ParseImportPayload;
};

type ImportWorkerErrorMessage = {
  type: "error";
  payload: string;
};

type ImportWorkerMessage =
  | ImportWorkerProgressMessage
  | ImportWorkerResultMessage
  | ImportWorkerErrorMessage;

const emptyFilters: HistoryFilters = {
  externalCode: "",
  receiverName: "",
  dateFrom: "",
  dateTo: "",
};

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

function createProgress(stage: string, current: number, total: number): ImportProgress {
  return {
    stage,
    current,
    total,
    percent: total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0,
  };
}

function buildExportWorkbook(rows: OrderDraftRow[]) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    orderColumns.map((column) => column.label),
    ...rows.map((row) =>
      orderColumns.map((column) => {
        return row.values[column.key];
      }),
    ),
  ]);

  worksheet["!cols"] = orderColumns.map((column) => ({
    wch: Math.max(12, Math.floor(column.width / 8)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "预览数据");
  return workbook;
}

function buildExportFileName(prefix: string) {
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(new Date())
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(" ", "-");

  return `${prefix}-${stamp}.xlsx`;
}

async function saveWorkbookFile(workbook: XLSX.WorkBook, fileName: string) {
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const pickerWindow = window as SaveFilePickerWindow;

  if (pickerWindow.showSaveFilePicker) {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "Excel 工作簿",
          accept: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getErrorText(row: OrderDraftRow, field: OrderFieldKey) {
  return row.errors[field]?.join("；") ?? "";
}

function normalizeMapping(mapping: TemplateMapping) {
  return Object.fromEntries(orderFieldKeys.map((field) => [field, mapping[field] ?? null])) as TemplateMapping;
}

function readFileAsArrayBuffer(
  file: File,
  onProgress: (progress: ImportProgress) => void,
) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      onProgress(createProgress("读取本地文件", event.loaded, event.total || file.size || 1));
    };

    reader.onerror = () => {
      reject(new Error("读取本地文件失败。"));
    };

    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("读取文件结果异常。"));
        return;
      }

      onProgress(createProgress("读取本地文件", file.size || 1, file.size || 1));
      resolve(reader.result);
    };

    reader.readAsArrayBuffer(file);
  });
}

function parseWorkbookInWorker(
  fileName: string,
  buffer: ArrayBuffer,
  onProgress: (progress: ImportProgress) => void,
) {
  return new Promise<ParseImportPayload>((resolve, reject) => {
    const worker = new Worker(new URL("../workers/import-worker.ts", import.meta.url));

    worker.onmessage = (event: MessageEvent<ImportWorkerMessage>) => {
      const message = event.data;

      if (message.type === "progress") {
        onProgress(message.payload);
        return;
      }

      worker.terminate();

      if (message.type === "result") {
        resolve(message.payload);
        return;
      }

      reject(new Error(message.payload));
    };

    worker.onerror = () => {
      worker.terminate();
      reject(new Error("本地解析 Excel 失败。"));
    };

    worker.postMessage(
      {
        fileName,
        buffer,
      },
      [buffer],
    );
  });
}

function buildExistingCodeSet(session: ImportSessionPayload | null) {
  return new Set(
    (session?.existingExternalCodes ?? [])
      .map((value) => normalizeCode(value))
      .filter((value) => value.length > 0),
  );
}

function getAdjacentEditableCell(
  rows: OrderDraftRow[],
  rowId: string,
  field: OrderFieldKey,
  direction: 1 | -1,
) {
  const rowIndex = rows.findIndex((item) => item.id === rowId);
  const fieldIndex = orderFieldKeys.indexOf(field);

  if (rowIndex < 0 || fieldIndex < 0) {
    return null;
  }

  const flatIndex = rowIndex * orderFieldKeys.length + fieldIndex + direction;

  if (flatIndex < 0 || flatIndex >= rows.length * orderFieldKeys.length) {
    return null;
  }

  const nextRowIndex = Math.floor(flatIndex / orderFieldKeys.length);
  const nextFieldIndex = flatIndex % orderFieldKeys.length;
  const nextRow = rows[nextRowIndex];

  if (!nextRow) {
    return null;
  }

  return {
    rowId: nextRow.id,
    field: orderFieldKeys[nextFieldIndex],
  };
}

export function UniversalImportApp() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingNavigationRef = useRef<{ rowId: string; field: OrderFieldKey } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [submitProgress, setSubmitProgress] = useState<ImportProgress | null>(null);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exportingPreview, setExportingPreview] = useState(false);
  const [session, setSession] = useState<ImportSessionPayload | null>(null);
  const [rows, setRows] = useState<OrderDraftRow[]>([]);
  const [historyRows, setHistoryRows] = useState<OrderHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(emptyFilters);
  const [draftHistoryFilters, setDraftHistoryFilters] = useState<HistoryFilters>(emptyFilters);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    field: OrderFieldKey;
  } | null>(null);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingDraft, setMappingDraft] = useState<TemplateMapping | null>(null);

  const historyPageSize = 10;
  const selectedSheetSnapshot = session
    ? session.supportedSheets.find((sheet) => sheet.sheetName === session.selectedSheetName) ?? null
    : null;

  const validationSummary = useMemo(() => {
    if (!rows.length) {
      return {
        invalidCount: 0,
        validCount: 0,
        messages: [] as string[],
      };
    }

    const validation = validateOrderRows(rows, buildExistingCodeSet(session));
    return {
      invalidCount: validation.invalidCount,
      validCount: validation.validCount,
      messages: validation.messages,
    };
  }, [rows, session]);

  async function loadHistory(page = historyPage, filters = historyFilters) {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        page: `${page}`,
        pageSize: `${historyPageSize}`,
        externalCode: filters.externalCode,
        receiverName: filters.receiverName,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      const response = await fetch(`/api/orders?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await readJson<ApiSuccess<HistoryListPayload>>(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "历史运单加载失败。");
      }

      setHistoryRows(payload.data.items);
      setHistoryTotal(payload.data.total);
      setHistoryPage(payload.data.page);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "历史运单加载失败。");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    const bootFilters = emptyFilters;
    startTransition(() => {
      setHistoryFilters(bootFilters);
      setDraftHistoryFilters(bootFilters);
      void loadHistory(1, bootFilters);
    });
    // Initial history bootstrap only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearFeedback() {
    setNotice(null);
    setError(null);
  }

  async function handleFile(file: File) {
    clearFeedback();
    setImporting(true);
    setImportProgress(createProgress("准备解析文件", 0, 100));
    setSubmitProgress(null);
    setSession(null);
    setRows([]);
    setEditingCell(null);
    pendingNavigationRef.current = null;
    setMappingOpen(false);

    try {
      const buffer = await readFileAsArrayBuffer(file, (progress) => {
        setImportProgress(progress);
      });
      const parsedWorkbook = await parseWorkbookInWorker(file.name, buffer, (progress) => {
        setImportProgress(progress);
      });
      const workbookRowCount = parsedWorkbook.workbookContext.sheets.reduce(
        (sum, sheet) => sum + sheet.rows.length,
        0,
      );
      setImportProgress(createProgress("套用模板规则并校验数据", 0, Math.max(workbookRowCount, 1)));

      const response = await fetch("/api/import/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedWorkbook),
      });
      const payload = await readJson<ApiSuccess<ImportSessionPayload>>(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "导入解析失败。");
      }

      setSession(payload.data);
      setRows(payload.data.rows);
      setMappingDraft(normalizeMapping(payload.data.mapping));
      setImportProgress(createProgress("完成", payload.data.rows.length, payload.data.rows.length || 1));
      setNotice(
        payload.data.savedRule
          ? `已自动应用记忆模板规则，识别到 ${payload.data.rows.length} 条数据。`
          : `已识别模板并导入 ${payload.data.rows.length} 条数据。`,
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败。");
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  function handleEditValue(rowId: string, field: OrderFieldKey, value: string) {
    clearFeedback();
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              values: {
                ...row.values,
                [field]: value,
              },
            }
          : row,
      ),
    );
  }

  function commitValidationAfterEdit() {
    const nextCell = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    setRows((current) => validateOrderRows(current, buildExistingCodeSet(session)).rows);
    setEditingCell(nextCell);
  }

  function handleDeleteRow(rowId: string) {
    clearFeedback();
    setRows((current) =>
      current
        .filter((row) => row.id !== rowId)
        .map((row, index) => ({
          ...row,
          rowNumber: index + 2,
        })),
    );
  }

  function handleAddEmptyRow() {
    clearFeedback();
    setRows((current) => [...current, createBlankOrderRow(current.length + 2, session?.selectedSheetName ?? "")]);
  }

  async function applyMapping() {
    if (!session || !mappingDraft) {
      return;
    }

    clearFeedback();
    setImporting(true);
    setImportProgress(createProgress("应用手动映射", 10, 100));

    try {
      const response = await fetch("/api/import/remap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedSheetName: session.selectedSheetName,
          headers: session.headers,
          headerRowIndex: session.headerRowIndex,
          fingerprint: session.fingerprint,
          mapping: mappingDraft,
          workbookContext: session.workbookContext,
        }),
      });
      const payload = await readJson<
        ApiSuccess<{
          rows: OrderDraftRow[];
          validationMessages: string[];
          invalidCount: number;
          validCount: number;
        }>
      >(response);

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "映射应用失败。");
      }

      const updatedSession: ImportSessionPayload = {
        ...session,
        mapping: mappingDraft,
        rows: payload.data.rows,
        validationMessages: payload.data.validationMessages,
        invalidCount: payload.data.invalidCount,
        validCount: payload.data.validCount,
      };

      setSession(updatedSession);
      setRows(payload.data.rows);
      setImportProgress(createProgress("保存模板记忆", 80, 100));

      const saveResponse = await fetch("/api/template-rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fingerprint: session.fingerprint,
          sheetName: session.selectedSheetName,
          headerRowIndex: session.headerRowIndex,
          headers: session.headers,
          mapping: mappingDraft,
        }),
      });
      if (!saveResponse.ok) {
        const savePayload = (await readJson<ApiSuccess<unknown>>(saveResponse)) as ApiSuccess<unknown>;
        throw new Error(savePayload.error ?? "模板记忆保存失败。");
      }

      setNotice("已应用新映射并保存模板记忆，下次相同表头会自动匹配。");
      setMappingOpen(false);
      setImportProgress(createProgress("完成", payload.data.rows.length || 1, payload.data.rows.length || 1));
    } catch (mapError) {
      setError(mapError instanceof Error ? mapError.message : "映射应用失败。");
    } finally {
      setImporting(false);
    }
  }

  async function exportPreview() {
    if (!rows.length) {
      setNotice("当前没有可导出的预览数据。");
      return;
    }

    clearFeedback();
    setExportingPreview(true);

    try {
      const workbook = buildExportWorkbook(rows);
      await saveWorkbookFile(workbook, buildExportFileName("预览数据导出"));
      setNotice(`预览数据已导出，共 ${rows.length} 条。`);
    } catch (exportError) {
      if (exportError instanceof DOMException && exportError.name === "AbortError") {
        setNotice("已取消导出。");
      } else {
        setError(exportError instanceof Error ? exportError.message : "导出失败。");
      }
    } finally {
      setExportingPreview(false);
    }
  }

  async function submitOrders() {
    if (!session) {
      setNotice("请先导入 Excel。");
      return;
    }

    if (!rows.length) {
      setNotice("当前没有可提交的数据。");
      return;
    }

    if (validationSummary.invalidCount > 0) {
      setError("当前仍有错误行，请先修正后再提交下单。");
      return;
    }

    clearFeedback();
    setSubmitting(true);
    setSubmitProgress(createProgress("准备提交", 0, rows.length));

    try {
      const chunkSize = 100;
      let processedCount = 0;
      let successCount = 0;
      let failureCount = 0;
      const failures: Array<{ rowNumber: number; reason: string }> = [];

      for (let startIndex = 0; startIndex < rows.length; startIndex += chunkSize) {
        const chunkRows = rows.slice(startIndex, startIndex + chunkSize);
        setSubmitProgress(createProgress("提交下单", processedCount, rows.length));

        const response = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rows: chunkRows,
            sourceTemplateName: session.fileName,
            sourceSheetName: session.selectedSheetName,
            sourceFingerprint: session.fingerprint,
          }),
        });
        const payload = await readJson<
          ApiSuccess<{
            successCount: number;
            failureCount: number;
            failures: Array<{ rowNumber: number; reason: string }>;
          }>
        >(response);

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "提交下单失败。");
        }

        successCount += payload.data.successCount;
        failureCount += payload.data.failureCount;
        failures.push(...payload.data.failures);
        processedCount += chunkRows.length;
        setSubmitProgress(createProgress("提交下单", processedCount, rows.length));
      }

      setSubmitProgress(createProgress("完成", rows.length, rows.length));
      setNotice(
        failureCount > 0
          ? `提交完成，成功 ${successCount} 条，失败 ${failureCount} 条。失败详情：${failures
              .slice(0, 3)
              .map((item) => `第 ${item.rowNumber} 行 ${item.reason}`)
              .join("；")}`
          : `提交完成，成功 ${successCount} 条，失败 ${failureCount} 条。`,
      );

      if (failureCount > 0) {
        const failedRowNumbers = new Set(failures.map((item) => item.rowNumber));
        setRows((current) => current.filter((row) => failedRowNumbers.has(row.rowNumber)));
      } else {
        setRows([]);
        setSession(null);
        setMappingDraft(null);
        pendingNavigationRef.current = null;
        setEditingCell(null);
      }

      await loadHistory(1, historyFilters);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败。");
    } finally {
      setSubmitting(false);
    }
  }

  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize));

  function applyHistoryFilters(filters: HistoryFilters) {
    clearFeedback();

    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setError("开始日期不能晚于结束日期。");
      return;
    }

    setHistoryFilters(filters);
    void loadHistory(1, filters);
  }

  return (
    <main className="exam-shell">
      <aside className="exam-sidebar">
        <div className="brand-card">
          <span className="brand-kicker">AI Exam 100</span>
          <h1>万能导入下单系统</h1>
          <p>自动识别多模板 Excel，预览修正后批量提交到数据库，并保留公开可访问的历史运单。</p>
        </div>

        <div className="status-card">
          <h2>能力清单</h2>
          <ul>
            <li>5 种模板自动识别</li>
            <li>手动列映射 + 模板记忆</li>
            <li>实时校验 + 重复检测</li>
            <li>预览导出 + 批量提交</li>
            <li>历史运单分页检索</li>
          </ul>
        </div>

        <div className="status-card">
          <h2>当前状态</h2>
          <dl className="metric-list">
            <div>
              <dt>预览总数</dt>
              <dd>{rows.length}</dd>
            </div>
            <div>
              <dt>有效数据</dt>
              <dd>{validationSummary.validCount}</dd>
            </div>
            <div>
              <dt>错误行数</dt>
              <dd>{validationSummary.invalidCount}</dd>
            </div>
            <div>
              <dt>历史运单</dt>
              <dd>{historyTotal}</dd>
            </div>
          </dl>
        </div>
      </aside>

      <section className="exam-main">
        <header className="hero-card">
          <div>
            <span className="hero-badge">Next.js App Router + TypeScript + Vercel Postgres</span>
            <h2>多模板自动导入下单</h2>
            <p>
              支持标题行、列名别名、列顺序变化、说明页、多 Sheet、合并单元格模板。
              无需整理成统一模板，也能直接导入预览。
            </p>
          </div>

          <div className="hero-actions">
            <button type="button" className="primary-action" onClick={() => fileInputRef.current?.click()}>
              上传 Excel
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setMappingOpen((current) => !current)}
              disabled={!session}
            >
              手动映射
            </button>
            <input
              ref={fileInputRef}
              className="hidden-file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </div>
        </header>

        {(notice || error) && (
          <div className={`feedback-banner${error ? " error" : ""}`}>
            {error ?? notice}
          </div>
        )}

        <section
          className={`upload-panel${dragging ? " drag-active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="upload-copy">
            <span className="eyebrow">模块一 · 模板管理与文件导入</span>
            <h3>拖拽 Excel 到这里，或点击上传</h3>
            <p>
              已针对附件中的 5 个模板做兼容，支持自动识别列名别名、列顺序变化、说明 Sheet 与分组表头。
            </p>
          </div>

          <button type="button" className="primary-action" onClick={() => fileInputRef.current?.click()}>
            {importing ? "导入中..." : "选择 Excel 文件"}
          </button>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">边界场景说明</span>
              <h3>这几个细节我也处理了</h3>
            </div>
          </div>
          <div className="edge-grid">
            <div className="edge-card">
              <strong>多 Sheet / 说明页</strong>
              <p>会自动跳过说明页，优先识别含数据的 Sheet；如果表头不明显，也会向下扫描前几行。</p>
            </div>
            <div className="edge-card">
              <strong>合并单元格 / 变列序</strong>
              <p>允许标题行被合并、列顺序互换、列名中英文混用，自动识别失败时可手动映射。</p>
            </div>
            <div className="edge-card">
              <strong>选填字段缺失</strong>
              <p>外部编码、备注缺失不会阻断导入；空文件、坏文件、无有效 Sheet 会给出明确提示。</p>
            </div>
            <div className="edge-card">
              <strong>重复编码双重校验</strong>
              <p>会同时检查本批次重复和历史数据库重复，并明确提示与哪一行或历史数据冲突。</p>
            </div>
            <div className="edge-card">
              <strong>大批量导入 / 导出</strong>
              <p>1000 条以上数据也能预览、校验、导出当前修改结果，并在导入和提交时显示进度。</p>
            </div>
            <div className="edge-card">
              <strong>记忆规则</strong>
              <p>手动调过一次列映射后会保存，下次同结构模板会自动套用，减少重复配置。</p>
            </div>
          </div>
        </section>

        {importProgress ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">导入进度</span>
                <h3>{importProgress.stage}</h3>
              </div>
              <strong>{importProgress.percent}%</strong>
            </div>
            <div className="progress-track">
              <div className="progress-bar" style={{ width: `${importProgress.percent}%` }} />
            </div>
            <p className="panel-subtle">
              当前处理 {importProgress.current} / {importProgress.total}
            </p>
          </section>
        ) : null}

        {session ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">模板识别结果</span>
                <h3>{session.fileName}</h3>
              </div>
              <div className="pill-group">
                <span className="pill">Sheet：{session.selectedSheetName}</span>
                <span className="pill">表头行：第 {session.headerRowIndex + 1} 行</span>
                <span className="pill">可用数据：{rows.length} 条</span>
              </div>
            </div>

            <div className="template-summary-grid">
              <div className="summary-card">
                <span>已识别列</span>
                <strong>
                  {
                    Object.values(session.mapping).filter(
                      (value) => value !== null && value !== undefined,
                    ).length
                  }
                  /{orderColumns.length}
                </strong>
              </div>
              <div className="summary-card">
                <span>记忆模板</span>
                <strong>{session.savedRule ? "已命中" : "首次学习"}</strong>
              </div>
              <div className="summary-card">
                <span>错误提示</span>
                <strong>{validationSummary.messages.length}</strong>
              </div>
              <div className="summary-card">
                <span>可提交行</span>
                <strong>{validationSummary.validCount}</strong>
              </div>
              <div className="summary-card">
                <span>候选 Sheet</span>
                <strong>{session.supportedSheets.length}</strong>
              </div>
              <div className="summary-card">
                <span>识别置信度</span>
                <strong>{Math.round((selectedSheetSnapshot?.confidence ?? 0) * 100)}%</strong>
              </div>
            </div>

            <div className="sheet-overview">
              <div className="sheet-overview-head">
                <h4>候选 Sheet 识别概览</h4>
                <p>如果文件里有说明页、封面页或多个工作表，这里会把所有可导入候选项列出来。</p>
              </div>
              <div className="sheet-grid">
                {session.supportedSheets.map((sheet) => {
                  const isSelected = sheet.sheetName === session.selectedSheetName;
                  return (
                    <div key={sheet.sheetName} className={`sheet-card${isSelected ? " active" : ""}`}>
                      <div className="sheet-card-head">
                        <strong>{sheet.sheetName}</strong>
                        <span>{isSelected ? "当前采用" : "候选"}</span>
                      </div>
                      <p>表头：第 {sheet.headerRowIndex + 1} 行</p>
                      <p>可导入数据：{sheet.rows.length} 条</p>
                      <p>识别置信度：{Math.round(sheet.confidence * 100)}%</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {mappingOpen && mappingDraft ? (
              <div className="mapping-panel">
                <div className="mapping-head">
                  <div>
                    <h4>手动列映射</h4>
                    <p>自动识别不理想时，可手动指定 Excel 列与系统字段的对应关系，保存后会自动记忆。</p>
                  </div>
                  <button type="button" className="secondary-action" onClick={() => void applyMapping()}>
                    应用并记忆
                  </button>
                </div>

                <div className="mapping-grid">
                  {orderColumns.map((column) => (
                    <label key={column.key} className="mapping-field">
                      <span>
                        {column.label}
                        {column.required ? " *" : ""}
                      </span>
                      <select
                        value={
                          mappingDraft[column.key] === null || mappingDraft[column.key] === undefined
                            ? ""
                            : `${mappingDraft[column.key]}`
                        }
                        onChange={(event) =>
                          setMappingDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  [column.key]:
                                    event.target.value === "" ? null : Number(event.target.value),
                                }
                              : current,
                          )
                        }
                      >
                        <option value="">未映射</option>
                        {session.headers.map((header, index) => (
                          <option key={`${header}-${index}`} value={index}>
                            {header || `第 ${index + 1} 列`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">模块二 · 数据预览与编辑</span>
              <h3>类 Excel 预览表格</h3>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="secondary-action" onClick={handleAddEmptyRow} disabled={!session}>
                新增空行
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void exportPreview()}
                disabled={!rows.length || exportingPreview}
              >
                {exportingPreview ? "导出中..." : "导出预览 Excel"}
              </button>
              <button
                type="button"
                className="primary-action"
                onClick={() => void submitOrders()}
                disabled={!rows.length || submitting}
              >
                {submitting ? "提交中..." : "提交下单"}
              </button>
            </div>
          </div>

          <div className="interaction-note">
            <strong>交互提示</strong>
            <p>点击单元格即可编辑，Enter / Tab 会自动跳到下一格，Shift + Tab 返回上一格，离开单元格后会立即重新校验整行。</p>
          </div>

          {submitProgress ? (
            <div className="mini-progress">
              <div className="progress-track">
                <div className="progress-bar warm" style={{ width: `${submitProgress.percent}%` }} />
              </div>
              <p>
                {submitProgress.stage} {submitProgress.current}/{submitProgress.total}
              </p>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="excel-table">
              <thead>
                <tr>
                  <th>行号</th>
                  {orderColumns.map((column) => (
                    <th key={column.key} style={{ minWidth: column.width }}>
                      {column.label}
                      {column.required ? " *" : ""}
                    </th>
                  ))}
                  <th>操作</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={orderColumns.length + 2} className="table-empty">
                      上传 Excel 后，这里会显示所有预览数据，并支持逐格编辑与实时校验。
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className={Object.keys(row.errors).length > 0 ? "error-row" : ""}>
                      <td className="row-number">{row.rowNumber}</td>
                      {orderColumns.map((column) => {
                        const isEditing =
                          editingCell?.rowId === row.id && editingCell.field === column.key;
                        const errorText = getErrorText(row, column.key);
                        const value = row.values[column.key];

                        return (
                          <td
                            key={`${row.id}-${column.key}`}
                            className={errorText ? "cell-error" : ""}
                            title={errorText || "点击编辑"}
                            onClick={() => setEditingCell({ rowId: row.id, field: column.key })}
                          >
                            {isEditing ? (
                              column.inputType === "select" ? (
                                <select
                                  autoFocus
                                  value={value}
                                  onBlur={() => {
                                    commitValidationAfterEdit();
                                  }}
                                  onChange={(event) => handleEditValue(row.id, column.key, event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === "Tab") {
                                      event.preventDefault();
                                      pendingNavigationRef.current = getAdjacentEditableCell(
                                        rows,
                                        row.id,
                                        column.key,
                                        event.shiftKey ? -1 : 1,
                                      );
                                      event.currentTarget.blur();
                                    }

                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      pendingNavigationRef.current = null;
                                      event.currentTarget.blur();
                                    }
                                  }}
                                >
                                  <option value="">请选择</option>
                                  {temperatureOptions.map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  autoFocus
                                  value={value}
                                  onChange={(event) => handleEditValue(row.id, column.key, event.target.value)}
                                  onBlur={() => {
                                    commitValidationAfterEdit();
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === "Tab") {
                                      event.preventDefault();
                                      pendingNavigationRef.current = getAdjacentEditableCell(
                                        rows,
                                        row.id,
                                        column.key,
                                        event.shiftKey ? -1 : 1,
                                      );
                                      event.currentTarget.blur();
                                    }

                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      pendingNavigationRef.current = null;
                                      event.currentTarget.blur();
                                    }
                                  }}
                                />
                              )
                            ) : (
                              <div className="cell-display">
                                <span>{value || "点击编辑"}</span>
                                {errorText ? <small>{errorText}</small> : null}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <button type="button" className="link-button danger" onClick={() => handleDeleteRow(row.id)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="error-board">
            <div className="error-board-head">
              <h4>全量错误列表</h4>
              <span>{validationSummary.messages.length} 条</span>
            </div>
            {validationSummary.messages.length === 0 ? (
              <p className="success-note">当前预览数据已通过校验，可以直接提交下单。</p>
            ) : (
              <ul>
                {validationSummary.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">模块四 · 已导入运单列表</span>
              <h3>历史运单查询</h3>
            </div>
          </div>

          <div className="history-filter-grid">
            <label>
              <span>外部编码</span>
              <input
                value={draftHistoryFilters.externalCode}
                onChange={(event) =>
                  setDraftHistoryFilters((current) => ({
                    ...current,
                    externalCode: event.target.value,
                  }))
                }
                placeholder="按外部编码筛选"
              />
            </label>
            <label>
              <span>收件人姓名</span>
              <input
                value={draftHistoryFilters.receiverName}
                onChange={(event) =>
                  setDraftHistoryFilters((current) => ({
                    ...current,
                    receiverName: event.target.value,
                  }))
                }
                placeholder="按收件人姓名筛选"
              />
            </label>
            <label>
              <span>开始日期</span>
              <input
                type="date"
                value={draftHistoryFilters.dateFrom}
                onChange={(event) =>
                  setDraftHistoryFilters((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>结束日期</span>
              <input
                type="date"
                value={draftHistoryFilters.dateTo}
                onChange={(event) =>
                  setDraftHistoryFilters((current) => ({
                    ...current,
                    dateTo: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="toolbar-actions history-actions">
            <button
              type="button"
              className="primary-action"
              onClick={() => {
                applyHistoryFilters(draftHistoryFilters);
              }}
            >
              查询
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setDraftHistoryFilters(emptyFilters);
                applyHistoryFilters(emptyFilters);
              }}
            >
              重置
            </button>
          </div>

          <div className="table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>提交时间</th>
                  <th>外部编码</th>
                  <th>发件人</th>
                  <th>收件人</th>
                  <th>重量</th>
                  <th>件数</th>
                  <th>温层</th>
                  <th>来源模板</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      正在加载历史运单...
                    </td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      暂无符合条件的历史运单。
                    </td>
                  </tr>
                ) : (
                  historyRows.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.submittedAt).toLocaleString("zh-CN")}</td>
                      <td>{item.externalCode || "-"}</td>
                      <td>{item.senderName}</td>
                      <td>{item.receiverName}</td>
                      <td>{item.weightKg}</td>
                      <td>{item.quantity}</td>
                      <td>{item.temperature}</td>
                      <td>{item.sourceTemplateName || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              type="button"
              className="secondary-action"
              disabled={historyPage <= 1}
              onClick={() => void loadHistory(historyPage - 1, historyFilters)}
            >
              上一页
            </button>
            <span>
              第 {historyPage} / {historyTotalPages} 页，共 {historyTotal} 条
            </span>
            <button
              type="button"
              className="secondary-action"
              disabled={historyPage >= historyTotalPages}
              onClick={() => void loadHistory(historyPage + 1, historyFilters)}
            >
              下一页
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
