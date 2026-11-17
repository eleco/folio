import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {apiJson,trendingAPI} from '../../../lib/link-service';
export const dynamic='force-dynamic';
export async function GET(){try{return await trendingAPI((await getChatGPTUser())?.userId||null,env.DB!);}catch{return apiJson({error:'Could not load trending articles. Please retry.'},500);}}
