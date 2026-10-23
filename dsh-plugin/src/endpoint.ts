// 数据端点解析：页面在 http(s) 上时用同源相对路径；桌面壳 file:// 渲染器借 transport 报出的 HTTP 源。
export function resolveEndpoint(relativePath: string): URL {
  const protocol = globalThis.location?.protocol;
  if (protocol === 'http:' || protocol === 'https:') {
    return new URL(relativePath, document.baseURI);
  }
  const transport = (globalThis as { __DSH_TRANSPORT__?: { streamBaseUrl?: unknown } }).__DSH_TRANSPORT__;
  const raw = transport?.streamBaseUrl;
  if (typeof raw === 'string' && raw !== '') {
    try {
      const base = new URL(raw);
      if (base.protocol === 'ws:') base.protocol = 'http:';
      else if (base.protocol === 'wss:') base.protocol = 'https:';
      if (base.protocol === 'http:' || base.protocol === 'https:') {
        return new URL(relativePath, base);
      }
    } catch {
      // 落到相对路径再试一次
    }
  }
  return new URL(relativePath, document.baseURI);
}
