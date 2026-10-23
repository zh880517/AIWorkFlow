// 画布右键菜单：创建节点 / 复制 / 粘贴 / 删除。定位用视口坐标（fixed），点外部、Esc、失焦即关闭。
import * as React from 'react';

export interface MenuItem {
  id: string;
  label: string;
  /** 右侧的快捷键 / 位置提示 */
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
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
      {props.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="wf-menu-item"
          data-danger={item.danger === true ? 'true' : 'false'}
          disabled={item.disabled === true}
          onClick={() => {
            if (item.disabled === true) return;
            props.onClose();
            item.onSelect();
          }}
        >
          <span className="wf-menu-label">{item.label}</span>
          {item.hint !== undefined && <span className="wf-menu-hint">{item.hint}</span>}
        </button>
      ))}
    </div>
  );
}
