const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export async function submitInquiry(request, env) {
  if (request.method !== 'POST') return json({ error: '请使用提交表单。' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: '请求来源无效。' }, 403);
  if (Number(request.headers.get('Content-Length') || 0) > 16384) return json({ error: '咨询内容过长。' }, 413);
  let data;
  try {
    const body = await request.text();
    if (body.length > 16384) return json({ error: '咨询内容过长。' }, 413);
    data = JSON.parse(body);
  } catch { return json({ error: '提交格式不正确。' }, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: '提交格式不正确。' }, 400);
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  if (!name || name.length > 50) return json({ error: '请填写姓名（最多50字）。' }, 400);
  if (!/^1[3-9]\d{9}$/.test(phone)) return json({ error: '请填写正确的11位手机号码。' }, 400);
  if (!message || message.length > 300) return json({ error: '请填写咨询内容（最多300字）。' }, 400);
  if (typeof data.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.id)) return json({ error: '请刷新页面后重新提交。' }, 400);
  if (!env.DB) return json({ error: '留言服务暂时不可用，请稍后重试。' }, 503);
  try {
    await env.DB.prepare('INSERT OR IGNORE INTO inquiries (id,name,phone,message,source,created_at) VALUES (?,?,?,?,?,?)')
      .bind(data.id, name, phone, message, data.source === 'mobile' ? 'mobile' : 'desktop', new Date().toISOString()).run();
    return json({ ok: true, id: data.id });
  } catch { return json({ error: '留言保存失败，请稍后重试。' }, 503); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try { url.pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad Request', {status:400}); }
    request = new Request(url, request);
    if (url.pathname.startsWith('/api/admin/')) return adminApi(request, env);
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      if (!adminIdentity(request, env)) return loginResponse();
    }
    if (url.pathname.startsWith('/cms/')) return new Response('Not Found', {status:404});
    if (url.pathname.startsWith('/uploads/')) return uploadedMedia(request, env);
    if (url.pathname === '/api/inquiries') return submitInquiry(request, env);
    if (url.pathname.startsWith('/api/')) return json({ error: '未找到该接口。' }, 404);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 });
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return new Response('Bad Request', { status: 400 }); }
    if ((path==='/' || path.startsWith('/mobile/') || /^\/(about|product|news|case|service|contact|consultation)\//.test(path)) && (path.endsWith('/') || path.endsWith('.html'))) {
      const response = await renderPage(request, env, path);
      return response;
    }
    if (!path.split('/').pop().includes('.')) {
      if (!path.endsWith('/')) {
        url.pathname += '/';
        return Response.redirect(url.toString(), 308);
      }
      url.pathname += 'index.html';
    }
    const response = await env.ASSETS.fetch(new Request(url, request));
    if (response.status !== 404) return response;
    const fallback = await env.ASSETS.fetch(new Request(new URL('/404.html', url), request));
    return new Response(fallback.body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
};
import { adminApi, adminIdentity, loginResponse, renderPage, uploadedMedia } from './cms.js';
