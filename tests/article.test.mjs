import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/article.ts',import.meta.url),'utf8').replace("'./page-title'",JSON.stringify(new URL('../lib/page-title.ts',import.meta.url).href));
const resolvedSource=source.replace("'parse5'",JSON.stringify(import.meta.resolve('parse5')));
const compiled=ts.transpileModule(resolvedSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {extractArticle}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const paragraph='This is a substantial paragraph about a useful topic. It has enough content to be read away from a network, with sentences that keep the meaning of the original article intact. ';
test('extracts inert text, entities, headings and lists; omits navigation and scripts',()=>{
 const a=extractArticle(`<title>A &amp; B</title><nav><p>Navigation</p></nav><article><h1>The heading</h1><p>${paragraph}&lt;script&gt; literal text</p><h2>Section</h2><ul><li>First item</li></ul><p>${paragraph}</p><script>alert('evil')</script></article><footer>footer</footer>`);
 assert.equal(a.title,'A & B');assert.equal(a.blocks[0].kind,'heading');assert(a.blocks.some(b=>b.kind==='list'));
 assert(a.blocks.some(b=>b.text.includes('<script> literal text')));assert(!JSON.stringify(a).includes('Navigation'));assert(!JSON.stringify(a).includes("alert('evil')"));
});
test('rejects empty and login-only pages',()=>{assert.equal(extractArticle('<p>Log in to read</p>'),null);assert.equal(extractArticle('<script>document.write("article")</script>'),null)});
test('traditional article body and hidden boilerplate',()=>{const a=extractArticle(`<body><div hidden><p>secret</p></div><p>${paragraph}</p><p>${paragraph}</p></body>`);assert(a);assert(!JSON.stringify(a).includes('secret'))});
