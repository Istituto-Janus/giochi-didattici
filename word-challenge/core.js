export const LANGUAGES = ['it','en','es','fr','de'];
export function normalize(word) { return String(word).normalize('NFC').toLowerCase(); }
export function lettersOf(value) {
 const letters=normalize(value).replace(/\s/g,'');
 if(Array.from(letters).length!==6 || !/^\p{L}{6}$/u.test(letters)) throw new Error('six_letters');
 return letters;
}
export function fits(word,letters) {
 const remaining=Array.from(letters);
 for(const c of Array.from(word)){const i=remaining.indexOf(c);if(i<0)return false;remaining.splice(i,1);}
 return Array.from(word).length>=3 && Array.from(word).length<=6;
}
export function solve(words,letters){return words.filter(w=>fits(w,letters));}
export const POINTS={3:10,4:20,5:30,6:50};
