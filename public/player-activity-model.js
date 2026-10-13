export const activityRanges={1:{label:'1 hour',step:1},24:{label:'24 hours',step:5},168:{label:'7 days',step:60}};
const count=value=>Number.isInteger(value)&&value>=0&&value<=1000000;
export function activityReport(value,hours=24){
 const range=Number.isInteger(hours)&&Object.hasOwn(activityRanges,hours)?activityRanges[hours]:null;if(!range||!value||!Array.isArray(value.points)||value.step_minutes!==range.step||!count(value.current_online))throw Error('The activity report could not be read.');
 const from=Date.parse(value.from),to=Date.parse(value.to),serverTime=Date.parse(value.server_time),step=range.step*60000;
 if(![from,to,serverTime].every(Number.isFinite)||to<from||Math.abs(to-from-hours*3600000)>step*2||Math.abs(serverTime-to)>step||value.points.length!==hours*60/range.step+1)throw Error('The activity timeline could not be read.');
 const points=value.points.map((row,index)=>{
  const time=Date.parse(row?.time);if(!Number.isFinite(time)||time!==from+index*step||time>to||(row.count!==null&&!count(row.count)))throw Error('The activity timeline could not be read.');return {time,count:row.count};
 });
 const recorded=points.filter(p=>p.count!==null),peak=recorded.reduce((best,p)=>!best||p.count>best.count?p:best,null),recordingSince=value.recording_since===null?null:Date.parse(value.recording_since);
 if(recordingSince!==null&&(!Number.isFinite(recordingSince)||recordingSince>serverTime))throw Error('The recording start time could not be read.');
 return {hours,stepMinutes:range.step,current:value.current_online,from,to,serverTime,recordingSince,points,peak,recorded:recorded.length};
}
export function activityGeometry(report,{width=960,height=270,left=46,right=18,top=18,bottom=38}={}){
 const plotWidth=width-left-right,plotHeight=height-top-bottom,max=Math.max(4,...report.points.map(p=>p.count??0)),tick=Math.ceil(max/4),ceiling=tick*4;
 const xy=p=>({x:left+(p.time-report.from)/Math.max(1,report.to-report.from)*plotWidth,y:top+(1-p.count/ceiling)*plotHeight});
 const segments=[];let segment=[];for(const p of report.points){if(p.count===null){if(segment.length)segments.push(segment);segment=[];}else segment.push({...p,...xy(p)});}if(segment.length)segments.push(segment);
 return {width,height,left,top,plotWidth,plotHeight,baseline:height-bottom,ceiling,tick,segments,xy};
}
