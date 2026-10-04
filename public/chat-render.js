// A small Markdown subset. Content remains text, including HTML and URLs.
export function parseChatBlocks(text) {
 const lines=String(text).replace(/\r\n?/g,'\n').split('\n'), blocks=[];
 const fence=line=>/^\s{0,3}(`{3,}|~{3,})([\w+-]*)\s*$/.exec(line);
 const list=line=>/^\s{0,3}(?:([-+*])|(\d+)\.)\s+(.+)$/.exec(line);
 const special=line=>!line.trim()||fence(line)||/^\s{0,3}#{1,4}\s|^\s{0,3}>\s?|^\s{0,3}(?:---+|\*\*\*+)\s*$/.test(line)||list(line);
 for(let i=0;i<lines.length;){
  const line=lines[i],open=fence(line);
  if(!line.trim()){i++;continue;}
  if(open){const content=[];i++;while(i<lines.length){const close=fence(lines[i]);if(close&&close[1][0]===open[1][0]&&close[1].length>=open[1].length&&!close[2]){i++;break;}content.push(lines[i++]);}blocks.push({type:'code',language:open[2].toLowerCase(),text:content.join('\n')});continue;}
  const heading=/^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
  if(heading){blocks.push({type:'heading',level:heading[1].length,text:heading[2]});i++;continue;}
  if(/^\s{0,3}(?:---+|\*\*\*+)\s*$/.test(line)){blocks.push({type:'rule'});i++;continue;}
  const item=list(line);
  if(item){const ordered=!!item[2],items=[];let next;while(i<lines.length&&(next=list(lines[i]))&&!!next[2]===ordered){items.push(next[3]);i++;}blocks.push({type:'list',ordered,start:ordered?Number(item[2]):undefined,items});continue;}
  if(/^\s{0,3}>/.test(line)){const content=[];while(i<lines.length&&/^\s{0,3}>/.test(lines[i]))content.push(lines[i++].replace(/^\s{0,3}>\s?/,''));blocks.push({type:'quote',text:content.join('\n')});continue;}
  const content=[line];i++;while(i<lines.length&&!special(lines[i]))content.push(lines[i++]);blocks.push({type:'paragraph',text:content.join('\n')});
 }
 return blocks;
}

function inline(target,text){
 for(const part of text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g)){
  const tag=part.startsWith('`')&&part.endsWith('`')?'code':part.startsWith('**')&&part.endsWith('**')?'strong':null;
  if(tag){const el=document.createElement(tag);el.textContent=part.slice(tag==='code'?1:2,tag==='code'?-1:-2);target.append(el);}else target.append(document.createTextNode(part));
 }
}
export function renderChatContent(target,text,{onCopyError=()=>{}}={}) {
 const body=document.createElement('div');body.className='chat-prose';target.append(body);
 for(const block of parseChatBlocks(text)){
  if(block.type==='code'){
   const section=document.createElement('section');section.className='chat-code';
   const bar=document.createElement('div');bar.className='chat-code-bar';const language=document.createElement('span');language.textContent=block.language||'Code';
   const copy=document.createElement('button');copy.type='button';copy.textContent='Copy code';copy.setAttribute('aria-label','Copy '+(block.language||'')+' code');
   copy.onclick=async()=>{try{await navigator.clipboard.writeText(block.text);copy.textContent='Copied';setTimeout(()=>copy.textContent='Copy code',1800);}catch{onCopyError();}};
   bar.append(language,copy);const pre=document.createElement('pre'),code=document.createElement('code');code.textContent=block.text;pre.append(code);section.append(bar,pre);body.append(section);
  }else if(block.type==='list'){
   const el=document.createElement(block.ordered?'ol':'ul');if(block.ordered)el.start=block.start;for(const text of block.items){const li=document.createElement('li');inline(li,text);el.append(li);}body.append(el);
  }else{
   const tag=block.type==='heading'?'h'+(block.level+2):block.type==='quote'?'blockquote':block.type==='rule'?'hr':'p',el=document.createElement(tag);if(block.text)inline(el,block.text);body.append(el);
  }
 }
}
