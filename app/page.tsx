import Folio from './folio';
import {getChatGPTUser,chatGPTSignInPath} from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const user=await getChatGPTUser();if(user)return <Folio/>;
 const params=await searchParams;const query=new URLSearchParams();for(const key of ['save','url','title'])if(typeof params?.[key]==='string')query.set(key,params[key] as string);
 const signIn=chatGPTSignInPath('/'+(query.size?'?'+query.toString():''));
 return <main className="welcome"><a className="brand" href="/">▱ folio<span>READ LATER, TOGETHER</span></a><span className="eyebrow">A HOME FOR YOUR NEXT GOOD READ</span><h1>Save for yourself.<br/>Discover with others.</h1><p>Keep a private reading list, take article text offline, and find the reads our community is sharing.</p><a className="primary" target="_top" href={signIn}>Sign in with ChatGPT ↗</a><p className="hint">Use your existing ChatGPT account. Every save starts private.</p><div className="welcome-features"><section><h2>Your own quiet corner.</h2><p>Your saved links and archive belong to you. Nobody else can browse your list.</p></section><section><h2>Something worth sharing.</h2><p>Choose which public articles you contribute to Trending. Only article titles, links and aggregate counts appear.</p></section><section><h2>A little reading, anywhere.</h2><p>Open Folio online on your phone to prepare offline text copies. Downloads stay in that browser.</p></section></div></main>;
}
