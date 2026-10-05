export const widgetIds=['music','weather','online','recent'];
export const widgetDefaults={music:{x:24,y:24},weather:{x:292,y:24},online:{x:24,y:258},recent:{x:292,y:258}};
export function widgetPreferences(value){
 const enabled=Array.isArray(value?.enabled)?widgetIds.filter(id=>value.enabled.includes(id)):[...widgetIds];
 const positions={};for(const id of widgetIds){const position=value?.positions?.[id];positions[id]=position&&Number.isFinite(position.x)&&Number.isFinite(position.y)?{x:position.x,y:position.y}:{...widgetDefaults[id]};}
 return {enabled,positions};
}
export function fitWidget(position,bounds,size={width:252,height:180}){
 const x=Number.isFinite(position?.x)?position.x:24,y=Number.isFinite(position?.y)?position.y:24;
 return {x:Math.round(Math.max(8,Math.min(x,Math.max(8,bounds.width-size.width-8)))),y:Math.round(Math.max(8,Math.min(y,Math.max(8,bounds.height-size.height-8))))};
}
