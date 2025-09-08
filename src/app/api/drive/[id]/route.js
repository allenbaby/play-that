export const runtime = 'nodejs';

export async function GET(req, ctx) {
  // ⬇️ params is a Promise in newer Next – await it
  const { id } = await ctx.params;
  if (!id) return new Response('Missing file id', { status: 400 });

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return new Response('Server missing GOOGLE_DRIVE_API_KEY', { status: 500 });

  const resourceKey = new URL(req.url).searchParams.get('resourceKey') || undefined;
  const range = req.headers.get('range') || undefined;

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`);
  url.searchParams.set('alt', 'media');
  url.searchParams.set('supportsAllDrives', 'true');
  url.searchParams.set('acknowledgeAbuse', 'true');
  url.searchParams.set('key', apiKey);
  if (resourceKey) url.searchParams.set('resourceKey', resourceKey);

  const upstream = await fetch(url.toString(), {
    headers: range ? { Range: range } : undefined,
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'text/plain' },
    });
  }

  const headers = new Headers();
  for (const h of [
    'content-type',
    'content-length',
    'accept-ranges',
    'content-range',
    'etag',
    'last-modified',
    'cache-control',
  ]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'public, max-age=3600, immutable');
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
