(() => {
  'use strict';
  const sitePath=window.donghanPath||(value=>value);
  const localPath=location.pathname.slice((window.DONGHAN_BASE_PATH||'').length);
  const source = window.CMS_PREVIEW_DEVICE || (localPath.startsWith('/mobile') ? 'mobile' : 'desktop');
  const parameters = new URLSearchParams(location.search);
  if (parameters.get('view') === 'desktop') sessionStorage.setItem('kaishan-view', 'desktop');
  if (parameters.get('view') === 'mobile') sessionStorage.setItem('kaishan-view', 'mobile');
  const mapping = window.KAISHAN_ROUTE || {};
  const smallScreen = Math.min(innerWidth, screen.width) <= 767;
  if (!window.CMS_PREVIEW_DEVICE && source === 'desktop' && sessionStorage.getItem('kaishan-view') !== 'desktop' && smallScreen && mapping.mobile) {
    location.replace(sitePath(mapping.mobile) + location.hash);
    return;
  }
  document.addEventListener('DOMContentLoaded', () => {
    const switcher = document.createElement('div');
    switcher.className = 'replica-view-switch';
    const switchLink = document.createElement('a');
    switchLink.textContent = source === 'mobile' ? '电脑版' : '手机版';
    switchLink.href = sitePath(source === 'mobile' ? mapping.desktop || '/' : mapping.mobile || '/mobile/') + '?view=' + (source === 'mobile' ? 'desktop' : 'mobile');
    switcher.appendChild(switchLink);
    const footer = document.querySelector(source === 'mobile' ? '#copyright' : '.copyright .w1200');
    if (footer) footer.appendChild(switcher);
    document.querySelectorAll('a[target="_blank"]').forEach(a => a.rel = 'noopener noreferrer');
    document.querySelectorAll('.banner .tip span').forEach((span, i) => {
      span.setAttribute('role', 'button'); span.tabIndex = 0; span.setAttribute('aria-label', '切换至第' + (i + 1) + '张轮播图');
      span.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); span.click(); } });
    });
    const nav = source === 'mobile' ? document.querySelector('#nav') : null;
    if (nav) {
      nav.tabIndex = 0; nav.setAttribute('role', 'button'); nav.setAttribute('aria-label', '打开或关闭导航');
      nav.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav.click(); } });
    }
    document.querySelectorAll('.form_book').forEach(form => {
      const name = form.querySelector('[name="name"]');
      const phone = form.querySelector('[name="mycall"]');
      const message = form.querySelector('[name="saytext"]');
      name.required = phone.required = message.required = true;
      name.maxLength = 50; phone.type = 'tel'; phone.pattern = '1[3-9][0-9]{9}'; phone.inputMode = 'tel'; message.maxLength = 300;
      name.autocomplete = 'name'; phone.autocomplete = 'tel-national';
      name.setAttribute('aria-label', '姓名'); phone.setAttribute('aria-label', '手机号码'); message.setAttribute('aria-label', '咨询内容');
      const button = form.querySelector('[type="submit"]');
      const status = document.createElement('p'); status.className = 'replica-form-status'; status.setAttribute('role', 'status');
      const hint = document.createElement('p'); hint.className = 'replica-form-hint'; hint.textContent = '咨询信息将保存到此复刻站。';
      form.append(hint, status);
      let submissionId;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!form.reportValidity() || button.disabled) return;
        submissionId ||= crypto.randomUUID();
        button.disabled = true; const label = button.value; button.value = '提交中…'; status.textContent = '';
        try {
          const response = await fetch(sitePath('/api/inquiries'), { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id: submissionId, name: name.value, phone: phone.value, message: message.value, source }) });
          const result = await response.json();
          if (!response.ok || !result.ok) throw new Error(result.error || '提交失败，请稍后重试。');
          status.textContent = '您的咨询已保存到此站点，感谢留言。'; status.style.color = '#08723b'; form.reset(); submissionId = undefined;
        } catch (error) { status.textContent = error.message || '网络异常，请稍后重试。'; status.style.color = '#c62828'; }
        finally { button.disabled = false; button.value = label; }
      });
      [name, phone, message].forEach(field => field.addEventListener('input', () => { submissionId = undefined; }));
    });
    const hit = document.getElementById('hits');
    if (hit) {
      let count = 1;
      try { const key = 'kaishan-visits:' + (mapping.desktop || location.pathname); count = Number(localStorage.getItem(key) || 0) + 1; localStorage.setItem(key, count); } catch {}
      hit.textContent = count; hit.title = '此浏览器的本地浏览次数';
    }
    // Legacy Baidu share controls are replaced with user-initiated native sharing.
    document.querySelectorAll('.bdsharebuttonbox a').forEach(a => {
      a.href = '#';
      a.addEventListener('click', async e => {
        e.preventDefault();
        try {
          if (navigator.share) await navigator.share({title: document.title, url: location.href});
          else { await navigator.clipboard.writeText(location.href); alert('页面链接已复制。'); }
        } catch {}
      });
    });
  });
})();
