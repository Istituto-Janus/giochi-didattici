import fs from 'node:fs';
import {lexicons} from '../lexicons/words.js';
const catalogue={};
for(const [language,words] of Object.entries(lexicons)){
 const index=new Map();for(const w of words){const k=Array.from(w).sort().join('');index.set(k,(index.get(k)||0)+1);}
 const seen=new Set(),entries=[];
 for(const word of words){
  if(Array.from(word).length!==6)continue;
  const letters=Array.from(word).sort().join('');if(seen.has(letters))continue;seen.add(letters);
  const chars=Array.from(letters),keys=new Set();
  for(let mask=0;mask<64;mask++){const k=chars.filter((_,i)=>mask&(1<<i));if(k.length>=3)keys.add(k.join(''));}
  const count=Array.from(keys).reduce((sum,k)=>sum+(index.get(k)||0),0);
  if(count>=5)entries.push({letters,count});
 }
 entries.sort((a,b)=>b.count-a.count);catalogue[language]=entries.slice(0,600);
 console.log(language,'automatic combinations',catalogue[language].length,'max words',entries[0]?.count);
}
fs.writeFileSync(new URL('../lexicons/catalogue.js',import.meta.url),'export const catalogue = '+JSON.stringify(catalogue)+';\n');
