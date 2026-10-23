// 把第三方预编译包（React Flow）的 `react/jsx-runtime` 请求改接到宿主 React 上。
//
// 原因：宿主渲染器用的是它自己那一份 React；包内自带的 jsx-runtime 属于另一个 React 版本时，
// 造出来的元素 $$typeof 与渲染器不匹配，React 会以 "Objects are not valid as a React child"（#31）拒绝。
// 这里用宿主 `React.createElement` 造元素，保证与渲染器同一份身份。
import * as React from 'react';

type Props = Record<string, unknown> & { children?: unknown };

export const Fragment = React.Fragment;

export function jsx(type: unknown, props: Props, key?: string): React.ReactElement {
  return React.createElement(
    type as never,
    key === undefined ? props : { ...props, key },
    props.children as React.ReactNode,
  );
}

export const jsxs = jsx;
export const jsxDEV = jsx;
