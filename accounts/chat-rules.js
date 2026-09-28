// Shared validation for player-authored chat messages.
export function chatText(value){
 if(typeof value!=='string')throw new Error('Write a message first.');
 const text=value.trim();
 if(!text)throw new Error('Write a message first.');
 if(text.length>1000)throw new Error('Keep messages under 1,000 characters.');
 return text;
}
