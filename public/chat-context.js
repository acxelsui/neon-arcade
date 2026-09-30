// Keep complete recent turns and the opening question within the provider budget.
export function conversationContext(history){
 const recent=history.slice(-59).map(m=>({role:m.role,content:m.content+(m.screenCapturedAt?"\n[The final attached image is the shared screen captured with this question at "+m.screenCapturedAt+". Earlier screen images may be out of date.]":""),images:m.images}));
 while(recent[0]?.role==='assistant')recent.shift();
 while(recent.length>1&&recent.reduce((n,m)=>n+m.content.length,0)>32000){recent.shift();while(recent[0]?.role==='assistant')recent.shift()}
 const opening=history[0];
 if(opening?.role==='user'&&history.length>recent.length&&opening.content.length+recent.reduce((n,m)=>n+m.content.length,0)<=40000)recent.unshift({role:'user',content:opening.content});
 let remaining=3;
 for(let i=recent.length-1;i>=0;i--){const images=recent[i].images?.slice(0,remaining);remaining-=images?.length||0;recent[i].images=images}
 return recent;
}
