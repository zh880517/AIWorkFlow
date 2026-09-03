import { useCallback, useEffect, useState } from 'react';
import * as api from '../api.js';
import { PageShell } from '../components/PageShell.js';
import type { Navigate } from '../router.js';

export interface LibraryViewProps {
  navigate: Navigate;
}

/** 首页：流程库。流程的加载 / 新建 / 删除都从这里进，编辑器页不再堆流程列表。 */
export function LibraryView({ navigate }: LibraryViewProps) {
  const [list, setList] = useState<api.FlowMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setErr(null);
    setList(null);
    try {
      setList(await api.listFlows());
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function remove(item: api.FlowMeta): Promise<void> {
    if (!window.confirm(`删除流程「${item.name}」？不可恢复。`)) return;
    try {
      await api.deleteFlow(item.id);
      setList((cur) => (cur === null ? null : cur.filter((f) => f.id !== item.id)));
    } catch (e) {
      window.alert(`删除失败：${(e as Error).message}`);
    }
  }

  return (
    <PageShell active="flows" navigate={navigate}>
      <div className="page library">
        <div className="page-head">
          <div>
            <h1>流程库</h1>
            <p className="page-sub">画一张流程图，Agent 按步领取指令、做完回报再走下一步。</p>
          </div>
          <button className="btn primary" onClick={() => navigate('/edit/new')}>
            新建流程
          </button>
        </div>

        {err !== null ? (
          <div className="empty-state">
            <p>无法连接服务：{err}</p>
            <button className="btn" onClick={() => void refresh()}>
              重试
            </button>
          </div>
        ) : list === null ? (
          <div className="skeleton-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-row" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <p>还没有流程。点右上角「新建流程」画第一张图。</p>
          </div>
        ) : (
          <div className="flow-cards">
            {list.map((item) => (
              <div key={item.id} className="flow-card">
                <button
                  className="flow-card-main"
                  onClick={() => navigate(`/edit/${encodeURIComponent(item.id)}`)}
                >
                  <span className="flow-card-name">{item.name}</span>
                  <span className="flow-card-meta">{fmtTime(item.updatedAt)}</span>
                </button>
                <button className="flow-card-del" title="删除流程" onClick={() => void remove(item)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

function fmtTime(iso: string): string {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString();
}
