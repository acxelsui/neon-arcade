// Keep older HTML5 exports compatible with the standard Web Audio names.
// Audio still starts only when permitted by the browser's normal gesture policy.
(() => {
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  window.AudioContext ||= Context;
  window.webkitAudioContext ||= Context;
  const aliases=(prototype,names)=>{
    if(!prototype)return;
    for(const [oldName,newName] of names){
      if(!prototype[oldName]&&prototype[newName])prototype[oldName]=prototype[newName];
      if(!prototype[newName]&&prototype[oldName])prototype[newName]=prototype[oldName];
    }
  };
  aliases(Context.prototype,[['createGainNode','createGain'],['createDelayNode','createDelay'],['createJavaScriptNode','createScriptProcessor']]);
  aliases(window.AudioBufferSourceNode?.prototype,[['noteOn','start'],['noteOff','stop']]);
})();
