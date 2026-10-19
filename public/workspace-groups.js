export const workspaceSections={
 music:[['music','Discover'],['playlists','Your playlists']],
 games:[['games','Game library'],['cloud','Cloud gaming']],
 profile:[['profile','Profile'],['friends','Friends']]
};
export function workspaceGroup(id){return {playlists:'music',cloud:'games',friends:'profile'}[id]||id;}
export function workspacePins(value){return Array.isArray(value)?[...new Set(value.map(workspaceGroup))]:value;}
