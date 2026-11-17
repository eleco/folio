// Public sharing is deliberately stricter than saving a private bookmark.
export function communityURL(raw:string):string {
 const url=new URL(raw);
 const host=url.hostname.toLowerCase();
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||!host.includes('.')||host.includes(':')||/^\d+(\.\d+)*$/.test(host)||/(^|\.)(localhost|local|internal|home|lan|test|invalid|onion)$/.test(host))throw Error('Only ordinary public webpage addresses can be shared.');
 // Strip known marketing parameters, but retain content identifiers such as ?id=.
 for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||/^(fbclid|gclid|dclid|msclkid|mc_cid|mc_eid)$/i.test(key))url.searchParams.delete(key);
 if([...url.searchParams.keys()].some(key=>/token|secret|password|passwd|session|auth|signature|credential|api.?key|email|code|invite|key/i.test(key))||/\/(login|signin|account|settings|reset|invite|private|dashboard|admin)(\/|$)/i.test(url.pathname)||url.pathname.split('/').some(part=>part.length>80))throw Error('This looks like a private or access-token link. Keep it in your private list.');
 url.hash='';url.searchParams.sort();return url.href.split('#')[0];
}
