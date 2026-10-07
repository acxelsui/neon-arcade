// Install only on Movies: the embedded players must not open advertising tabs.
// Scramjet's init hook also covers nested players before their scripts execute.
export function moviePage(value, base, decode = value => value) {
  try {
    const url = new URL(decode(String(value)), base);
    if (url.origin !== 'https://gaiaflix.live' || url.username || url.password || url.pathname !== '/') return null;
    if (url.hash && !/^#\/(?:$|(?:movies|series|anime|cartoons|sports|explore|favorites)(?:[/?]|$)|(?:watch|detail)\/)/.test(url.hash)) return null;
    return url.href;
  } catch { return null; }
}

export function protectMoviesFrame(frame, tap, runtime = globalThis.$scramjet) {
  // Browser enforcement is the fallback for native links and unproxied children.
  // Keep scripts, storage, forms, media and fullscreen; omit pop-up/top navigation.
  frame.element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-downloads allow-presentation');
  // Gaiaflix's promotional tag adds a click-catching overlay, even when its
  // new tab is blocked. Suppress that tag only in Movies, before it executes.
  tap(frame.hooks.fetch.request, ({parsed}, props) => {
    if (parsed.url.hostname === 'llvpn.com' && parsed.url.pathname === '/tag.min.js') {
      props.earlyResponse = runtime.BareResponse.fromNativeResponse(new Response('', {
        headers: {'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}
      }));
    }
  });
  tap(frame.hooks.init.post, ({client, window: win, isTopLevel}) => {
    const decode = value => client.unrewriteUrl(value);
    const navigate = value => {
      const url = isTopLevel && moviePage(value, client.url.href, decode);
      if (url) client.url = url;
      return url;
    };
    client.Proxy('window.open', {apply(context) {
      // Empty/about:blank windows are often populated by an ad after opening.
      if (context.args[0]) navigate(context.args[0]);
      context.return(null);
    }});
    const linkClick = event => {
      const link = event.target?.closest?.('a[href],area[href]');
      if (!link) return;
      const target = (link.getAttribute('target') || win.document.querySelector('base[target]')?.getAttribute('target') || '').toLowerCase();
      const escapes = (target && target !== '_self') || event.type === 'auxclick' && event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey;
      const href = link.getAttribute('scramjet-attr-href') || link.href;
      const movie = isTopLevel && moviePage(href, client.url.href, decode);
      if (!escapes && !movie) return;
      if (event.type === 'auxclick' && event.button !== 1) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (movie) navigate(href);
    };
    win.document.addEventListener('click', linkClick, true);
    win.document.addEventListener('auxclick', linkClick, true);
  });
}
