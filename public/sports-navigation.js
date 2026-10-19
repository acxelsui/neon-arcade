// Keep Sports navigation inside the app; stream frames cannot open ad tabs.
export function sportsPage(value, base, decode = value => value) {
  try {
    const url = new URL(decode(String(value)), base);
    if (url.origin !== 'https://thetvapp.plus' || url.username || url.password) return null;
    return /^\/(?:$|v\d+\/?$|watch\/[\w-]+\/?$|tv-live\/[\w/-]+$)/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

export function protectSportsFrame(frame, tap) {
  frame.element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
  tap(frame.hooks.init.post, ({client, window: win, isTopLevel}) => {
    const decode = value => client.unrewriteUrl(value);
    const page = value => isTopLevel && sportsPage(value, client.url.href, decode);
    client.Proxy('window.open', {apply(context) {
      const url = context.args[0] && page(context.args[0]);
      if (url) frame.go(url);
      context.return(null);
    }});
    const linkClick = event => {
      if (event.type === 'auxclick' && event.button !== 1) return;
      const link = event.target?.closest?.('a[href],area[href]');
      if (!link) return;
      const href = link.getAttribute('scramjet-attr-href') || link.href;
      // Hash controls in embedded players stay native.
      if (link.getAttribute('href')?.startsWith('#')) return;
      event.preventDefault();event.stopImmediatePropagation();
      const url = page(href);
      if (url) frame.go(url);
    };
    win.document.addEventListener('click', linkClick, true);
    win.document.addEventListener('auxclick', linkClick, true);
    // Also constrain script-driven redirects; leave media requests untouched.
    tap(client.hooks.lifecycle.navigate, (_context, props) => {
      let allowed = page(props.url);
      if (!isTopLevel) {
        try { allowed = new URL(decode(props.url), client.url.href).origin === client.url.origin; } catch {}
      }
      if (!allowed) props.url = client.url.href;
    });
  });
}
