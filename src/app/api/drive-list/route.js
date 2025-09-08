export const runtime = 'nodejs';

/** ===============================
 * Config
 * =============================== */
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const TABLE = 'drive_cache';

/** ===============================
 * Supabase (inline client)
 * =============================== */
let supabaseClient = null;
async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE; // service role (server-only)
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
  const { createClient } = await import('@supabase/supabase-js');
  supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  return supabaseClient;
}

/** ===============================
 * Utils
 * =============================== */
function qs(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v != null && v !== '' && v !== false) p.set(k, String(v));
  return p.toString();
}
function isAudio(name = '', mime = '') {
  return /audio/i.test(mime) || /\.(mp3|wav|m4a|ogg|flac|aac|opus)$/i.test(name);
}
function extractFolderId(input) {
  if (!input) return null;
  try {
    if (!/^(https?:)?\/\//i.test(input)) return input; // already an ID
    const url = new URL(input);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex((p) => p === 'folders');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    return url.searchParams.get('id') || input;
  } catch {
    return input;
  }
}
async function gFetch(pathWithQuery) {
  const url = `https://www.googleapis.com/drive/v3/${pathWithQuery}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res;
}

/** ===============================
 * Drive helpers
 * =============================== */
async function resolveRootFolder(apiKey, raw) {
  const given = extractFolderId(raw);
  if (!given) throw new Error('Invalid folderId or URL');

  const fields = [
    'id','name','mimeType','resourceKey','driveId',
    'shortcutDetails(targetId,targetMimeType,targetResourceKey)'
  ].join(',');

  const f = await (await gFetch(`files/${encodeURIComponent(given)}?` + qs({
    fields, supportsAllDrives: 'true', key: apiKey
  }))).json();

  if (f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails) {
    const tid = f.shortcutDetails.targetId;
    return await (await gFetch(`files/${encodeURIComponent(tid)}?` + qs({
      fields, supportsAllDrives: 'true', key: apiKey
    }))).json();
  }
  return f;
}

async function listChildren(apiKey, parentId, pageToken, driveId) {
  const fields =
    'nextPageToken,files(' +
    'id,name,mimeType,size,resourceKey,webViewLink,' +
    'shortcutDetails(targetId,targetMimeType,targetResourceKey)' +
    ')';
  const params = {
    q:
      `'${parentId}' in parents and trashed=false and (` +
      `mimeType='application/vnd.google-apps.folder' or ` +
      `mimeType contains 'audio' or mimeType='application/octet-stream' or ` +
      `name contains '.mp3' or name contains '.wav' or name contains '.m4a' or name contains '.ogg' or name contains '.flac' or name contains '.aac' or name contains '.opus'` +
      `)`,
    fields,
    pageSize: '1000',
    key: apiKey,
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    spaces: 'drive',
    pageToken: pageToken || undefined,
    corpora: driveId ? 'drive' : 'user',
    driveId: driveId || undefined,
  };
  return (await gFetch(`files?${qs(params)}`)).json();
}

async function crawlFolder(apiKey, rootIdOrUrl) {
  const root = await resolveRootFolder(apiKey, rootIdOrUrl);
  if (root.mimeType !== 'application/vnd.google-apps.folder') throw new Error('Not a folder');

  const queue = [{ id: root.id, path: 'Root', driveId: root.driveId || null }];
  const items = [], skipped = [];

  while (queue.length) {
    const { id: currentId, path, driveId } = queue.shift();
    let pageToken;
    do {
      let json;
      try {
        json = await listChildren(apiKey, currentId, pageToken, driveId);
      } catch (e) {
        skipped.push({ id: currentId, path, reason: String(e) });
        break;
      }
      pageToken = json.nextPageToken;

      for (const f of json.files || []) {
        let id = f.id, mime = f.mimeType, rkey = f.resourceKey;
        if (mime === 'application/vnd.google-apps.shortcut' && f.shortcutDetails) {
          id = f.shortcutDetails.targetId;
          mime = f.shortcutDetails.targetMimeType;
          rkey = f.shortcutDetails.targetResourceKey || rkey;
        }
        if (mime === 'application/vnd.google-apps.folder') {
          queue.push({ id, path: `${path}/${f.name}`, driveId });
          continue;
        }
        if (!isAudio(f.name, mime)) continue;

        items.push({
          id, name: f.name, mimeType: mime, path,
          viewLink: f.webViewLink || `https://drive.google.com/file/d/${id}/view`,
          playUrl: `/api/drive/${encodeURIComponent(id)}${rkey ? `?resourceKey=${encodeURIComponent(rkey)}` : ''}`,
          resourceKey: rkey || null,
        });
      }
    } while (pageToken);
  }
  return { items, skipped };
}

/** ===============================
 * Diff helpers (normalize deterministic)
 * =============================== */
function normalizePayload(payload) {
  const items = (payload.items || []).map(({ id, name, mimeType, path, resourceKey }) => ({
    id, name, mimeType, path, resourceKey: resourceKey || null,
  }));
  items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { items, skipped: payload.skipped || [] };
}
function sameData(a, b) {
  try {
    return JSON.stringify(normalizePayload(a)) === JSON.stringify(normalizePayload(b));
  } catch {
    return false;
  }
}

/** ===============================
 * Route (SWR)
 * =============================== */
export async function GET(req) {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return new Response('Missing GOOGLE_DRIVE_API_KEY', { status: 500 });

  const url = new URL(req.url);
  const folderParam = url.searchParams.get('folderId') || url.searchParams.get('folder');
  const refresh = url.searchParams.get('refresh'); // "1" only from warmer
  if (!folderParam) return new Response('Missing folderId (or folder URL)', { status: 400 });
  const folderId = extractFolderId(folderParam);

  // 🔒 Only allow refresh=1 from your scheduled warmer
  if (refresh === '1') {
    const warmer = req.headers.get('x-warmer-token');
    if (warmer !== process.env.WARMER_TOKEN) {
      return new Response('Unauthorized refresh', { status: 401 });
    }
  }

  // 1) Try cache
  let cachedRow = null;
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from(TABLE)
      .select('data, updated_at')
      .eq('folder_id', folderId)
      .single();
    if (!error && data) cachedRow = data;
  } catch (e) {
    console.error('Cache read failed (non-fatal):', e?.message || e);
  }

  const now = Date.now();
  const age = cachedRow ? now - new Date(cachedRow.updated_at).getTime() : Infinity;

  // 2) Fresh cache → return
  if (cachedRow && age < CACHE_TTL_MS && refresh !== '1') {
    return new Response(JSON.stringify({ ...cachedRow.data, cached: true, cachedAt: cachedRow.updated_at }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  // 3) Stale cache → return immediately and revalidate in background
  if (cachedRow && refresh !== '1') {
    // Background revalidation (fire-and-forget)
    void (async () => {
      try {
        const fresh = await crawlFolder(apiKey, folderId);
        const freshBody = { ...fresh, cached: false, cachedAt: new Date().toISOString(), folderId };
        const changed = !sameData(cachedRow.data, freshBody);

        const supabase = await getSupabase();
        if (changed) {
          const { error: upErr } = await supabase
            .from(TABLE)
            .upsert({ folder_id: folderId, data: freshBody, updated_at: new Date().toISOString() }, { onConflict: 'folder_id' });
          if (upErr) console.error('Cache upsert (changed) failed:', upErr);
        } else {
          const { error: tsErr } = await supabase
            .from(TABLE)
            .update({ updated_at: new Date().toISOString() })
            .eq('folder_id', folderId);
          if (tsErr) console.error('Cache timestamp update failed:', tsErr);
        }
      } catch (e) {
        console.error('Background revalidation failed:', e?.message || e);
      }
    })();

    // Serve stale-but-usable cache now
    return new Response(
      JSON.stringify({ ...cachedRow.data, cached: true, stale: true, revalidating: true, cachedAt: cachedRow.updated_at }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, s-maxage=60, stale-while-revalidate=600',
        },
      }
    );
  }

  // 4) No cache OR explicit refresh=1 → crawl now and store
  const payload = await crawlFolder(apiKey, folderId);
  const body = { ...payload, cached: false, cachedAt: new Date().toISOString(), folderId };

  try {
    const supabase = await getSupabase();
    const { error: upsertErr } = await supabase
      .from(TABLE)
      .upsert({ folder_id: folderId, data: body, updated_at: new Date().toISOString() }, { onConflict: 'folder_id' });
    if (upsertErr) console.error('Cache upsert (cold/refresh) failed:', upsertErr);
  } catch (e) {
    console.error('Cache write failed (non-fatal):', e?.message || e);
  }

  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
