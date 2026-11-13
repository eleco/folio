import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 500);

// Parse HTML rather than treating untrusted markup as executable content.
export function extractTitle(html: string): string | null {
  let og = '', twitter = '', title = '';
  const text = (node: Node): string => 'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(text).join('') : '';
  function visit(node: Node) {
    if ('tagName' in node) {
      if (node.tagName === 'title' && !title) title = clean(text(node));
      if (node.tagName === 'meta') {
        const attrs = Object.fromEntries(node.attrs.map(a => [a.name.toLowerCase(), a.value]));
        const key = (attrs.property || attrs.name || '').toLowerCase();
        if (key === 'og:title' && !og) og = clean(attrs.content || '');
        if (key === 'twitter:title' && !twitter) twitter = clean(attrs.content || '');
      }
      if (['script', 'style', 'template', 'svg'].includes(node.tagName)) return;
    }
    if ('childNodes' in node) node.childNodes.forEach(visit);
  }
  visit(parse(html));
  return og || title || twitter || null;
}

export function publicAddress(ip: string): boolean {
  if (ip.includes(':')) {
    // Accept only global unicast; reject mapped, local, multicast and transition ranges.
    return /^[23][\da-f]{3}:/i.test(ip) && !/^(2001:|2002:|3fff:)/i.test(ip);
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a,b,c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

export function allowedTarget(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
    (!url.port || ['80','443'].includes(url.port)) && url.href.length <= 8000 &&
    host.includes('.') && !host.includes(':') && !/^\d+(\.\d+)*$/.test(host) &&
    !/(^|\.)(localhost|local|internal|home|lan|test|invalid|onion)$/.test(host);
}

async function publicHost(host: string, signal: AbortSignal, request: typeof fetch) {
  const answers = await Promise.all(['A', 'AAAA'].map(async type => {
    const endpoint = new URL('https://cloudflare-dns.com/dns-query');
    endpoint.searchParams.set('name', host); endpoint.searchParams.set('type', type);
    const response = await request(endpoint, {headers:{Accept:'application/dns-json'}, signal, redirect:'manual'});
    // Workers do not support redirect: 'error'. Manual mode plus this status
    // check rejects redirects without following them or leaving the DNS provider.
    if (!response.ok) {await response.body?.cancel();throw Error('DNS unavailable');}
    const dns = await response.json() as {Status?:number; Answer?:{type:number;data:string}[]};
    if (dns.Status !== 0) throw Error('DNS failed');
    return (dns.Answer || []).filter(a => a.type === 1 || a.type === 28).map(a => a.data);
  }));
  const addresses = answers.flat();
  return addresses.length > 0 && addresses.every(publicAddress);
}

export async function fetchPageHtml(raw: string, request: typeof fetch = fetch, fullArticle = false, reportErrors = false): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), fullArticle ? 12000 : 5000);
  try {
    let url = new URL(raw);
    for (let redirect = 0; redirect < 4; redirect++) {
      if (!allowedTarget(url)) throw Error('This address is not a supported public webpage.');
      let publicTarget:boolean;
      try{publicTarget=await publicHost(url.hostname,controller.signal,request);}catch{throw Error('Could not look up this website’s address. Retry the download later.');}
      if(!publicTarget)throw Error('This website does not resolve to a supported public address.');
      const response = await request(url, {
        redirect:'manual', signal:controller.signal,
        headers:{Accept:'text/html,application/xhtml+xml', 'User-Agent':'Folio/1.0 (personal reading list)'},
        credentials:'omit',
      });
      if ([301,302,303,307,308].includes(response.status)) {
        const target = response.headers.get('location');
        await response.body?.cancel();
        if (!target) throw Error('The website returned an invalid redirect.');
        url = new URL(target,url); continue;
      }
      if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type') || '')) {
        await response.body?.cancel();
        if(!response.ok)throw Error(response.status===401||response.status===403?'This website refused the download (HTTP '+response.status+'). It may require sign-in or block automated access.':'The website returned HTTP '+response.status+'. Retry later or open the original page.');
        throw Error('This link is not an HTML webpage. Offline text extraction cannot read this file type.');
      }
      const reader = response.body?.getReader(); if (!reader) throw Error('The website returned an empty page.');
      const decoder = new TextDecoder(); let html = '', bytes = 0; const limit = fullArticle ? 2097152 : 262144;
      try {
        while (bytes < limit) {
          const {done,value} = await reader.read(); if(done)break;
          const part = value.subarray(0,limit-bytes); bytes += part.byteLength;
          html += decoder.decode(part,{stream:true});
          if (!fullArticle && /<\/head\s*>/i.test(html)) break;
          if (fullArticle && bytes >= limit) throw Error('The page exceeds the 2 MB download limit. Open the original page to read it.');
        }
        html += decoder.decode();
      } finally { await reader.cancel(); }
      return html;
    }
    throw Error('This webpage redirects too many times.');
  } catch(error) {
    if(reportErrors){
      if(controller.signal.aborted)throw Error('The website did not respond in time. Retry the download later.');
      if(error instanceof TypeError)throw Error('Could not connect to this website. It may block downloads or be temporarily unavailable.');
      throw error;
    }
    /* Metadata is best-effort: never prevent saving a valid link. */
  }
  finally { clearTimeout(timer); }
  return null;
}

export async function fetchPageTitle(raw: string, request: typeof fetch = fetch): Promise<string | null> {
  const html = await fetchPageHtml(raw, request);
  return html ? extractTitle(html) : null;
}
