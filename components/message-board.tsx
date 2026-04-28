"use client";

import { useEffect, useState } from "react";
import type { Message, MessageInput } from "@/lib/types";

const emptyForm: MessageInput = {
  name: "",
  content: "",
};

type ApiSuccess<T> = {
  data: T;
};

type ApiError = {
  error?: string;
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function MessageBoard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [form, setForm] = useState<MessageInput>(emptyForm);
  const [editForm, setEditForm] = useState<MessageInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestMessages(signal?: AbortSignal) {
    const response = await fetch("/api/messages", {
      cache: "no-store",
      signal,
    });
    const payload = await readJson<ApiSuccess<Message[]> & ApiError>(response);

    if (!response.ok) {
      throw new Error(payload.error ?? "加载留言失败。");
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
        loadError instanceof Error ? loadError.message : "加载留言失败。";
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
          loadError instanceof Error ? loadError.message : "加载留言失败。";
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

  function startEditing(message: Message) {
    setEditingId(message.id);
    setEditForm({
      name: message.name,
      content: message.content,
    });
  }

  function stopEditing() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

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
        throw new Error(payload.error ?? "创建留言失败。");
      }

      setForm(emptyForm);
      await loadMessages();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "创建留言失败。";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(id: string) {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/messages/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editForm),
      });
      const payload = await readJson<ApiSuccess<Message> & ApiError>(response);

      if (!response.ok) {
        throw new Error(payload.error ?? "更新留言失败。");
      }

      stopEditing();
      await loadMessages();
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "更新留言失败。";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("确定删除这条留言吗？")) {
      return;
    }

    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/messages/${id}`, {
        method: "DELETE",
      });
      const payload = await readJson<ApiSuccess<{ deleted: true }> & ApiError>(
        response,
      );

      if (!response.ok) {
        throw new Error(payload.error ?? "删除留言失败。");
      }

      if (editingId === id) {
        stopEditing();
      }

      await loadMessages();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "删除留言失败。";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="board-panel">
      <div className="board-header">
        <div>
          <h2>留言管理面板</h2>
          <p>支持新增、查看、编辑、删除。接口全部走 Next.js 内置 API。</p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={() => void loadMessages()}
          disabled={loading}
        >
          {loading ? "刷新中..." : "刷新列表"}
        </button>
      </div>

      {error ? (
        <div className="status-banner error">
          {error}
          <br />
          如果你刚部署到 Vercel，请先添加 Postgres 集成并执行 README 里的初始化脚本。
        </div>
      ) : null}

      <div className="panel-grid">
        <div className="form-card">
          <h3 className="section-title">新增留言</h3>
          <p className="section-subtitle">
            适合直接作为后台管理示例，也可以继续扩展成评论区、工单板或客户反馈页。
          </p>

          <form className="message-form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="name">昵称</label>
              <input
                id="name"
                name="name"
                maxLength={80}
                placeholder="例如：Alice"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label htmlFor="content">留言内容</label>
              <textarea
                id="content"
                name="content"
                maxLength={500}
                placeholder="写点什么吧..."
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
              />
            </div>

            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? "提交中..." : "新增留言"}
            </button>
          </form>

          <p className="helper-text">
            表单校验规则：昵称 1-80 字，留言 1-500 字，后端会再次校验。
          </p>
        </div>

        <div className="list-card">
          <h3 className="section-title">留言列表</h3>
          <p className="section-subtitle">
            当前共 {messages.length} 条，按创建时间倒序展示。
          </p>

          <div className="message-list" style={{ marginTop: "18px" }}>
            {loading ? (
              <div className="status-banner info">正在加载留言数据...</div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                还没有留言。
                <br />
                先在左侧提交第一条内容吧。
              </div>
            ) : (
              messages.map((message) => {
                const isEditing = editingId === message.id;
                const isBusy = busyId === message.id;

                return (
                  <article
                    className={`message-item${isEditing ? " editing" : ""}`}
                    key={message.id}
                  >
                    <div className="message-meta">
                      <div>
                        <strong>{message.name}</strong>
                        <time dateTime={message.createdAt}>
                          创建于 {formatTimestamp(message.createdAt)}
                        </time>
                      </div>

                      {message.updatedAt !== message.createdAt ? (
                        <time dateTime={message.updatedAt}>
                          更新于 {formatTimestamp(message.updatedAt)}
                        </time>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="edit-form">
                        <div className="field">
                          <label htmlFor={`edit-name-${message.id}`}>昵称</label>
                          <input
                            id={`edit-name-${message.id}`}
                            value={editForm.name}
                            maxLength={80}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`edit-content-${message.id}`}>
                            留言内容
                          </label>
                          <textarea
                            id={`edit-content-${message.id}`}
                            value={editForm.content}
                            maxLength={500}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                content: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="edit-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => void handleUpdate(message.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? "保存中..." : "保存修改"}
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={stopEditing}
                            disabled={isBusy}
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="message-content">{message.content}</p>

                        <div className="message-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => startEditing(message)}
                            disabled={isBusy}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => void handleDelete(message.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? "删除中..." : "删除"}
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
