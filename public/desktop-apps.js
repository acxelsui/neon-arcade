export const defaultDesktopApps=['home','games','search','playlists','community','settings','remote','owner'];
export function appList(value,known,fallback){
 return Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&known.includes(id)))]:[...fallback];
}
export function dockApps(pins,running,allowed){return [...new Set([...pins,...running])].filter(allowed);}
