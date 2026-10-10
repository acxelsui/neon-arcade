import {getLolModGame} from './lol-mod-games.js';
import {normalizeControlPreferences} from './game-control-preferences.js';

export const controlBindings=Object.freeze({menu:'Tab',off:'',aim:'',silent:'',esp:'',tracers:'',wireframe:'',fovEnabled:'',stretch:''});
export const bindingKeys=Object.freeze(['Tab','Insert','Backquote','F2','F3','F4','F6','F7','F8','F9','F10',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>'Key'+c),...'0123456789'.split('').map(c=>'Digit'+c)]);
export const previewColors=Object.freeze({highlight:'#5dbaff',tracer:'#71caff'});
export function normalizePreviewColors(value){return Object.fromEntries(Object.entries(previewColors).map(([key,fallback])=>[key,/^#[a-f0-9]{6}$/i.test(value?.[key])?value[key].toLowerCase():fallback]));}
export function normalizeControlBindings(value){
 const result={...controlBindings},used=new Set();
 for(const key of Object.keys(result)){
  const code=value?.[key]??result[key];
  result[key]=bindingKeys.includes(code)&&(code!=='Tab'||key==='menu')&&!used.has(code)?code:'';
  if(result[key])used.add(result[key]);
 }
 return result;
}
export function controlShortcut(event,bindings,{fromGame=false}={}){
 if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||event.target?.closest?.(fromGame?'input,textarea,select,button,[contenteditable=true]':'input,textarea,select,[contenteditable=true]'))return null;
 const code=event.code||(event.key==='Tab'?'Tab':null);
 return Object.entries(bindings).find(([,key])=>key&&key===code)?.[0]??null;
}
export function normalizeControlWorkspace(value){
 const colors=normalizePreviewColors(value?.colors),keybinds=normalizeControlBindings(value?.keybinds),profiles=[];
 if(Array.isArray(value?.profiles))for(const row of value.profiles.slice(0,8)){
  if(!row||typeof row.id!=='string'||!/^p-[a-z0-9-]{1,60}$/i.test(row.id)||profiles.some(p=>p.id===row.id)||typeof row.name!=='string'||!row.name.trim())continue;
  profiles.push({id:row.id,name:row.name.trim().slice(0,32),settings:normalizeControlPreferences(row.settings),colors:normalizePreviewColors(row.colors)});
 }
 const selectedProfile=profiles.some(p=>p.id===value?.selectedProfile)?value.selectedProfile:'';
 return {colors,keybinds,profiles,selectedProfile};
}
// Workspace data has its own namespace. Profiles never authorize owner access.
export function createControlWorkspace(win){
 const key=id=>'neon-owner-workspace-v1:'+id;
 return {
  load(id){if(!getLolModGame(id))return normalizeControlWorkspace();try{const value=JSON.parse(win.localStorage.getItem(key(id)));return normalizeControlWorkspace(value?.version===1?value.workspace:null);}catch{return normalizeControlWorkspace();}},
  save(id,workspace){if(!getLolModGame(id))return false;try{win.localStorage.setItem(key(id),JSON.stringify({version:1,workspace:normalizeControlWorkspace(workspace)}));return true;}catch{return false;}}
 };
}
