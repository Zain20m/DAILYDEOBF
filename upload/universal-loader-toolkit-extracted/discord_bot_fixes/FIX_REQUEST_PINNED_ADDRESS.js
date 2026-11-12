
// REPLACE the headers = { ... } block inside requestPinnedAddress (around the Chrome UA line)
// with ALL of this:

    const host = String(url && url.hostname || '').toLowerCase();
    const needsRobloxUA =
      host === 'cdn.luaprotect.dev' ||
      host === 'exec.luaprotect.dev' ||
      host.endsWith('.luaprotect.dev') ||
      host.includes('luarmor') ||
      host.includes('vantarmor') ||
      host.includes('luavify');

    const headers = {
      'user-agent': needsRobloxUA
        ? 'Roblox/WinInet'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: needsRobloxUA
        ? '*/*'
        : 'text/plain, text/*, application/luau, application/javascript, application/octet-stream, application/json, */*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'accept-encoding': options.compressed ? 'gzip, deflate, br' : 'identity',
      connection: 'close',
      ...(method === 'PROPFIND' ? { depth: '0' } : {}),
      ...(options.headers || {}),
    };

    // MUST be last — curl -A / options.headers must not force Chrome onto LuaProtect
    if (needsRobloxUA) {
      headers['user-agent'] = 'Roblox/WinInet';
      headers['User-Agent'] = 'Roblox/WinInet'; // some stacks are case-sensitive on merge
    }

    // Debug once if you still see 403 (remove later):
    // console.log('[fetch]', method, host, 'ua=', headers['user-agent'] || headers['User-Agent']);
