// Window state contains presentation only. Page access still belongs to Neon.
export function fitWindow(rect, width, height) {
 const w=Math.min(Math.max(320,rect.w),Math.max(1,width)),h=Math.min(Math.max(240,rect.h),Math.max(1,height));
 return {x:Math.max(0,Math.min(rect.x,width-w)),y:Math.max(0,Math.min(rect.y,height-h)),w,h};
}
export function createWindowState() {
 const windows=new Map();let active=null,desktop=false;
 return {
  windows,
  get active(){return active;},get desktop(){return desktop;},
  open(id){let item=windows.get(id);if(!item){item={id,minimized:false,maximized:false,rect:null};windows.set(id,item);}item.minimized=false;active=id;desktop=false;return item;},
  focus(id){if(!windows.has(id))return false;windows.get(id).minimized=false;active=id;desktop=false;return true;},
  minimize(id){const item=windows.get(id);if(!item)return;item.minimized=true;if(active===id)active=[...windows.values()].filter(w=>!w.minimized&&w.id!==id).at(-1)?.id||null;},
  close(id){windows.delete(id);if(active===id)active=[...windows.values()].filter(w=>!w.minimized).at(-1)?.id||null;},
  maximize(id){const item=windows.get(id);if(item){item.maximized=!item.maximized;this.focus(id);}},
  showDesktop(){desktop=!desktop;},
  visible(id){const item=windows.get(id);return !!item&&!item.minimized&&!desktop;}
 };
}

export function renderedWindows(state){
 const covering=state.visible(state.active)&&state.windows.get(state.active)?.maximized;
 return new Set([...state.windows.keys()].filter(id=>state.visible(id)&&(!covering||id===state.active)));
}
