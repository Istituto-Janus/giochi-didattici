"""Expand Hunspell affixes, then verify every candidate with libhunspell.
No AI-generated words. Output is a finite, versioned game lexicon.
"""
import ctypes, json, pathlib, re, unicodedata, hashlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
lib = ctypes.CDLL('libhunspell-1.7.so.0')
lib.Hunspell_create.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
lib.Hunspell_create.restype = ctypes.c_void_p
lib.Hunspell_spell.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
lib.Hunspell_spell.restype = ctypes.c_int
lib.Hunspell_destroy.argtypes = [ctypes.c_void_p]
manifest = {}
for lang in ['it','en','es','fr','de']:
    aff = ROOT/'lexicons/sources'/f'{lang}.aff'
    dic = aff.with_suffix('.dic')
    lines = aff.read_text().splitlines()
    mode = next((s.split()[1] for s in lines if s.startswith('FLAG ')), 'short')
    def flags(s):
        return s.split(',') if mode == 'num' else [s[i:i+2] for i in range(0,len(s),2)] if mode == 'long' else list(s)
    rules = {}; cross = {}; special = {}
    for line in lines:
        p = line.split()
        if not p: continue
        if p[0] in ['FORBIDDENWORD','ONLYINCOMPOUND','NEEDAFFIX']: special[p[0]] = p[1]
        if p[0] not in ['PFX','SFX']: continue
        if len(p) == 4: cross[(p[0],p[1])] = p[2] == 'Y'; continue
        if len(p) < 5: continue
        kind,flag,strip,addition,condition = p[:5]
        addition,_,continuation = addition.partition('/')
        try: regex = re.compile(('^'+condition) if kind == 'PFX' else (condition+'$'))
        except re.error: continue
        rules.setdefault(flag,[]).append((kind, '' if strip=='0' else strip, '' if addition=='0' else addition, regex, flags(continuation)))
    h = lib.Hunspell_create(str(aff).encode(),str(dic).encode())
    accepted = set()
    def collect(word):
        n = unicodedata.normalize('NFC',word.lower())
        if 3 <= len(n) <= 6 and n.isalpha() and lib.Hunspell_spell(h,word.encode()): accepted.add(n)
    for line in dic.read_text().splitlines()[1:]:
        entry = line.split('\t')[0].split(' ')[0]
        stem,_,f = entry.partition('/')
        fs = flags(f)
        if special.get('FORBIDDENWORD') in fs or special.get('ONLYINCOMPOUND') in fs: continue
        # Proper names excluded outside German (capitalized nouns are mandatory).
        if lang != 'de' and stem != stem.lower(): continue
        if len(stem)>16: continue
        collect(stem)
        frontier = [(stem,fs,None)]
        seen = set()
        for depth in range(3):
            nxt=[]
            for word, available, previous in frontier:
                for flag in available:
                    for kind,strip,add,regex,cont in rules.get(flag,[]):
                        if previous and kind != previous and not cross.get((kind,flag),False): continue
                        if not regex.search(word): continue
                        if kind=='SFX':
                            if strip and not word.endswith(strip): continue
                            derived=(word[:-len(strip)] if strip else word)+add
                        else:
                            if strip and not word.startswith(strip): continue
                            derived=add+(word[len(strip):] if strip else word)
                        if len(derived)>12: continue
                        collect(derived)
                        further = cont + [f2 for f2 in fs if any(r[0]!=kind for r in rules.get(f2,[])) and cross.get((kind,flag),False)]
                        key=(derived,tuple(further),kind)
                        if further and key not in seen: seen.add(key);nxt.append((derived,further,kind))
            frontier=nxt
            if not frontier: break
    lib.Hunspell_destroy(h)
    words=sorted(accepted)
    out=ROOT/'lexicons'/f'{lang}.json';out.write_text(json.dumps(words,ensure_ascii=False,separators=(',',':')))
    manifest[lang]={'words':len(words),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'source_sha256':hashlib.sha256(dic.read_bytes()+aff.read_bytes()).hexdigest()}
    print(lang,len(words),flush=True)
(ROOT/'lexicons/manifest.json').write_text(json.dumps(manifest,indent=2))
(ROOT/'lexicons/words.js').write_text('export const lexicons = '+json.dumps({l:json.loads((ROOT/'lexicons'/f'{l}.json').read_text()) for l in manifest},ensure_ascii=False,separators=(',',':'))+';\n')
