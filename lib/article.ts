import {parse, type DefaultTreeAdapterMap} from 'parse5';
import {extractTitle} from './page-title';
type Node=DefaultTreeAdapterMap['node'];
export type ArticleBlock={kind:'heading'|'paragraph'|'list'|'quote'|'code';text:string};
const skip=new Set(['script','style','template','noscript','svg','nav','header','footer','aside','form','button','iframe','video','audio']);
function ignored(n:Node):boolean {
 if(!('tagName' in n))return false;
 const attrs=Object.fromEntries(n.attrs.map(a=>[a.name,a.value]));
 return skip.has(n.tagName)||'hidden' in attrs||attrs['aria-hidden']==='true'||/navigation|banner|contentinfo/.test(attrs.role||'')||/(^|[\s_-])(cookie|advert|advertisement|social|share|related|paywall|subscribe|newsletter)([\s_-]|$)/i.test((attrs.id||'')+' '+(attrs.class||''));
}
function text(n:Node):string {if(ignored(n))return '';if('value' in n)return n.value;if('tagName' in n&&n.tagName==='br')return '\n';return 'childNodes' in n?n.childNodes.map(text).join(''):'';}
export function extractArticle(html:string) {
 const tree=parse(html);const candidates:Node[]=[];let body:Node=tree;
 function find(n:Node){if(ignored(n))return;if('tagName'in n){if(n.tagName==='body')body=n;if(n.tagName==='article'||n.tagName==='main'||n.attrs.some(a=>a.name==='role'&&a.value==='main'))candidates.push(n);}if('childNodes'in n)n.childNodes.forEach(find);}
 find(tree);
 // Prefer a semantic article/main region; use body for traditional article pages.
 const root=candidates.sort((a,b)=>text(b).length-text(a).length)[0]||body;
 const blocks:ArticleBlock[]=[];
 function walk(n:Node){
  if(ignored(n))return;
  if('tagName'in n&&/^(h[1-6]|p|li|blockquote|pre)$/.test(n.tagName)){
   const value=(n.tagName==='pre'?text(n).trim():text(n).replace(/\s+/g,' ').trim());
   if(value)blocks.push({kind:/^h/.test(n.tagName)?'heading':n.tagName==='li'?'list':n.tagName==='blockquote'?'quote':n.tagName==='pre'?'code':'paragraph',text:value});
   return;
  }
  if('childNodes'in n)n.childNodes.forEach(walk);
 }
 walk(root);
 const chars=blocks.reduce((s,b)=>s+b.text.length,0);
 if(chars<200||!blocks.some(b=>b.kind==='paragraph'&&b.text.length>=100))return null;
 if(chars>500000)return null;
 return {title:extractTitle(html),blocks,words:blocks.reduce((s,b)=>s+b.text.split(/\s+/).length,0)};
}
