import {lexicons} from './lexicons/words.js';
import {catalogue} from './lexicons/catalogue.js';
import {LANGUAGES,normalize,lettersOf,fits} from './core.js';
const indexes=Object.fromEntries(LANGUAGES.map(l=>{
 const index=new Map();for(const w of lexicons[l]){const k=Array.from(w).sort().join('');if(!index.has(k))index.set(k,[]);index.get(k).push(w);}return [l,index];
}));
export function solutions(language,letters){
 const chars=Array.from(letters),keys=new Set(),out=[];
 for(let mask=0;mask<64;mask++){
  const subset=chars.filter((_,i)=>mask&(1<<i));if(subset.length<3)continue;
  keys.add(subset.sort().join(''));
 }
 for(const k of keys)out.push(...(indexes[language].get(k)||[]));
 return out.sort((a,b)=>Array.from(a).length-Array.from(b).length||a.localeCompare(b,language));
}
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const validToken=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const validId=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const fail=(error,status=400)=>Object.assign(new Error(error),{status});
export function validateDraft(p){
 if(!LANGUAGES.includes(p.language))throw fail('language');
 const letters=lettersOf(p.letters),words=solutions(p.language,letters);
 if(!words.length)throw fail('no_solutions');
 const title=typeof p.title==='string'?p.title.trim():'';
 if(!title||title.length>120)throw fail('title');
 if(!Number.isInteger(p.target)||p.target<1||p.target>500)throw fail('target');
 if(p.duration!==null&&(!Number.isInteger(p.duration)||p.duration<10||p.duration>3600))throw fail('duration');
 if(typeof p.retries!=='boolean')throw fail('retries');
 return {title,language:p.language,letters,target:Math.min(p.target,words.length),duration:p.duration,retries:p.retries,solutions:words,lexicon_version:'hunspell-jwc-2026-10-13-v1'};
}
export function createHandler(env,rpcOverride){
 const rpc=rpcOverride|| (async (op,p,actor,ip_hash)=>{
  const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/jwc_dispatch',{
   method:'POST',headers:{'Content-Type':'application/json',apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},
   body:JSON.stringify({op,p,actor,ip_hash})
  });
  if(!r.ok){console.error('JWC database operation failed',op,r.status);throw fail('database_error',503);}
  return r.json();
 });
 return async req=>{
  const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json;charset=utf-8','X-Content-Type-Options':'nosniff'};
  const respond=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:cors});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return respond({error:'method'},405);
  try{
   const raw=await req.text();if(raw.length>8192)throw fail('too_large',413);
   const b=JSON.parse(raw);if(!b||typeof b!=='object'||Array.isArray(b))throw fail('invalid_request');
   const op=b.op,p=b.payload||{};
   if(!['bootstrap','generate','preview','create','archive','game','rename','delete','register','start','word','state','finish','solutions'].includes(op))throw fail('invalid_operation');
   if(!p||typeof p!=='object'||Array.isArray(p))throw fail('invalid_request');
   // A capability grants only its own games; no shared teacher password.
   const adminOps=['generate','preview','create','archive','rename','delete','register'];
   if(adminOps.includes(op)&&!validToken(b.teacher_token))throw fail('teacher_key',403);
   let actor=validToken(b.teacher_token)?await hash(b.teacher_token):'';
   const forwarded=req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'unknown';
   const ip=await hash(forwarded.split(',')[0].trim());
   let payload={},plainToken;
   if(['game','rename','delete','register','start'].includes(op)){if(!validId(p.id))throw fail('game_id');payload.id=p.id;}
   if(['state','word','finish','solutions'].includes(op)){
    if(!validToken(b.session_token))throw fail('session_key',403);
    payload.token_hash=await hash(b.session_token);
   }
   if(op==='create')payload=validateDraft(p);
   if(op==='preview'){
    if(!LANGUAGES.includes(p.language))throw fail('language');
    payload={language:p.language,letters:lettersOf(p.letters)};
   }
   if(op==='generate'){
    if(!LANGUAGES.includes(p.language)||!Number.isInteger(p.target)||p.target<1||p.target>500)throw fail('target');
    payload={language:p.language,target:p.target};
   }
   if(op==='rename'){
    if(typeof p.title!=='string'||!p.title.trim()||p.title.trim().length>120)throw fail('title');payload.title=p.title.trim();
   }
   if(op==='register'){if(p.offset!==undefined&&(!Number.isInteger(p.offset)||p.offset<0))throw fail('offset');payload.offset=p.offset||0;}
   if(op==='start'){
    if(typeof p.nickname!=='string')throw fail('nickname');
    const nickname=p.nickname.normalize('NFC').trim().replace(/\s+/g,' ');
    if(Array.from(nickname).length<1||Array.from(nickname).length>32||/[\p{Cc}\p{Cf}<>]/u.test(nickname))throw fail('nickname');
    plainToken=token();payload={...payload,nickname,nickname_key:normalize(nickname),token_hash:await hash(plainToken)};
   }
   if(op==='word'){
    if('score' in p)throw fail('invalid_request');
    if(typeof p.word!=='string'||!/^\p{L}{3,6}$/u.test(normalize(p.word)))throw fail('invalid_word',422);
    payload.word=normalize(p.word);
   }
   const data=await rpc(op,payload,actor,ip);
   if(data.error)return respond(data,data.status||400);
   if(op==='bootstrap')return respond({teacher_token:token()});
   if(op==='preview')return respond({letters:payload.letters,solutions:solutions(payload.language,payload.letters)});
   if(op==='generate'){
    const options=catalogue[p.language].filter(c=>c.count>=Math.max(5,p.target));
    if(!options.length)return respond({error:'target_unavailable',maximum:Math.max(...catalogue[p.language].map(c=>c.count))},422);
    const selected=options[crypto.getRandomValues(new Uint32Array(1))[0]%options.length];
    const chars=Array.from(selected.letters);for(let i=5;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}
    const letters=chars.join('');return respond({letters,solutions:solutions(p.language,letters)});
   }
   if(op==='start')data.session_token=plainToken;
   return respond(data);
  }catch(e){return respond({error:e.status?e.message:e instanceof SyntaxError?'invalid_json':'invalid_request'},e.status||400);}
 };
}
// The gateway requires the existing project's public anon JWT. Database RPC is
// service-only; the runtime supplies the service key, never the browser.
if(typeof Deno!=='undefined')Deno.serve(createHandler({SUPABASE_URL:Deno.env.get('SUPABASE_URL'),SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
