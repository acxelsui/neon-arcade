// Construct's engine does not automatically honor <base href> when it builds
// worker/runtime addresses. Preserve an explicit export setting, otherwise use
// the same document base that the game's script and image elements already use.
export function repairConstructBase(source){
 if(!source.includes('RuntimeInterface')||!source.includes('runtimeBaseUrl'))return source;
 return source.replace(/constructor\((\w+)\)\s*\{\s*this\._useWorker\s*=\s*\1\.useWorker;/,(_all,options)=>`constructor(${options}){${options}.runtimeBaseUrl=${options}.runtimeBaseUrl||new URL('.',document.baseURI).href;this._useWorker=${options}.useWorker;`);
}
export function repairConstructScheduling(source){
 // This exact exported engine has request callbacks accidentally passed to
 // cancelAnimationFrame throughout startup and rendering. Never replace real
 // numeric-handle cancellation, or alter unrelated scripts/engine versions.
 if(!source.includes('self.C3')||!source.includes('_WaitForObjectReady')||!source.includes('q=self.cancelAnimationFrame(r)'))return source;
 for(const callback of ['()=>','p)','async p=>','r)','c.normal)','c.renderOnly)'])source=source.replaceAll('cancelAnimationFrame('+callback,'requestAnimationFrame('+callback);
 return source;
}
export function repairConstructGame(source){return repairConstructScheduling(repairConstructBase(source));}
