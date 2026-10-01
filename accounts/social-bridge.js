const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function id(value,optional=false){if(optional&&value==null)return null;if(typeof value!=='string'||!uuid.test(value))throw Error('Choose a valid player or playlist.');return value}
function text(value,max,min=0){if(typeof value!=='string'||value.trim().length<min||value.length>max)throw Error('Please check the text length.');return value.trim()}
export function cleanSong(song){
 if(!song||typeof song.id!=='string'||!/^[a-zA-Z0-9:_-]{1,160}$/.test(song.id))throw Error('Choose a song from Neon Arcade Music.');
 const thumb=text(song.thumb??'',2000);if(thumb){const url=new URL(thumb);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid song cover.');}
 const duration=Number(song.duration??0);if(!Number.isInteger(duration)||duration<0||duration>999999)throw Error('Invalid song duration.');
 return {id:song.id,title:text(song.title,200,1),artist:text(song.artist??'',200),thumb,duration};
}
export function socialRequest(data){
 switch(data.action){
 case 'decoration-save':if(!['none','halo','cat','orbit','ribbon','headphones','flame','wings','pixel'].includes(data.decoration))throw Error('Choose an available decoration.');return ['neon_decoration_save',{style:data.decoration}];
 case 'profile':return ['neon_player_profile',{player_id:id(data.playerId,true)}];
 case 'profile-save':{
  if(!Array.isArray(data.games)||data.games.length>6||data.games.some(value=>typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value)))throw Error('Choose up to six favorite games.');
  return ['neon_profile_save',{about:text(data.bio,240),game_ids:[...new Set(data.games)]}];
 }
 case 'friends':return ['neon_friends_list',{}];
 case 'player-search':return ['neon_player_search',{query:text(data.query,24,2)}];
 case 'friend-action':if(!['request','accept','remove'].includes(data.operation))throw Error('Invalid friend action.');return ['neon_friend_action',{peer:id(data.peer),operation:data.operation}];
 case 'playlists':return ['neon_playlists_list',{}];
 case 'playlist-delete':return ['neon_playlist_delete',{playlist_id:id(data.playlistId)}];
 case 'playlist-save':{
  if(!Array.isArray(data.tracks)||data.tracks.length>100)throw Error('A playlist holds up to 100 songs.');
  const songs=data.tracks.map(cleanSong);if(new Set(songs.map(song=>song.id)).size!==songs.length)throw Error('That song is already in the playlist.');
  const revision=data.revision??0;if(!Number.isSafeInteger(revision)||revision<0)throw Error('Refresh the playlist before editing.');
  return ['neon_playlist_save',{playlist_id:id(data.playlistId,true),playlist_name:text(data.name,50,1),songs,expected_revision:revision}];
 }
 default:throw Error('Unknown profile or music action.');
 }
}
export function initSocialBridge({rpc,send,getProfile,avatars}){
 let pending=0;
 return async data=>{
  const owner=getProfile()?.id;if(!owner||typeof data.requestId!=='string'||data.requestId.length>80)return;
  if(pending>=5){send('social-result',{requestId:data.requestId,error:'Please wait for your account to catch up.'});return}
  pending++;
  try{
   const [name,args]=socialRequest(data);let result=await rpc(name,args);
   if(['profile','friends','player-search'].includes(data.action)&&avatars){const rows=Array.isArray(result)?result:[result];const urls=await avatars(rows.map(row=>row.id));result=rows.map(row=>({...row,avatar:urls.get(row.id)||null}));if(data.action==='profile')result=result[0];}
   if(getProfile()?.id===owner)send('social-result',{requestId:data.requestId,result,self:owner});
  }catch(error){if(getProfile()?.id===owner)send('social-result',{requestId:data.requestId,error:['PGRST202','42883','42703','42P01'].includes(error.code)?'Profiles, friends, and playlists are being set up. Please try again soon.':error.message||'Your account could not connect. Try again.'});}
  finally{pending--}
 };
}
