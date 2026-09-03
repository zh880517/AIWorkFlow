import type { ReactNode } from 'react';
import type { Navigate } from '../router.js';

export interface PageShellProps {
  active: 'flows' | 'runs';
  navigate: Navigate;
  children: ReactNode;
}

/** 流程库 / 监控等整页视图的外壳：品牌 + 一级导航 */
export function PageShell({ active, navigate, children }: PageShellProps) {
  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')}>
          aiworkflow
        </button>
        <nav className="nav">
          <button className={`nav-item ${active === 'flows' ? 'active' : ''}`} onClick={() => navigate('/')}>
            流程库
          </button>
          <button className={`nav-item ${active === 'runs' ? 'active' : ''}`} onClick={() => navigate('/runs')}>
            监控
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}
