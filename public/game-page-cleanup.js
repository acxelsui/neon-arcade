// Remove the catalog distributor's repeated advertising wrapper, not game code
// or game SDKs that may be needed to start a runtime.
export function cleanBundledGamePage(source){
 return source
  .replace(/<script\b[^>]*\bsrc\s*=\s*(["'])https:\/\/(?:www\.googletagmanager\.com\/gtag\/js|cdn\.r9x\.in\/)[^"']*\1[^>]*>\s*<\/script>/gi,'')
  .replace(/<script>\(function\(ykJYJgqRQvLQ,gSsZu\$aEkLNcrSPk\)[\s\S]*?<\/script>/g,'')
  .replace(/<div id="sidebarad[12]">\s*<div class="sidebar-close"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g,'');
}
