import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChatBlocks} from '../public/chat-render.js';

test('headings, consecutive list types and paragraphs keep their order',()=>{
 const blocks=parseChatBlocks('## A plan\n\nFirst line\nsecond line\n\n- One\n- **Two**\n3. Third\n4. Fourth\n> Remember\n> this\n---');
 assert.deepEqual(blocks.map(b=>b.type),['heading','paragraph','list','list','quote','rule']);
 assert.equal(blocks[1].text,'First line\nsecond line');assert.deepEqual(blocks[2].items,['One','**Two**']);assert.equal(blocks[3].start,3);assert.equal(blocks[4].text,'Remember\nthis');
});
test('fences preserve raw code, fence length and unterminated replies',()=>{
 const code='const x = "<script>";\n```\n- not a list';
 assert.deepEqual(parseChatBlocks('````js\n'+code+'\n````\nDone'),[{type:'code',language:'js',text:code},{type:'paragraph',text:'Done'}]);
 assert.deepEqual(parseChatBlocks('~~~python\nprint(1)'),[{type:'code',language:'python',text:'print(1)'}]);
});
test('untrusted HTML and dangerous URLs remain literal content, never HTML or link blocks',()=>{
 const text='<img src=x onerror=alert(1)>\n[click](javascript:alert(1))\n<script>document.cookie</script>';
 assert.deepEqual(parseChatBlocks(text),[{type:'paragraph',text}]);
 assert.equal(parseChatBlocks('```html\n'+text+'\n```')[0].text,text);
});
test('blank and Windows line endings do not create empty messages',()=>{
 assert.deepEqual(parseChatBlocks(' \r\n\r\n'),[]);
 assert.equal(parseChatBlocks('# Hello\r\n\r\nA\r\nB')[1].text,'A\nB');
});
