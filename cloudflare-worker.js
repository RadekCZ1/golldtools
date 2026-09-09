/* ══════════════════════════════════════════════════════════════════════
   XAU INTEL — vlastní CORS proxy na Cloudflare Workers
   Zdarma: 100 000 požadavků denně, HTTPS, bez karty.
   Nasazení je popsané v NAVOD-IPHONE — trvá asi tři minuty.

   Proč to chceš: veřejné brány jsou loterie. Při psaní tohohle byl
   api.codetabs.com mrtvý (Cloudflare 522) a corsproxy.io nově chce
   API klíč. Tenhle worker je tvůj, nikdo ti ho nevypne.
   ══════════════════════════════════════════════════════════════════════ */

const ALLOW = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'fred.stlouisfed.org',
  'home.treasury.gov',
  'nfs.faireconomy.media',
];

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

    const target = new URL(req.url).searchParams.get('url');
    if (!target) return cors(new Response('chybí ?url=', { status: 400 }));

    let t;
    try { t = new URL(target); }
    catch { return cors(new Response('neplatná URL', { status: 400 })); }

    // whitelist — ať z toho nikdo neudělá otevřenou proxy
    if (!ALLOW.includes(t.hostname))
      return cors(new Response('host not allowed: ' + t.hostname, { status: 403 }));

    try {
      const r = await fetch(t.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (xau-intel)', 'Accept': '*/*' },
        cf: { cacheTtl: 45, cacheEverything: true },   // šetří kvótu i cizí server
      });
      return cors(new Response(await r.arrayBuffer(), {
        status: r.status,
        headers: { 'Content-Type': r.headers.get('content-type') || 'text/plain' },
      }));
    } catch (e) {
      return cors(new Response('upstream error: ' + e.message, { status: 502 }));
    }
  },
};

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', '*');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
