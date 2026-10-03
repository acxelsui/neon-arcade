import {Buffer} from 'node:buffer';
import {RemoteError} from './protocol.mjs';
export const videoMime='video/mp4; codecs="avc1.42C02A"';
// Validate box boundaries before retaining media. No screen bytes go to disk.
export function mp4Boxes(encoded,limit,expected){
 if(typeof encoded!=='string'||encoded.length>limit||!encoded.length||encoded.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new RemoteError('Invalid video data.');
 const bytes=Buffer.from(encoded,'base64'),types=[];let offset=0;
 while(offset<bytes.length){
  if(offset+8>bytes.length)throw new RemoteError('Incomplete video data.');
  const size=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);
  if(size<8||offset+size>bytes.length)throw new RemoteError('Invalid video box.');
  types.push(type);offset+=size;
 }
 if(types.join(',')!==expected)throw new RemoteError('Unexpected video format.');
 return encoded;
}
export function acceptVideo(previous,value){
 if(!value||!/^[a-f0-9]{32}$/.test(value.stream||'')||value.fps!==60||!Number.isInteger(value.width)||!Number.isInteger(value.height)||value.width<2||value.height<2||value.width>1280||value.height>1280||!Array.isArray(value.segments)||value.segments.length>6)throw new RemoteError('Invalid video stream.');
 const init=mp4Boxes(value.init,32000,'ftyp,moov');
 let total=init.length;
 const segments=value.segments.map(segment=>{
  if(!Number.isSafeInteger(segment.id)||segment.id<1)throw new RemoteError('Invalid video sequence.');
  total+=segment.data?.length||0;if(total>700000)throw new RemoteError('Video batch is too large.',413);
  return {id:segment.id,data:mp4Boxes(segment.data,660000,'moof,mdat')};
 });
 for(let i=1;i<segments.length;i++)if(segments[i].id<=segments[i-1].id)throw new RemoteError('Video segments must be ordered.');
 const same=previous?.stream===value.stream;
 if(same&&(previous.init!==init||previous.width!==value.width||previous.height!==value.height))throw new RemoteError('Video format changed without restarting.');
 let retained=same?[...previous.segments]:[];
 for(const segment of segments){if(segment.id>(retained.at(-1)?.id||0))retained.push(segment);}
 // Every fragment begins at a keyframe, so dropping old fragments is safe.
 // Keep at most 1.2 seconds and 700 KB of encoded data, rather than a backlog.
 while(retained.length>6||retained.reduce((sum,item)=>sum+item.data.length,init.length)>700000)retained.shift();
 return {stream:value.stream,init,width:value.width,height:value.height,fps:60,segments:retained};
}
export function videoReply(video,action){
 const same=action.videoStream===video.stream,sequence=same?action.sequence:0;
 const segments=video.segments.filter(item=>item.id>sequence);
 return {sequence:segments.at(-1)?.id||sequence,waiting:!video.segments.length,video:{stream:video.stream,mime:videoMime,width:video.width,height:video.height,fps:60,...(!same?{init:video.init}:{}),segments}};
}
