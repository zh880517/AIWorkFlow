import { useCallback, useRef } from 'react';
import * as api from './api.js';
import { decodeSeg, useHashRoute } from './router.js';
import { LibraryView } from './views/LibraryView.js';
import { EditorView } from './views/EditorView.js';
import { PreviewView } from './views/PreviewView.js';
import { RunsView } from './views/RunsView.js';

/**
 * 页面结构（hash 路由，本地面板不引路由库）：
 *   #/            流程库（首页：加载 / 新建 / 删除流程）
 *   #/edit/:id    编辑器（画布 + 按需属性面板；id 为 new 表示新草稿）
 *   #/preview/:id Agent 视角预览（只读画布 + 单步下发内容）
 *   #/runs        监控（阶段 4 上线，先占位）
 */
export function App() {
  const guardRef = useRef<(() => boolean) | null>(null);
  const { route, navigate } = useHashRoute(guardRef);
  const registerGuard = useCallback((guard: (() => boolean) | null) => {
    guardRef.current = guard;
  }, []);

  if (!api.hasToken()) {
    return (
      <div className="app notice-page">
        <p>
          URL 缺少访问令牌。请使用服务启动时打印的完整面板地址（形如{' '}
          <code>http://127.0.0.1:4123/?k=…</code>）。
        </p>
      </div>
    );
  }

  const [root, second] = route.segments;
  if (root === undefined) {
    return <LibraryView navigate={navigate} />;
  }
  if (root === 'edit') {
    return <EditorView id={second !== undefined ? decodeSeg(second) : 'new'} navigate={navigate} registerGuard={registerGuard} />;
  }
  if (root === 'preview' && second !== undefined) {
    return <PreviewView id={decodeSeg(second)} navigate={navigate} />;
  }
  if (root === 'runs') {
    return <RunsView navigate={navigate} runId={second !== undefined ? decodeSeg(second) : null} />;
  }
  return (
    <div className="app notice-page">
      <p>
        页面不存在。{' '}
        <button className="btn" onClick={() => navigate('/')}>
          回流程库
        </button>
      </p>
    </div>
  );
}
