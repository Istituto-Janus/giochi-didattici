import json, pathlib, re, urllib.request, urllib.error, time, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
config=(ROOT/'public/config.js').read_text()
URL=re.search("API_URL='([^']+)'",config).group(1)
KEY=re.search("API_KEY='([^']+)'",config).group(1)
WORK=pathlib.Path('/tmp/jwc-tests'); WORK.mkdir(exist_ok=True)
results=[]
def call(op,payload=None,teacher=None,session=None,expected=200):
 data=json.dumps({'op':op,'payload':payload or {},'teacher_token':teacher,'session_token':session}).encode()
 req=urllib.request.Request(URL,data=data,headers={'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY})
 try:
  with urllib.request.urlopen(req,timeout=30) as r: status=r.status;body=json.load(r)
 except urllib.error.HTTPError as e:status=e.code;body=json.load(e)
 assert status==expected,(op,status,body)
 return body
def check(label):results.append(label);print('PASS',label,flush=True)
teacher=call('bootstrap')['teacher_token']
other=call('bootstrap')['teacher_token']
demo=None
for language in ['it','en','es','fr','de']:
 generated=call('generate',{'language':language,'target':15},teacher)
 assert len(generated['solutions'])>=15
 preview=call('preview',{'language':language,'letters':generated['letters']},teacher)
 assert generated['solutions']==preview['solutions']
 game=call('create',{'language':language,'letters':generated['letters'],'title':'Collaudo JWC · '+language,'target':15,'duration':None,'retries':True},teacher)
 gid=game['id'];public=call('game',{'id':gid});assert 'solutions' not in public
 attempt=call('start',{'id':gid,'nickname':'Collaudo '+language});session=attempt['session_token']
 call('solutions',session=session,expected=403)
 call('word',{'word':'zzzzzz'},session=session,expected=422)
 score=0;selected=[]
 for length,points in [(3,10),(4,20),(5,30),(6,50)]:
  word=next((w for w in preview['solutions'] if len(w)==length),None)
  if word:
   score+=points;answer=call('word',{'word':word.upper()},session=session);assert answer['score']==score;selected.append(word)
 assert len(selected)>=3
 call('word',{'word':selected[0]},session=session,expected=409)
 call('word',{'word':selected[0],'score':999999},session=session,expected=400)
 final=call('finish',session=session);assert final['score']==score and final['finished'] and final['rank']==1
 assert call('finish',session=session)['score']==score
 solution=call('solutions',session=session);assert solution['solutions']==preview['solutions']
 register=call('register',{'id':gid},teacher);assert register['results'][0]['score']==score and register['results'][0]['words']==len(selected)
 call('register',{'id':gid},other,expected=403);call('rename',{'id':gid,'title':'Unauthorized'},other,expected=403);call('delete',{'id':gid},other,expected=403)
 retry=call('start',{'id':gid,'nickname':('Collaudo '+language).upper()})
 call('finish',session=retry['session_token'])
 board=call('game',{'id':gid})['leaderboard'];assert len(board)==1 and board[0]['score']==score
 call('rename',{'id':gid,'title':'Janus Word Challenge · '+language.upper()},teacher)
 assert call('game',{'id':gid})['title'].endswith(language.upper())
 check(language+': generation, manual preview, scores, duplicates, solutions, persistence, rank, best result, ownership, rename')
 if language=='it':demo=gid
 else:
  call('delete',{'id':gid},teacher);call('game',{'id':gid},expected=404);call('state',session=session,expected=404)
generated=call('generate',{'language':'it','target':15},teacher)
timer=call('create',{'language':'it','letters':generated['letters'],'title':'Collaudo timer','target':15,'duration':10,'retries':False},teacher)['id']
attempt=call('start',{'id':timer,'nickname':'Timer Test'});session=attempt['session_token']
call('start',{'id':timer,'nickname':'timer test'},expected=409)
time.sleep(11)
answer=call('word',{'word':generated['solutions'][0]},session=session);assert answer['finished'] and answer['score']==0
assert call('solutions',session=session)['solutions']==generated['solutions']
call('delete',{'id':timer},teacher)
check('Server deadline, late word rejection, retry restriction and game deletion')
req=urllib.request.Request(URL.replace('/functions/v1/janus-word-challenge','/rest/v1/rpc/jwc_dispatch'),data=json.dumps({'op':'archive','p':{},'actor':'','ip_hash':''}).encode(),headers={'Content-Type':'application/json','apikey':KEY,'Authorization':'Bearer '+KEY})
try: urllib.request.urlopen(req);raise AssertionError('Anonymous RPC access allowed')
except urllib.error.HTTPError as e:assert e.code in [401,403]
check('Anonymous direct database RPC denied')
saved={'demo_id':demo,'passed':results,'test_date':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
pathlib.Path(str(WORK/'live-report.json')).write_text(json.dumps(saved,indent=2))
# Private fixture capability kept outside deliverables/repository and omitted from logs.
pathlib.Path(str(WORK/'test-owner.json')).write_text(json.dumps({'teacher_token':teacher,'demo_id':demo}))
