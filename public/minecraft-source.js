// These are the two game frames selected by WASM Arcade's Minecraft launcher.
// Both still enter through Neon's existing Scramjet/Wisp game runner.
export const minecraftFrames=Object.freeze({wasm:'https://wasmarcade.com/eaglercraft/1.8.8/app.html',javascript:'https://wasmarcade.com/eaglercraft/1.8.8/app-js.html'});
export function minecraftFrame(wasm=globalThis.WebAssembly){
 try{return wasm?.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,3,1,95,0]))?minecraftFrames.wasm:minecraftFrames.javascript;}catch{return minecraftFrames.javascript;}
}
