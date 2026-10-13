import test from 'node:test';
import assert from 'node:assert/strict';
import {lexicons} from '../lexicons/words.js';
import {catalogue} from '../lexicons/catalogue.js';
import {normalize,lettersOf,fits,POINTS} from '../core.js';
import {solutions,validateDraft,createHandler} from '../edge.js';
test('Unicode, multiplicity and scoring',()=>{
 assert.equal(normalize('E\u0301TÉ'),'été');assert.equal(lettersOf(' N i ñ o s x '),'niñosx');
 assert.equal(fits('casa','casare'),true);assert.equal(fits('cassa','casare'),false);
 assert.equal(fits('été','eteabc'),false);assert.equal(fits('straße','strase'),false);
 assert.deepEqual(POINTS,{3:10,4:20,5:30,6:50});
 assert.throws(()=>lettersOf('ab12cd'));assert.throws(()=>lettersOf('abcde'));
});
for(const language of Object.keys(lexicons)){
 test(language+' lexicon and automatic catalogue',()=>{
  const words=lexicons[language];assert.equal(new Set(words).size,words.length);assert.ok(words.length>10000);
  assert.ok(words.every(w=>/^\p{L}{3,6}$/u.test(w)&&w===normalize(w)));
  assert.equal(catalogue[language].length,600);
  for(const item of catalogue[language]){const actual=solutions(language,item.letters);assert.equal(actual.length,item.count);assert.ok(actual.every(w=>fits(w,item.letters)));assert.ok(actual.length>=5);}
 });
}
test('plural, conjugation and accent coverage in five languages',()=>{
 const cases={it:['case','canto','città'],en:['books','eaten'],es:['niños','cantas'],fr:['été','mange','mangés'],de:['häuser','gehen','größer']};
 for(const [language,words] of Object.entries(cases))for(const word of words)assert.ok(lexicons[language].includes(word),language+': '+word);
});
test('server validates draft and recomputes solutions',()=>{
 const item=catalogue.it[0];const d=validateDraft({title:' Test ',language:'it',letters:item.letters,target:500,duration:null,retries:true,solutions:['invented'],score:999});
 assert.equal(d.title,'Test');assert.equal(d.target,d.solutions.length);assert.ok(!d.solutions.includes('invented'));
 assert.throws(()=>validateDraft({...d,duration:0}));assert.throws(()=>validateDraft({...d,retries:'true'}));
});
test('API rejects forged score, missing capabilities and malformed inputs',async()=>{
 const calls=[];const handler=createHandler({},async(...args)=>{calls.push(args);return {ok:true};});
 const request=b=>handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(b)}));
 assert.equal((await request({op:'create',payload:{}})).status,403);
 assert.equal((await request({op:'word',session_token:'a'.repeat(64),payload:{word:'casa',score:999}})).status,400);
 assert.equal((await request({op:'word',session_token:'bad',payload:{word:'casa'}})).status,403);
 assert.equal((await request({op:'game',payload:{id:"x';drop table"}})).status,400);
 assert.equal(calls.length,0);
 const r=await request({op:'generate',teacher_token:'b'.repeat(64),payload:{language:'it',target:15}});assert.equal(r.status,200);const b=await r.json();assert.ok(b.solutions.length>=15);assert.ok(b.solutions.every(w=>fits(w,b.letters)));
 assert.equal(calls.length,1);assert.match(calls[0][2],/^[a-f0-9]{64}$/);
});
