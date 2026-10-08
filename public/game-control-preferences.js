import {getLolModGame} from './lol-mod-games.js';

export const controlDefaults=Object.freeze({stretch:false,stretchAmount:125,stretchPreset:'custom',aim:false,silent:false,silentChance:90,esp:false,wireframe:false,tracers:false,smoothing:70,fovEnabled:false,fov:75,range:30});
export function normalizeControlPreferences(value){
 const result={...controlDefaults};if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const key of ['stretch','aim','silent','esp','wireframe','tracers','fovEnabled'])result[key]=value[key]===true;
 for(const [key,min,max] of [['stretchAmount',100,150],['silentChance',1,100],['smoothing',1,100],['fov',40,110],['range',5,60]])if(Number.isFinite(value[key]))result[key]=Math.max(min,Math.min(max,Math.round(value[key])));
 if(['native','16:10','4:3','5:4','custom'].includes(value.stretchPreset))result.stretchPreset=value.stretchPreset;
 if(result.stretchPreset==='native')result.stretch=false;
 if(result.silent)result.aim=false;
 return result;
}
// Preferences are separate from game saves and never grant owner permission.
export function createControlPreferences(win){
 const key=id=>'neon-owner-controls-v1:'+id;
 return {
  load(id){if(!getLolModGame(id))return {...controlDefaults};try{const saved=JSON.parse(win.localStorage.getItem(key(id)));return normalizeControlPreferences(saved?.version===1?saved.settings:null);}catch{return {...controlDefaults};}},
  save(id,settings){if(!getLolModGame(id))return false;try{win.localStorage.setItem(key(id),JSON.stringify({version:1,settings:normalizeControlPreferences(settings)}));return true;}catch{return false;}}
 };
}
