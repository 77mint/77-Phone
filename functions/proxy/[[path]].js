export async function onRequest(context) {
  const { request, params } = context;

  // 处理浏览器跨域预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  const rawPath = Array.isArray(params.path)
    ? params.path.join('/')
    : String(params.path || '');

  const inUrl = new URL(request.url);
  const targetUrl = `http://3.143.231.12:3000/${rawPath}${inUrl.search}`;

  const headers = new Headers();
  for (const [k, v] of request.headers.entries()) {
    const lk = k.toLowerCase();
    if (
      lk === 'host' ||
      lk === 'origin' ||
      lk === 'referer' ||
      lk.startsWith('cf-') ||
      lk.startsWith('x-forwarded-')
    ) {
      continue;
    }
    headers.set(k, v);
  }

  const init = {
    method: request.method,
    headers,
    redirect: 'follow'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const outHeaders = new Headers(upstream.headers);
    outHeaders.set('Access-Control-Allow-Origin', '*');
    outHeaders.set('Access-Control-Allow-Headers', '*');
    outHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: '代理连接 VPS 失败: ' + (err && err.message ? err.message : String(err)) } }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}
