import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../chatgpt-auth';
import {fetchPageTitle,validatePublicPage} from '../../../lib/page-title';
import {apiJson,linkAPI} from '../../../lib/link-service';
export const dynamic='force-dynamic';
async function handle(req:Request){try{const user=await getChatGPTUser();return await linkAPI(req,user?.userId||null,env.DB!,fetchPageTitle,validatePublicPage);}catch{return apiJson({error:'Could not save your change. Please try again.'},500);}}
export const GET=handle;
export const POST=handle;
