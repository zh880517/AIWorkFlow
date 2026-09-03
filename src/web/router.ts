import { useCallback, useEffect, useRef, useState } from 'react';

export interface Route {
  path: string;
  segments: string[];
}

export type Navigate = (to: string, opts?: { replace?: boolean }) => void;

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '');
  const path = raw.split('?')[0] ?? '';
  const clean = path.startsWith('/') ? path : `/${path}`;
  return { path: clean, segments: clean.split('/').filter(Boolean) };
}

export function decodeSeg(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * 极简 hash 路由（本地工具面板够用，不引路由库）。
 * guardRef 由当前视图注册：hash 变化（含浏览器后退）先过 guard，拒绝则把地址弹回原路由。
 */
export function useHashRoute(guardRef: { current: (() => boolean) | null }) {
  const [route, setRoute] = useState<Route>(parse);
  const lastPathRef = useRef(route.path);
  const bypassRef = useRef(false);

  useEffect(() => {
    const onHashChange = (): void => {
      const next = parse();
      if (bypassRef.current) {
        bypassRef.current = false;
      } else {
        const guard = guardRef.current;
        if (guard !== null && !guard()) {
          // 拒绝跳转：弹回原路由（这次回跳经 bypass 放行）
          bypassRef.current = true;
          window.location.hash = lastPathRef.current;
          return;
        }
      }
      lastPathRef.current = next.path;
      setRoute(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [guardRef]);

  const navigate: Navigate = useCallback(
    (to, opts) => {
      const target = to.startsWith('/') ? to : `/${to}`;
      if (parse().path === target) return;
      if (opts?.replace) {
        // replaceState 不触发 hashchange，手动同步路由状态（内部跳转不经过 guard）
        window.history.replaceState(null, '', `#${target}`);
        lastPathRef.current = target;
        setRoute({ path: target, segments: target.split('/').filter(Boolean) });
      } else {
        window.location.hash = target; // 触发 hashchange → guard → setRoute
      }
    },
    [],
  );

  return { route, navigate };
}
