const SUPABASE_URL = String(window.CLIMATE_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_PUBLISHABLE_KEY = String(window.CLIMATE_CONFIG?.SUPABASE_PUBLISHABLE_KEY || "");
const API_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/climate-api` : "";

const CLIMATES = [
  {id:"tropical",name:"열대",icon:"🌴",tone:"#0b725b",story:"뜨거운 햇빛과 많은 비가 만드는 숲에서 첫 번째 코어를 찾아요."},
  {id:"dry",name:"건조",icon:"🏜️",tone:"#8a5b28",story:"비가 적은 땅에서 사람들이 물을 지혜롭게 쓰는 방법을 찾아요."},
  {id:"temperate",name:"온대",icon:"🌳",tone:"#3b7046",story:"뚜렷한 계절 속에서 달라지는 사람들의 생활을 관찰해요."},
  {id:"continental",name:"냉대",icon:"🌲",tone:"#285f6d",story:"긴 겨울과 침엽수림이 펼쳐진 마을의 비밀을 풀어요."}
];

const QUESTIONS = {
  tropical:[
    {id:"열대_01",q:"열대 기후 지역의 전통 가옥을 땅에서 띄워 짓는 까닭은 무엇일까요?",choices:["강한 추위를 막기 위해","습기와 해충을 피하기 위해","눈이 쌓이지 않게 하려고","바람을 완전히 막으려고"],answer:1,explain:"고상 가옥은 많은 비로 인한 습기와 해충을 피하고 바람이 잘 통하게 해요."},
    {id:"열대_02",q:"열대 우림을 지키면서 생활하는 태도로 가장 알맞은 것은?",choices:["숲을 모두 농지로 바꾼다","필요한 만큼만 이용하고 다시 심는다","큰 나무부터 모두 벤다","야생 동물을 다른 곳으로 보낸다"],answer:1,explain:"숲의 자원을 필요한 만큼 이용하고 복원해야 생태계와 생활이 함께 이어져요."}
  ],
  dry:[
    {id:"건조_01",q:"건조 기후 지역에서 사람들이 오아시스 주변에 모여 사는 까닭은?",choices:["석탄이 많아서","나무가 울창해서","물을 얻을 수 있어서","항상 기온이 낮아서"],answer:2,explain:"비가 매우 적은 건조 지역에서는 물을 얻을 수 있는 오아시스가 생활의 중심이 돼요."},
    {id:"건조_02",q:"건조 지역에서 물을 아끼는 농업 방법으로 알맞은 것은?",choices:["물을 계속 흘려보낸다","점적 관개로 뿌리에 조금씩 준다","비가 올 때까지 농사를 멈춘다","논을 넓게 만든다"],answer:1,explain:"점적 관개는 작물의 뿌리에 필요한 물만 공급해 물 낭비를 줄여요."}
  ],
  temperate:[
    {id:"온대_01",q:"온대 기후 지역에서 계절에 따라 옷차림과 생활 모습이 달라지는 까닭은?",choices:["계절별 기온과 강수량이 달라서","일 년 내내 몹시 더워서","비가 전혀 오지 않아서","낮과 밤이 없어서"],answer:0,explain:"온대 기후는 계절 변화가 뚜렷해 농사, 옷차림, 여가 활동도 계절에 따라 달라져요."},
    {id:"온대_02",q:"온대 기후가 벼농사와 여러 작물 재배에 유리한 까닭은?",choices:["땅이 늘 얼어 있어서","적당한 기온과 강수량이 있어서","사막이 넓어서","일 년 내내 눈이 내려서"],answer:1,explain:"비교적 온화한 기온과 알맞은 비는 다양한 농작물이 자라기 좋은 조건이에요."}
  ],
  continental:[
    {id:"냉대_01",q:"냉대 기후 지역에 침엽수림이 넓게 나타나는 까닭은?",choices:["잎이 넓어 눈을 많이 받으려고","추위에 견디고 수분 손실을 줄일 수 있어서","더운 날씨에만 잘 자라서","바닷물에서 자랄 수 있어서"],answer:1,explain:"바늘 모양의 잎과 원뿔형 나무 모양은 춥고 눈이 많은 환경을 견디는 데 유리해요."},
    {id:"냉대_02",q:"냉대 기후의 침엽수림과 관계 깊은 산업은?",choices:["목재·펄프 산업","열대 과일 농업","산호 채취업","올리브 농업"],answer:0,explain:"넓은 침엽수림을 바탕으로 목재, 종이와 펄프 산업이 발달했어요."}
  ],
  boss:[
    {id:"보스_01",climate:"종합",q:"자연환경과 사람들의 생활 관계를 설명한 것으로 알맞은 것은?",choices:["환경은 생활에 아무 영향이 없다","사람은 환경에 적응하고 환경을 이용한다","모든 지역의 생활 모습은 같다","기후만으로 모든 문화가 결정된다"],answer:1,explain:"사람들은 자연환경에 적응하고 이용하며, 기술과 문화에 따라 다양한 생활 모습을 만들어요."},
    {id:"보스_02",climate:"종합",q:"기후 위기를 줄이는 탐험대의 행동으로 가장 알맞은 것은?",choices:["필요 없는 전등도 켜 둔다","가까운 거리도 자동차만 이용한다","에너지 사용을 줄이고 대중교통을 이용한다","일회용품을 더 많이 쓴다"],answer:2,explain:"에너지를 절약하고 대중교통을 이용하면 온실가스 배출을 줄이는 데 도움이 돼요."},
    {id:"보스_03",climate:"종합",q:"서로 다른 기후 지역의 생활 모습을 존중해야 하는 까닭은?",choices:["모두 같은 방식으로 살아야 해서","환경과 문화에 맞춰 형성된 삶의 방식이기 때문에","관광객만을 위한 모습이어서","과거에는 기후가 없었기 때문에"],answer:1,explain:"생활 모습은 환경에 대한 적응과 오랜 문화가 함께 만든 결과이므로 다양성을 존중해야 해요."}
  ]
};

const CHARACTERS=[{name:"루미",avatar:"🧭",skill:"관찰력이 뛰어난 길잡이"},{name:"가온",avatar:"🌱",skill:"생명을 아끼는 수호자"},{name:"누리",avatar:"🔭",skill:"호기심 많은 연구자"}];
const defaultSettings={rankingEnabled:true,rankingLimit:10,rankingMode:"best",nameMode:"nickname",questionCount:11,regionCount:4,bossCount:3};
let settings={...defaultSettings};
let state={};

const $=(s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];
function newSessionId(){return crypto.randomUUID?crypto.randomUUID():`g-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`}
function resetState(){state={gameSessionId:newSessionId(),profile:null,character:null,level:1,exp:0,gold:0,hp:5,visited:[],responses:[],wrong:0,startedAt:0,currentClimate:null,currentQuestions:[],questionIndex:0,attempts:0,firstChoice:"",answerLocked:false,bossComplete:false,result:null}}
function screen(id){$$('.screen').forEach(el=>el.classList.toggle('active',el.id===`screen-${id}`));$('#hud').classList.toggle('hidden',!["map","quiz"].includes(id));window.scrollTo({top:0,behavior:"smooth"})}
function updateHud(){$('#hud-level').textContent=state.level;$('#hud-hp').textContent=state.hp;$('#hud-exp').textContent=state.exp;$('#hud-gold').textContent=state.gold}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400)}
function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function formatTime(s){s=Math.max(0,Math.round(Number(s)||0));return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}

function renderCharacters(){ $('#character-list').innerHTML=CHARACTERS.map((c,i)=>`<button class="character-card" data-character="${i}"><span class="avatar">${c.avatar}</span><b>${c.name}</b><small>${c.skill}</small></button>`).join("") }
function renderMap(){
  const nextIndex=state.visited.length;
  $('#climate-map').innerHTML=CLIMATES.map((c,i)=>{const done=state.visited.includes(c.id),locked=i>nextIndex;return `<button class="climate-card ${done?'done':''} ${locked?'locked':''}" style="--tone:${c.tone}" data-climate="${c.id}" ${done||locked?'disabled':''}><span class="state">${done?'✓':locked?'🔒':'→'}</span><span class="icon">${c.icon}</span><h3>${c.name} 기후</h3><p>${done?'코어 회복 완료':c.story}</p></button>`}).join("");
  const done=state.visited.length;$('#map-progress').textContent=`${done} / 4 완료`;$('#map-progress-bar').style.width=`${done/4*100}%`;
  const boss=$('#boss-button');boss.disabled=done<4;boss.textContent=done<4?`🔒 ${4-done}개 기후 코어가 더 필요합니다`:`⚡ 최종 미션 시작하기`;
}
function startClimate(id){const c=CLIMATES.find(x=>x.id===id);if(!c||state.visited.includes(id))return;state.currentClimate=id;state.currentQuestions=QUESTIONS[id];state.questionIndex=0;state.attempts=0;screen('quiz');renderQuestion()}
function startBoss(){if(state.visited.length<4)return;state.currentClimate="boss";state.currentQuestions=QUESTIONS.boss.slice(0,settings.bossCount);state.questionIndex=0;state.attempts=0;screen('quiz');renderQuestion()}
function renderQuestion(){
  state.answerLocked=false;state.attempts=0;state.firstChoice="";const q=state.currentQuestions[state.questionIndex];const climate=state.currentClimate==="boss"?{name:"최종 미션",icon:"⚡",story:"모은 기후 코어의 힘으로 지구를 구하세요!"}:CLIMATES.find(c=>c.id===state.currentClimate);
  $('#quiz-climate').textContent=`${climate.icon} ${climate.name}`;$('#quiz-count').textContent=`${state.questionIndex+1} / ${state.currentQuestions.length}`;$('#quiz-progress').style.width=`${(state.questionIndex+1)/state.currentQuestions.length*100}%`;$('#quiz-story').textContent=climate.story;$('#quiz-question').textContent=q.q;
  $('#quiz-choices').innerHTML=q.choices.map((x,i)=>`<button class="choice" data-choice="${i}"><b>${String.fromCharCode(65+i)}.</b> ${escapeHtml(x)}</button>`).join("");$('#quiz-feedback').classList.add('hidden');$('#quiz-next').classList.add('hidden');
}
function chooseAnswer(index){
  if(state.answerLocked)return;const q=state.currentQuestions[state.questionIndex];const btns=$$('.choice');state.attempts++;if(state.attempts===1)state.firstChoice=q.choices[index];
  if(index!==q.answer){state.wrong++;state.hp=Math.max(1,state.hp-1);btns[index].classList.add('wrong');btns[index].disabled=true;$('#quiz-feedback').innerHTML=`💡 다시 생각해 보세요. 단서를 찾아 정답을 골라 보세요.`;$('#quiz-feedback').classList.remove('hidden');updateHud();return}
  state.answerLocked=true;btns[index].classList.add('correct');btns.forEach(b=>b.disabled=true);state.exp+=10;state.gold+=5;if(state.exp>=state.level*30)state.level++;updateHud();
  state.responses.push({questionId:q.id,climate:state.currentClimate==="boss"?(q.climate||"종합"):CLIMATES.find(c=>c.id===state.currentClimate).name,firstChoice:state.firstChoice,correctAnswer:q.choices[q.answer],firstTry:state.attempts===1,wrongCount:state.attempts-1});
  $('#quiz-feedback').innerHTML=`✅ <b>정답!</b> ${q.explain}`;$('#quiz-feedback').classList.remove('hidden');$('#quiz-next').classList.remove('hidden');$('#quiz-next').textContent=state.questionIndex===state.currentQuestions.length-1?(state.currentClimate==="boss"?'결과 확인하기 →':'지도에서 다음 지역 찾기 →'):'다음 문제 →';
}
function nextQuestion(){if(!state.answerLocked)return;if(++state.questionIndex<state.currentQuestions.length){renderQuestion();return}if(state.currentClimate==="boss"){state.bossComplete=true;finishGame()}else{state.visited.push(state.currentClimate);state.currentClimate=null;renderMap();screen('map');toast('기후 코어를 회복했어요! +10 EXP') }}

function calculateResult(){
  const total=state.responses.length;const first=state.responses.filter(r=>r.firstTry).length;const accuracy=total?Math.round(first/total*1000)/10:0;const climateScores={tropical:null,dry:null,temperate:null,continental:null,polar:null,alpine:null};
  CLIMATES.forEach(c=>{const rs=state.responses.filter(r=>r.climate===c.name);if(rs.length)climateScores[c.id]=Math.round(rs.filter(r=>r.firstTry).length/rs.length*100)});
  const achievements=["기후 코어 수호자","세계 탐험가"];if(first>=9)achievements.push("한 번에 척척");if(accuracy>=80)achievements.push("기후 박사");if(state.hp>=4)achievements.push("튼튼한 탐험가");if(state.wrong===0)achievements.push("완벽한 관찰자");
  const explorationScore=Math.min(1000,Math.round(accuracy*4+(first/Math.max(1,total))*200+(state.visited.length/4)*150+(state.bossComplete?100:0)+Math.min(achievements.length,5)/5*100+(state.hp/5)*50));
  return {gameSessionId:state.gameSessionId,...state.profile,character:state.character.name,level:state.level,exp:state.exp,gold:state.gold,totalQuestions:total,firstTryCorrect:first,totalWrong:state.wrong,accuracy,visitedClimates:state.visited.map(id=>CLIMATES.find(c=>c.id===id).name),climateScores,achievements,playTime:Math.round((Date.now()-state.startedAt)/1000),completedAt:new Date().toISOString(),remainingHp:state.hp,bossComplete:state.bossComplete,explorationScore,responses:state.responses};
}
function finishGame(){state.result=calculateResult();localStorage.setItem("climatePendingResult",JSON.stringify(state.result));renderResult();screen('result');submitResult()}
function renderResult(){
  const r=state.result;$('#result-subtitle').textContent=`${r.nickname} 탐험대원, 자연환경과 생활의 연결을 멋지게 찾아냈어요.`;
  $('#result-summary').innerHTML=[["탐험 점수",`${r.explorationScore}점`],["정답률",`${Math.round(r.accuracy)}%`],["첫 시도 성공",`${r.firstTryCorrect} / ${r.totalQuestions}`],["탐험 지역",`${r.visitedClimates.length}개`],["획득 업적",`${r.achievements.length}개`]].map(x=>`<div class="stat"><small>${x[0]}</small><b>${x[1]}</b></div>`).join("");
  $('#achievement-list').innerHTML=r.achievements.map(a=>`<span class="badge">${escapeHtml(a)}</span>`).join("");
  const good=[],review=[];CLIMATES.forEach(c=>{const s=r.climateScores[c.id];(s>=75?good:review).push(`${c.icon} ${c.name} 기후 ${s}%`)});$('#learning-summary').innerHTML=`<div class="learning-item"><b>잘 이해한 기후</b><br>${good.join(" · ")||"다음 탐험에서 찾아봐요"}</div><div class="learning-item"><b>다시 살펴볼 기후</b><br>${review.join(" · ")||"모든 기후를 잘 이해했어요!"}</div>`;
  $('#ranking-button').classList.toggle('hidden',!settings.rankingEnabled);$('#retry-submit').classList.add('hidden');
}
async function api(action,data={}){if(!API_URL||!SUPABASE_PUBLISHABLE_KEY)return localApi(action,data);const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},body:JSON.stringify({action,...data})});const json=await res.json().catch(()=>({success:false,message:`서버 응답 오류 (${res.status})`}));if(!res.ok||!json.success)throw new Error(json.message||`서버 응답 오류 (${res.status})`);return json.data}
function localApi(action,data){
  const rows=JSON.parse(localStorage.getItem("climateDemoResults")||"[]");if(action==="saveResult"){if(!rows.some(r=>r.gameSessionId===data.result.gameSessionId)){rows.push(data.result);localStorage.setItem("climateDemoResults",JSON.stringify(rows))}return Promise.resolve({duplicate:false,demo:true})}
  if(action==="getRanking"){const mine=data.gameSessionId;let filtered=rows.filter(r=>r.className===data.className);const byStudent=new Map();filtered.forEach(r=>{const key=`${r.className}-${r.studentNumber}`;const old=byStudent.get(key);if(!old||r.explorationScore>old.explorationScore)byStudent.set(key,r)});filtered=[...byStudent.values()].sort(rankSort);let rank=0,lastKey="";filtered.forEach((r,i)=>{const k=`${r.explorationScore}-${r.firstTryCorrect}-${r.accuracy}`;if(k!==lastKey)rank=i+1;r.rank=rank;lastKey=k});return Promise.resolve({rows:filtered.map(r=>({rank:r.rank,nickname:r.nickname,explorationScore:r.explorationScore,isMe:r.gameSessionId===mine})),total:filtered.length,settings})}
  if(action==="getPublicSettings")return Promise.resolve(settings);return Promise.reject(new Error("config.js에 Supabase 연결 정보를 설정해 주세요."))
}
function rankSort(a,b){return b.explorationScore-a.explorationScore||b.firstTryCorrect-a.firstTryCorrect||b.accuracy-a.accuracy}
async function submitResult(){const box=$('#submit-status');box.textContent="⏳ 탐험 결과를 선생님에게 전송하고 있어요...";try{const data=await api("saveResult",{result:state.result,responses:state.responses});localStorage.removeItem("climatePendingResult");box.textContent=data.demo?"✅ 이 기기에 결과를 저장했습니다. config.js에 Supabase를 연결하면 선생님에게 전달됩니다.":"✅ 탐험 결과가 선생님에게 전달되었습니다!";$('#retry-submit').classList.add('hidden')}catch(e){box.textContent="⚠️ 결과가 기기에 임시 저장되었습니다. 인터넷 연결을 확인한 뒤 다시 전송해 주세요.";$('#retry-submit').classList.remove('hidden')}}
async function showRanking(){screen('ranking');$('#ranking-title').textContent=`🏆 ${state.profile.className} 탐험 랭킹`;$('#ranking-list').innerHTML='<p class="muted">랭킹을 불러오는 중...</p>';try{const data=await api("getRanking",{className:state.profile.className,gameSessionId:state.gameSessionId});renderRanking(data)}catch(e){$('#ranking-list').innerHTML=`<p class="muted">랭킹을 불러오지 못했습니다. ${escapeHtml(e.message)}</p>`}}
function renderRanking(data){const all=data.rows||[],limit=Number(data.settings?.rankingLimit||settings.rankingLimit||10),top=limit===999?all:all.slice(0,limit);let view=[...top];const me=all.find(r=>r.isMe);if(me&&!view.some(r=>r.isMe))view.push({separator:true},me);$('#ranking-list').innerHTML=view.length?view.map(r=>r.separator?'<div class="ellipsis">•••</div>':`<div class="rank-row ${r.rank<=3?'top':''} ${r.isMe?'me':''}"><span class="rank-no">${r.rank<=3?["🥇","🥈","🥉"][r.rank-1]:`${r.rank}위`}</span><b>${r.isMe?'▶ ':''}${escapeHtml(r.nickname)}${r.isMe?' · 나':''}</b><span class="rank-score">${r.explorationScore}점</span></div>`).join(""):'<p class="muted">아직 등록된 탐험 결과가 없습니다.</p>'}

document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]')?.dataset.action;if(action==="open-profile")screen('profile');if(action==="go-start"||action==="home")screen('start');if(action==="back-profile")screen('profile');if(action==="back-result")screen('result');if(action==="restart"){resetState();updateHud();screen('profile')}
  const char=e.target.closest('[data-character]');if(char){$$('.character-card').forEach(x=>x.classList.remove('selected'));char.classList.add('selected');state.character=CHARACTERS[Number(char.dataset.character)];$('#character-confirm').disabled=false}
  const climate=e.target.closest('[data-climate]');if(climate&&!climate.disabled)startClimate(climate.dataset.climate);
  const choice=e.target.closest('[data-choice]');if(choice)chooseAnswer(Number(choice.dataset.choice));
});
$('#profile-form').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);state.profile={className:String(fd.get('className')).trim(),studentNumber:Number(fd.get('studentNumber')),nickname:String(fd.get('nickname')).trim()};if(!state.profile.className||!state.profile.nickname)return;renderCharacters();screen('character')});
$('#character-confirm').addEventListener('click',()=>{state.startedAt=Date.now();renderMap();updateHud();screen('map')});$('#boss-button').addEventListener('click',startBoss);$('#quiz-next').addEventListener('click',nextQuestion);$('#retry-submit').addEventListener('click',submitResult);$('#ranking-button').addEventListener('click',showRanking);
window.addEventListener('online',()=>{if(localStorage.getItem("climatePendingResult")&&state.result)submitResult()});
(async function init(){resetState();updateHud();try{settings={...settings,...await api("getPublicSettings")};}catch(e){console.info("기본 설정을 사용합니다.")}const pending=localStorage.getItem("climatePendingResult");if(pending){toast("이전에 전송하지 못한 결과를 다시 전송합니다.");try{const saved=JSON.parse(pending);await api("saveResult",{result:saved,responses:saved.responses||[]});localStorage.removeItem("climatePendingResult");toast("이전 탐험 결과를 선생님에게 전달했습니다.")}catch(e){console.info("이전 결과는 기기에 계속 보관됩니다.")}}})();
