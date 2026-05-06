"use client";

import { useEffect, useState } from "react";
import type { Message, MessageInput } from "@/lib/types";

const emptyForm: MessageInput = {
  name: "",
  content: "",
};

const menuGroups = [
  {
    title: "总览",
    items: [
      { label: "首页" },
      { label: "运营运输管理" },
      {
        label: "经营管理中心",
        active: true,
        children: ["网点管理", "客户管理", "经营分析"],
      },
    ],
  },
  {
    title: "业务中心",
    items: [{ label: "运营操作管理" }, { label: "财务管理" }, { label: "基础管理" }],
  },
  {
    title: "监控分析",
    items: [{ label: "天枢设备监控" }, { label: "服务质量" }, { label: "天易大数据平台" }],
  },
];

const branchTypes = ["一级网点", "二级网点", "三级网点", "直营服务部"];
const serviceTypes = ["寄件服务", "冷链运输", "仓配服务", "派件服务"];
const organizationTypes = ["市场部", "承包区", "一级网点", "二级网点"];
const anomalyStatuses = ["正常", "筹备期", "观察中"];
const ownerOrganizations = [
  "上海市场部",
  "杭州分拨中心",
  "南京分拨中心",
  "呼和浩特事业网点",
  "郑州分拨中心",
  "厦门分拨中心",
];
const hubCenters = [
  "上海分拨中心",
  "杭州分拨中心",
  "南京分拨中心",
  "郑州分拨中心",
  "长沙分拨中心",
  "厦门分拨中心",
];
const provinces = ["上海市", "浙江省", "江苏省", "河南省", "福建省", "内蒙古"];
const departments = ["市场运营", "直营网点", "冷链车队", "直营网格", "客服中心"];

type ApiSuccess<T> = {
  data: T;
};

type ApiError = {
  error?: string;
};

type QueryFilters = {
  code: string;
  name: string;
  status: string;
  anomaly: string;
  serviceType: string;
  owner: string;
};

type PanelMode = "create" | "edit" | "view" | null;

type BoardRow = {
  id: string;
  code: string;
  name: string;
  branchType: string;
  serviceType: string;
  organizationType: string;
  status: string;
  anomalyStatus: string;
  ownerOrganization: string;
  hubCenter: string;
  province: string;
  department: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

const initialFilters: QueryFilters = {
  code: "",
  name: "",
  status: "",
  anomaly: "",
  serviceType: "",
  owner: "",
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function deriveRow(message: Message, index: number): BoardRow {
  const cleanedId = message.id.replace(/-/g, "");
  const code = cleanedId.slice(0, 6).padEnd(6, `${(index + 3) % 10}`);
  const status = index % 9 === 0 ? "筹备中" : "正常";
  const anomalyStatus = anomalyStatuses[index % anomalyStatuses.length];

  return {
    id: message.id,
    code,
    name: message.name,
    branchType: branchTypes[index % branchTypes.length],
    serviceType: serviceTypes[index % serviceTypes.length],
    organizationType: organizationTypes[index % organizationTypes.length],
    status,
    anomalyStatus,
    ownerOrganization: ownerOrganizations[index % ownerOrganizations.length],
    hubCenter: hubCenters[index % hubCenters.length],
    province: provinces[index % provinces.length],
    department: departments[index % departments.length],
    content: message.content,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function MessageBoard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<QueryFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<QueryFilters>(initialFilters);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState<MessageInput>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function requestMessages(signal?: AbortSignal) {
    const response = await fetch("/api/messages", {
      cache: "no-store",
      signal,
    });
    const payload = await readJson<ApiSuccess<Message[]> & ApiError>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? "加载列表失败，请稍后再试。");
    }

    return payload.data;
  }

  async function loadMessages() {
    setLoading(true);
    setError(null);

    try {
      const data = await requestMessages();
      setMessages(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "加载列表失败，请稍后再试。";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    async function bootstrap() {
      try {
        const data = await requestMessages(controller.signal);
        setMessages(data);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        const message =
          loadError instanceof Error ? loadError.message : "加载列表失败，请稍后再试。";
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      controller.abort();
    };
  }, []);

  const rows = messages.map(deriveRow);
  const activeRow = activeId ? rows.find((row) => row.id === activeId) ?? null : null;

  const filteredRows = rows.filter((row) => {
    return (
      (!filters.code || row.code.includes(filters.code.trim())) &&
      (!filters.name || row.name.includes(filters.name.trim())) &&
      (!filters.status || row.status === filters.status) &&
      (!filters.anomaly || row.anomalyStatus === filters.anomaly) &&
      (!filters.serviceType || row.serviceType === filters.serviceType) &&
      (!filters.owner || row.ownerOrganization === filters.owner)
    );
  });

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const allVisibleSelected =
    pagedRows.length > 0 && pagedRows.every((row) => selectedIds.includes(row.id));

  function openCreatePanel() {
    setPanelMode("create");
    setActiveId(null);
    setForm(emptyForm);
    setNotice(null);
  }

  function openEditPanel(row: BoardRow) {
    setPanelMode("edit");
    setActiveId(row.id);
    setForm({
      name: row.name,
      content: row.content,
    });
    setNotice(null);
  }

  function openViewPanel(row: BoardRow) {
    setPanelMode("view");
    setActiveId(row.id);
    setNotice(null);
  }

  function closePanel() {
    setPanelMode(null);
    setActiveId(null);
    setForm(emptyForm);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setPage(1);
  }

  function resetFilters() {
    setDraftFilters(initialFilters);
    setFilters(initialFilters);
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !pagedRows.some((row) => row.id === id)),
      );
      return;
    }

    setSelectedIds((current) => {
      const merged = [...current];

      for (const row of pagedRows) {
        if (!merged.includes(row.id)) {
          merged.push(row.id);
        }
      }

      return merged;
    });
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = await readJson<ApiSuccess<Message> & ApiError>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "新增网点失败。");
      }

      setForm(emptyForm);
      setNotice("新增网点成功，列表已刷新。");
      await loadMessages();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "新增网点失败。";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/messages/${activeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const payload = await readJson<ApiSuccess<Message> & ApiError>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "保存修改失败。");
      }

      setNotice("修改已保存。");
      await loadMessages();
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "保存修改失败。";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除当前网点记录吗？")) {
      return;
    }

    setBusyId(id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/messages/${id}`, {
        method: "DELETE",
      });
      const payload = await readJson<ApiSuccess<{ deleted: true }> & ApiError>(
        response,
      );

      if (!response.ok) {
        throw new Error(payload.error ?? "删除记录失败。");
      }

      setSelectedIds((current) => current.filter((item) => item !== id));

      if (activeId === id) {
        closePanel();
      }

      setNotice("记录已删除。");
      await loadMessages();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "删除记录失败。";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) {
      setNotice("请先勾选需要删除的记录。");
      return;
    }

    if (!window.confirm(`确定删除选中的 ${selectedIds.length} 条记录吗？`)) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      for (const id of selectedIds) {
        const response = await fetch(`/api/messages/${id}`, {
          method: "DELETE",
        });
        const payload = await readJson<ApiSuccess<{ deleted: true }> & ApiError>(
          response,
        );

        if (!response.ok) {
          throw new Error(payload.error ?? "批量删除失败。");
        }
      }

      setSelectedIds([]);
      setNotice("批量删除完成。");
      await loadMessages();
    } catch (batchError) {
      const message =
        batchError instanceof Error ? batchError.message : "批量删除失败。";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function renderPageNumbers() {
    const pages: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);

    for (let value = start; value <= end; value += 1) {
      pages.push(value);
    }

    return pages;
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">ZT</div>
          <div>
            <strong>中通冷链</strong>
            <span>ZTO COLD CHAIN</span>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-title">总部</div>
          <div className="sidebar-search">
            <input type="text" placeholder="输入菜单名称" />
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuGroups.map((group) => (
            <div className="menu-group" key={group.title}>
              <p>{group.title}</p>
              {group.items.map((item) => (
                <div key={item.label} className="menu-entry">
                  <button
                    type="button"
                    className={`menu-item${item.active ? " active" : ""}`}
                  >
                    <span className="menu-dot" />
                    {item.label}
                  </button>

                  {item.children ? (
                    <div className="submenu-list">
                      {item.children.map((child, index) => (
                        <button
                          key={child}
                          type="button"
                          className={`submenu-item${index === 0 ? " active" : ""}`}
                        >
                          {child}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>预发环境</span>
          <span className="toggle-pill">
            <span className="toggle-knob" />
          </span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-tabs">
            <span className="topbar-chip active">冷链快运</span>
            <span className="topbar-chip">冷链智运</span>
            <span className="topbar-chip">冷链云仓</span>
            <span className="topbar-chip">更多租户...</span>
          </div>

          <div className="topbar-actions">
            <span>返回旧版</span>
            <span>快件跟踪</span>
            <span>待办</span>
            <span>消息</span>
            <span>工单</span>
          </div>
        </header>

        <div className="content-shell">
          <div className="content-header">
            <div>
              <p className="breadcrumb">经营管理中心 / 网点管理</p>
              <h1>新增业务网点</h1>
            </div>

            <div className="content-tools">
              <button type="button" className="ghost-action" onClick={() => void loadMessages()}>
                {loading ? "刷新中..." : "刷新"}
              </button>
              <button type="button" className="ghost-action">
                全屏
              </button>
            </div>
          </div>

          {(error || notice) && (
            <div className={`alert-banner${error ? " error" : ""}`}>
              {error ?? notice}
            </div>
          )}

          <section className="query-panel">
            <div className="query-grid">
              <label className="query-field">
                <span>机构编号</span>
                <input
                  value={draftFilters.code}
                  placeholder="输入机构编号"
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="query-field">
                <span>机构名称</span>
                <input
                  value={draftFilters.name}
                  placeholder="输入机构名称"
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="query-field">
                <span>所属机构</span>
                <select
                  value={draftFilters.owner}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      owner: event.target.value,
                    }))
                  }
                >
                  <option value="">请选择</option>
                  {ownerOrganizations.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="query-field">
                <span>机构状态</span>
                <select
                  value={draftFilters.status}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">请选择</option>
                  <option value="正常">正常</option>
                  <option value="筹备中">筹备中</option>
                </select>
              </label>

              <label className="query-field">
                <span>服务类型</span>
                <select
                  value={draftFilters.serviceType}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      serviceType: event.target.value,
                    }))
                  }
                >
                  <option value="">请选择</option>
                  {serviceTypes.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="query-field">
                <span>机构异常状态</span>
                <select
                  value={draftFilters.anomaly}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      anomaly: event.target.value,
                    }))
                  }
                >
                  <option value="">请选择</option>
                  {anomalyStatuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="query-actions">
              <button type="button" className="primary-action" onClick={applyFilters}>
                查询
              </button>
              <button type="button" className="secondary-action" onClick={resetFilters}>
                重置
              </button>
            </div>
          </section>

          <section className="table-panel">
            <div className="table-toolbar">
              <div className="toolbar-left">
                <button type="button" className="primary-action" onClick={openCreatePanel}>
                  新增
                </button>
                <button type="button" className="secondary-action" onClick={handleBatchDelete}>
                  删除选中
                </button>
                <button type="button" className="light-action">
                  导出
                </button>
              </div>

              <div className="toolbar-right">
                <span>共 {filteredRows.length} 条</span>
                <span>当前选中 {selectedIds.length} 条</span>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label="全选"
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>机构编号</th>
                    <th>机构名称</th>
                    <th>机构类型</th>
                    <th>服务类型</th>
                    <th>机构性质</th>
                    <th>机构状态</th>
                    <th>异常状态</th>
                    <th>所属机构</th>
                    <th>首分拨中心</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="table-empty">
                        正在加载网点数据...
                      </td>
                    </tr>
                  ) : pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="table-empty">
                        没有匹配结果，试试调整筛选条件。
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map((row) => (
                      <tr key={row.id} className={selectedIds.includes(row.id) ? "selected" : ""}>
                        <td>
                          <input
                            aria-label={`选择 ${row.name}`}
                            type="checkbox"
                            checked={selectedIds.includes(row.id)}
                            onChange={() => toggleSelect(row.id)}
                          />
                        </td>
                        <td>{row.code}</td>
                        <td>{row.name}</td>
                        <td>{row.branchType}</td>
                        <td>{row.serviceType}</td>
                        <td>{row.organizationType}</td>
                        <td>
                          <span className={`status-tag${row.status === "正常" ? "" : " warning"}`}>
                            {row.status}
                          </span>
                        </td>
                        <td>{row.anomalyStatus}</td>
                        <td>{row.ownerOrganization}</td>
                        <td>{row.hubCenter}</td>
                        <td className="content-cell">{row.content}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" onClick={() => openEditPanel(row)}>
                              编辑
                            </button>
                            <button type="button" onClick={() => openViewPanel(row)}>
                              详情
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(row.id)}
                              disabled={busyId === row.id}
                            >
                              {busyId === row.id ? "删除中..." : "删除"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <span>
                第 {currentPage} / {totalPages} 页
              </span>

              <div className="pagination">
                <button
                  type="button"
                  className="page-button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </button>

                {renderPageNumbers().map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`page-button${value === currentPage ? " active" : ""}`}
                    onClick={() => setPage(value)}
                  >
                    {value}
                  </button>
                ))}

                <button
                  type="button"
                  className="page-button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>

      {panelMode ? (
        <aside className="detail-panel">
          <div className="detail-header">
            <div>
              <p className="detail-eyebrow">业务网点操作台</p>
              <h2>
                {panelMode === "create"
                  ? "新增网点"
                  : panelMode === "edit"
                    ? "编辑网点"
                    : "网点详情"}
              </h2>
            </div>

            <button type="button" className="detail-close" onClick={closePanel}>
              关闭
            </button>
          </div>

          {panelMode === "view" && activeRow ? (
            <div className="detail-body">
              <div className="detail-grid">
                <div>
                  <span>机构编号</span>
                  <strong>{activeRow.code}</strong>
                </div>
                <div>
                  <span>机构名称</span>
                  <strong>{activeRow.name}</strong>
                </div>
                <div>
                  <span>所属机构</span>
                  <strong>{activeRow.ownerOrganization}</strong>
                </div>
                <div>
                  <span>省份</span>
                  <strong>{activeRow.province}</strong>
                </div>
                <div>
                  <span>管理部门</span>
                  <strong>{activeRow.department}</strong>
                </div>
                <div>
                  <span>最后更新</span>
                  <strong>{formatTimestamp(activeRow.updatedAt)}</strong>
                </div>
              </div>

              <div className="detail-note">
                <span>业务说明</span>
                <p>{activeRow.content}</p>
              </div>
            </div>
          ) : (
            <form
              className="detail-form"
              onSubmit={panelMode === "create" ? handleCreate : handleUpdate}
            >
              <label className="detail-field">
                <span>机构名称</span>
                <input
                  maxLength={80}
                  placeholder="请输入机构名称"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="detail-field">
                <span>业务说明</span>
                <textarea
                  maxLength={500}
                  placeholder="请输入业务说明、管理备注或留言内容"
                  value={form.content}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="form-tip">
                保存后会同步更新列表。当前版本仍然使用原有 API 与数据库结构。
              </div>

              <div className="detail-actions">
                <button type="submit" className="primary-action" disabled={submitting}>
                  {submitting
                    ? "提交中..."
                    : panelMode === "create"
                      ? "确认新增"
                      : "保存修改"}
                </button>
                <button type="button" className="secondary-action" onClick={closePanel}>
                  取消
                </button>
              </div>
            </form>
          )}
        </aside>
      ) : null}
    </main>
  );
}
