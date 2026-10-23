// 画布右键菜单：支持一层子菜单（创建节点）。定位用视口坐标（fixed），点外部、Esc、失焦即关闭。
import * as React from 'react';

export interface MenuItem {
  id: string;
  label: string;
  /** 右侧的快捷键 / 位置提示 */
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  /** 叶子项的点击动作；有 children 时忽略 */
  onSelect?: () => void;
  /** 子菜单项：悬停 / 点击展开 */
  children?: MenuItem[];
}

export interface ContextMenuProps {
  x: number;
  y: number;
  heading?: string;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu(props: ContextMenuProps): React.ReactElement {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number }>({ left: props.x, top: props.y });
  const [openSub, setOpenSub] = React.useState<string | null>(null);

  // 先渲染再量尺寸，贴边时翻到视口内，避免菜单被裁掉
  React.useLayoutEffect(() => {
    const element = rootRef.current;
    if (element === null) return;
    const rect = element.getBoundingClientRect();
    const left = Math.max(8, Math.min(props.x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(props.y, window.innerHeight - rect.height - 8));
    setPos({ left, top });
  }, [props.x, props.y, props.items.length]);

  React.useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const element = rootRef.current;
      if (element !== null && event.target instanceof Node && element.contains(event.target)) return;
      props.onClose();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        props.onClose();
      }
    };
    const onBlur = (): void => props.onClose();
    // 冒泡阶段：菜单自身的 pointerdown 已 stopPropagation，点到菜单项不会先被关掉
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
    };
  }, [props.onClose]);

  const pick = (item: MenuItem): void => {
    if (item.disabled === true || item.children !== undefined) return;
    props.onClose();
    item.onSelect?.();
  };

  return (
    <div
      ref={rootRef}
      className="wf-menu"
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      {props.heading !== undefined && <div className="wf-menu-head">{props.heading}</div>}
      {props.items.map((item) =>
        item.children === undefined ? (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className="wf-menu-item"
            data-danger={item.danger === true ? 'true' : 'false'}
            disabled={item.disabled === true}
            onClick={() => pick(item)}
          >
            <span className="wf-menu-label">{item.label}</span>
            {item.hint !== undefined && <span className="wf-menu-hint">{item.hint}</span>}
          </button>
        ) : (
          <div
            key={item.id}
            className="wf-menu-group"
            onMouseEnter={() => setOpenSub(item.id)}
            onMouseLeave={() => setOpenSub((current) => (current === item.id ? null : current))}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openSub === item.id}
              className="wf-menu-item"
              disabled={item.disabled === true}
              onClick={() => setOpenSub((current) => (current === item.id ? null : item.id))}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  setOpenSub(item.id);
                } else if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  setOpenSub(null);
                }
              }}
            >
              <span className="wf-menu-label">{item.label}</span>
              {item.hint !== undefined && <span className="wf-menu-hint">{item.hint}</span>}
              <span className="wf-menu-caret" aria-hidden="true">
                ›
              </span>
            </button>
            {openSub === item.id && (
              <SubMenu items={item.children} onPick={pick} />
            )}
          </div>
        ),
      )}
    </div>
  );
}

/** 子菜单：默认贴父项右侧，靠右边缘时翻到左侧 */
function SubMenu({ items, onPick }: { items: MenuItem[]; onPick: (item: MenuItem) => void }): React.ReactElement {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [side, setSide] = React.useState<'right' | 'left'>('right');
  const [top, setTop] = React.useState(-5);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const rect = element.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) setSide('left');
    // 贴底时整体上移，别让最后几项被视口裁掉
    const overflowBottom = rect.bottom - (window.innerHeight - 8);
    if (overflowBottom > 0) setTop(-5 - overflowBottom);
  }, []);

  return (
    <div ref={ref} className="wf-menu wf-submenu" data-side={side} style={{ top }} role="menu">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="wf-menu-item"
          data-danger={item.danger === true ? 'true' : 'false'}
          disabled={item.disabled === true}
          onClick={() => onPick(item)}
        >
          <span className="wf-menu-label">{item.label}</span>
          {item.hint !== undefined && <span className="wf-menu-hint">{item.hint}</span>}
        </button>
      ))}
    </div>
  );
}
