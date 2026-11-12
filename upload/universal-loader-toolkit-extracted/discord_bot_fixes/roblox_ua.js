/* Force Roblox UA for script CDNs - require from bot or inline */
'use strict';
const ROBLOX_UA = 'Roblox/WinInet';
function needsRobloxUA(url) {
  try {
    const h = new URL(String(url)).hostname.toLowerCase();
    return (
      h.endsWith('luaprotect.dev') ||
      h.endsWith('jnkie.com') ||
      h.includes('vantarmor') ||
      h.includes('luarmor') ||
      h.includes('luavify') ||
      h.endsWith('railway.app')
    );
  } catch { return false; }
}
function applyRobloxUA(headers, url) {
  if (needsRobloxUA(url)) {
    headers['user-agent'] = ROBLOX_UA;
    headers['User-Agent'] = ROBLOX_UA;
  }
  return headers;
}
module.exports = { ROBLOX_UA, needsRobloxUA, applyRobloxUA };
