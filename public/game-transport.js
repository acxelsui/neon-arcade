// Feed bundled files into Scramjet without asking the relay to access localhost.
// All other HTTP requests and WebSocket connections remain on libcurl.
import {withoutBuildNowDemoAds,buildNowSdkAddress} from './buildnow-sdk.js';
import {cleanBundledGamePage} from './game-page-cleanup.js';
import {repairConstructGame} from './construct-game-base.js';
export const GAME_ORIGIN = 'https://games.neon-arcade.invalid';
// GitHub serves raw repository files as plain text. These are game assets,
// requested inside the isolated game runner, rather than navigable web pages.
export function gameAssetHeaders(url,headers,status){
  if(status!==200||url.hostname!=='raw.githubusercontent.com')return headers;
  const type=/\.js$/i.test(url.pathname)?'application/javascript':/\.css$/i.test(url.pathname)?'text/css':/\.wasm$/i.test(url.pathname)?'application/wasm':null;
  return type?[...headers.filter(([name])=>name.toLowerCase()!=='content-type'),['content-type',type]]:headers;
}
export function gameTransport(transport, origin, fetchLocal = fetch) {
  const upstream = transport.request.bind(transport);
  const request = async (...args) => {
    const response=await upstream(...args);
    const headers=gameAssetHeaders(new URL(args[0]),response.headers,response.status);
    return headers===response.headers?response:{...response,headers};
  };
  transport.request = async (remote, method, body, headers, signal) => {
    // libcurl's custom HEAD method expects a response body and rejects valid
    // split-file headers as a partial transfer. Probe public game chunks with a
    // one-byte GET instead, then discard the body; keep the same proxy route.
    if (method === 'HEAD' && remote.protocol === 'https:' && remote.hostname === 'cdn.jsdelivr.net' && /\.(?:wasm|data|pck|unityweb)\.part\d+$/i.test(remote.pathname)) {
      const probe = await request(remote, 'GET', null, [...headers.filter(([name]) => !['range','content-length'].includes(name.toLowerCase())), ['Range','bytes=0-0']], signal);
      await probe.body?.cancel?.();
      const total = probe.headers.find(([name]) => name.toLowerCase() === 'content-range')?.[1]?.match(/\/(\d+)$/)?.[1];
      const resultHeaders = probe.headers.filter(([name]) => name.toLowerCase() !== 'content-range' && (!total || name.toLowerCase() !== 'content-length'));
      if (total) resultHeaders.push(['content-length',total]);
      return {...probe, body:null, headers:resultHeaders, status:probe.status===206?200:probe.status, statusText:probe.status===206?'OK':probe.statusText};
    }
    if (remote.origin !== GAME_ORIGIN || !remote.pathname.startsWith('/games/')) {
      const buildNowScript=remote.origin==='https://cdn.jsdelivr.net'&&remote.pathname.startsWith('/gh/bubblfan/cg-rip@main/buildnow-gg/');
      const demoSdk=buildNowScript&&remote.pathname.endsWith('/cg-sdk.js')&&['','?neon-standalone=20261013b'].includes(remote.search);
      const framework=buildNowScript&&remote.pathname.endsWith('/Build/91a2bfcec140bc524100478b99a4f6d7.framework.js')&&remote.search==='?neon-standalone=20261013b';
      if(method==='GET'&&(demoSdk||framework)){
        const response=await request(remote,method,body,headers,signal);
        if(response.status===200&&response.body){
          const text=await new Response(response.body).text(),updated=demoSdk?withoutBuildNowDemoAds(text):buildNowSdkAddress(text);
          return {...response,body:new Blob([updated]).stream(),headers:response.headers.filter(([name])=>!['content-length','content-encoding','etag'].includes(name.toLowerCase()))};
        }
        return response;
      }
      if(method==='GET'&&/\/(?:main\d*|c3runtime)\.js$/i.test(remote.pathname)){
        const response=await request(remote,method,body,headers,signal);
        if(response.status===200&&response.body){
          const source=await new Response(response.body).text();
          return {...response,body:new Blob([repairConstructGame(source)]).stream(),headers:response.headers.filter(([name])=>!['content-length','content-encoding','etag'].includes(name.toLowerCase()))};
        }
        return response;
      }
      return request(remote, method, body, headers, signal);
    }
    const response = await fetchLocal(new URL(remote.pathname + remote.search, origin).href, {
      method, body, signal, redirect: 'manual', credentials: 'same-origin',
      headers: headers.filter(([name]) => ['range', 'accept', 'content-type', 'cache-control', 'pragma'].includes(name.toLowerCase())),
    });
    if(method==='GET'&&response.status===200&&/\.html$/i.test(remote.pathname)){
      const html=cleanBundledGamePage(await response.text());
      return {body:new Blob([html]).stream(),headers:[...response.headers].filter(([name])=>!['content-length','content-encoding','etag'].includes(name.toLowerCase())),status:response.status,statusText:response.statusText};
    }
    return { body: response.body, headers: [...response.headers], status: response.status, statusText: response.statusText };
  };
  return transport;
}
