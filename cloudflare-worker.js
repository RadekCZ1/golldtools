/* ══════════════════════════════════════════════════════════════════════
   XAU INTEL — vlastní CORS proxy na Cloudflare Workers
   Zdarma: 100 000 požadavků denně, HTTPS, bez platební karty.

   Proč to chceš: veřejné brány jsou loterie. Při psaní tohohle byl
   api.codetabs.com mrtvý (Cloudflare 522) a corsproxy.io nově chce
   API klíč. Tenhle worker je tvůj, nikdo ti ho nevypne.

   Po nasazení stačí otevřít adresu workeru v prohlížeči — ukáže,
   jestli běží, a nabídne odkaz na automatický test.
   ══════════════════════════════════════════════════════════════════════ */

const ALLOW = [
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'fred.stlouisfed.org',
  'home.treasury.gov',
  'nfs.faireconomy.media',
];

const TEST_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=5m&range=1d';

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

    const u = new URL(req.url);
    const target = u.searchParams.get('url');

    // ── /?test=1 — ověření na jeden klik ──
    if (u.searchParams.has('test')) {
      try {
        const r = await grab(TEST_URL);
        const txt = (await r.text()).slice(0, 120);
        const good = r.ok && txt.trim().startsWith('{');
        return cors(new Response(
          (good ? '✅ FUNGUJE\n\n' : '❌ NEFUNGUJE\n\n')
          + 'Yahoo odpovědělo HTTP ' + r.status + '\n\n'
          + 'Začátek odpovědi:\n' + txt + '\n\n'
          + (good
              ? 'Proxy je v pořádku. Zkopíruj adresu z řádku prohlížeče BEZ "/?test=1"\n'
                + 'a vlož ji v aplikaci do NASTAVENÍ → Vlastní proxy.'
              : 'Yahoo z Cloudflare neodpovědělo, jak má. Zkus to za chvíli znovu.'),
          { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
      } catch (e) {
        return cors(new Response('❌ CHYBA\n\n' + e.message, { status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
      }
    }

    // ── holá adresa — místo chybové hlášky rovnou nápověda ──
    if (!target) {
      return cors(new Response(
        'XAU INTEL proxy — běží ✅\n\n'
        + 'Tahle adresa se nemá otevírat holá, používá ji aplikace.\n\n'
        + 'OVĚŘENÍ: připoj na konec adresy  /?test=1\n'
        + '  → ' + u.origin + '/?test=1\n\n'
        + 'DO APLIKACE vlož tuhle adresu (bez čehokoli za lomítkem):\n'
        + '  → ' + u.origin + '\n\n'
        + 'Povolené zdroje:\n' + ALLOW.map(h => '  · ' + h).join('\n'),
        { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
    }

    let t;
    try { t = new URL(target); }
    catch { return cors(new Response('neplatná URL: ' + target, { status: 400 })); }

    // whitelist — ať z toho nikdo neudělá otevřenou proxy
    if (!ALLOW.includes(t.hostname))
      return cors(new Response('host not allowed: ' + t.hostname, { status: 403 }));

    try {
      const r = await grab(t.toString());
      return cors(new Response(await r.arrayBuffer(), {
        status: r.status,
        headers: { 'Content-Type': r.headers.get('content-type') || 'text/plain' },
      }));
    } catch (e) {
      return cors(new Response('upstream error: ' + e.message, { status: 502 }));
    }
  },
};

function grab(url) {
  return fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (xau-intel)', 'Accept': '*/*' },
    // Bez timeoutu visící zdroj (fred.stlouisfed.org přes Cloudflare) shodí
    // celý worker a Cloudflare vrátí pomalou 520. S ním přijde čistá 502
    // a aplikace hned zkusí náhradní zdroj.
    signal: AbortSignal.timeout(12000),
    cf: { cacheTtl: 45, cacheEverything: true },   // šetří kvótu i cizí server
  });
}

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Headers', '*');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
