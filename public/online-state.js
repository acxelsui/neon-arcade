export const ONLINE_FRESHNESS_MS = 75000;

// Use the account's existing presence snapshot; unknown is different from zero.
export function onlineSnapshot({members = [], connected = false, observed = 0} = {}, now = Date.now()) {
 const fresh = connected && observed > 0 && now >= observed && now - observed <= ONLINE_FRESHNESS_MS;
 const count = fresh ? Math.min(100, members.length) : null;
 return {available: fresh, count, label: fresh ? String(count) + (count === 100 ? '+' : '') : '—'};
}

let latest = {};
export function getOnlineSnapshot() { return onlineSnapshot(latest); }
export function getOnlineMembers() { return getOnlineSnapshot().available ? latest.members.slice(0,100) : []; }
export function publishOnlineSnapshot(snapshot) {
 latest = snapshot;
 window.dispatchEvent(new CustomEvent('neon-online-state', {detail: getOnlineSnapshot()}));
}
