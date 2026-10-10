const app = document.querySelector("#app");
const IMAGE_ROOT = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";
const STORAGE_KEY = "lern-abenteuer-progress-v1";
const state = { screen: "home", pokemon: [], collected: new Set([25]), solved: 0, question: null, feedback: null, fighter: null, opponent: null, rounds: [], search: "", rewards: [] };

const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const imageUrl = id => `${IMAGE_ROOT}/${id}.png`;
const byId = id => state.pokemon[id - 1];

function parseCsvLine(line) {
  const values = []; let value = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value); return values;
}

function loadCatalog() {
  if (!Array.isArray(window.POKEMON_DATA) || window.POKEMON_DATA.length !== 1025) {
    throw new Error("Pokémon-Daten fehlen");
  }
  state.pokemon = window.POKEMON_DATA;
}

function loadProgress() {
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); state.solved = Math.max(0, saved?.solved || 0); state.collected = new Set([25, ...(saved?.collected || [])]); } catch {}
}
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ solved:state.solved, collected:[...state.collected] })); }
  catch { /* Der Spielablauf funktioniert auch, wenn file://-Speicherung blockiert ist. */ }
}

function nextQuestion() {
  const addition = Math.random() < .5; let a,b,result,operator;
  if (addition) { a=Math.floor(Math.random()*16); b=Math.floor(Math.random()*(21-a)); result=a+b; operator="+"; }
  else { a=Math.floor(Math.random()*21); b=Math.floor(Math.random()*(a+1)); result=a-b; operator="−"; }
  const alternatives = new Set();
  while (alternatives.size < 3) { const n=Math.max(0,Math.min(20,result+Math.floor(Math.random()*9)-4)); if(n!==result) alternatives.add(n); }
  const answers=[...alternatives,result].sort(()=>Math.random()-.5);
  return { text:`${a} ${operator} ${b} = ?`, result, answers };
}

function shell(content, title="", back=true) {
  return `<main class="shell"><div class="app">${back?`<header class="topbar"><button class="back" data-action="home" aria-label="Zurück zur Startseite">←</button><h1>${escapeHtml(title)}</h1></header>`:""}${content}</div></main>`;
}
function pokemonImage(p, className="") { return `<img class="${className}" src="${imageUrl(p.id)}" alt="${escapeHtml(p.name)}" loading="lazy">`; }

function renderHome() {
  app.innerHTML=shell(`<section class="hero"><div class="hero-mark">⭐</div><h1>Mein Lern-Abenteuer</h1><p>Rechnen, sammeln und kämpfen!</p></section><section class="stats"><div class="stat"><strong>${state.solved}</strong><span>gelöste Aufgaben</span></div><div class="stat"><strong>${state.collected.size}/1025</strong><span>Pokémon gesammelt</span></div></section><nav class="menu" aria-label="Spielmodi"><a class="action collect" href="#collect"><strong>Sammelmodus</strong><span>Löse Aufgaben und finde Grundformen</span></a><button class="action battle" data-action="battle-select"><strong>Kampfmodus</strong><span>Gewinne 3 von 4 Rechenrunden</span></button><button class="action collection" data-action="collection"><strong>Meine Sammlung</strong><span>Alle gefundenen Pokémon ansehen</span></button></nav>`,"",false);
}

function renderQuestion(title, label) {
  const q=state.question;
  app.innerHTML= shell(`<section class="card task"><span class="task-label">${escapeHtml(label)}</span><h2 class="question">${escapeHtml(q.text)}</h2><div class="answers">${q.answers.map(n=>`<button class="answer" data-answer="${n}">${n}</button>`).join("")}</div></section>`,title);
}

function startCollect() { state.screen="collect"; state.feedback=null; state.question=nextQuestion(); render(); }
function answerCollect(value) {
  if(value===state.question.result) {
    state.solved++; const found=state.pokemon.find(p=>!p.evolvesFrom&&!state.collected.has(p.id));
    if(found) state.collected.add(found.id); saveProgress(); state.feedback={correct:true,pokemon:found};
  } else state.feedback={correct:false,correctAnswer:state.question.result};
  render();
}
function renderCollect() {
  if(!state.feedback) return renderQuestion("Sammelmodus","Neue Rechenaufgabe");
  const f=state.feedback;
  app.innerHTML=shell(`<section class="card result"><div class="result-icon">${f.correct?"🎉":"💪"}</div><h2>${f.correct?"Richtig gerechnet!":"Fast geschafft!"}</h2>${f.correct&&f.pokemon?`<div class="pokemon-focus">${pokemonImage(f.pokemon)}<h2>${escapeHtml(f.pokemon.name)} gehört jetzt zu dir!</h2></div>`:f.correct?`<p>Du hast bereits alle verfügbaren Grundformen gesammelt.</p>`:`<p>Die richtige Antwort war <strong>${f.correctAnswer}</strong>.</p>`}<button class="primary" data-action="collect-next">Nächste Aufgabe</button></section>`,"Sammelmodus");
}

function renderCollection() {
  const query=state.search.trim().toLocaleLowerCase("de");
  const visible=state.pokemon.filter(p=>state.collected.has(p.id)).filter(p=>!query||p.name.toLocaleLowerCase("de").includes(query)||String(p.id).includes(query));
  app.innerHTML=shell(`<input class="search" data-search="collection" value="${escapeHtml(state.search)}" placeholder="Name oder Pokédex-Nummer suchen" aria-label="Sammlung durchsuchen"><p class="note">${state.collected.size} von 1025 Pokémon gesammelt</p><section class="grid">${visible.map(p=>`<article class="poke-card">${pokemonImage(p)}<strong>${escapeHtml(p.name)}</strong><small>#${String(p.id).padStart(4,"0")}</small></article>`).join("")}</section>${visible.length?"":`<div class="empty">Kein Pokémon gefunden.</div>`}`,"Meine Sammlung");
}

function eligibleFighters() { return state.pokemon.filter(p=>state.collected.has(p.id)&&(p.id===25||(p.nextEvolution&&!state.collected.has(p.nextEvolution)))); }
function renderBattleSelect() {
  const query=state.search.trim().toLocaleLowerCase("de");
  const fighters=eligibleFighters().filter(p=>!query||p.name.toLocaleLowerCase("de").includes(query)||String(p.id).includes(query));
  app.innerHTML=shell(`<input class="search" data-search="battle" value="${escapeHtml(state.search)}" placeholder="Kämpfer suchen" aria-label="Pokémon für den Kampf suchen"><p class="note">Wähle dein Pokémon für den nächsten Kampf.</p><section class="grid">${fighters.map(p=>`<button class="poke-card" data-fighter="${p.id}">${pokemonImage(p)}<strong>${escapeHtml(p.name)}</strong><small>#${String(p.id).padStart(4,"0")}</small></button>`).join("")}</section>${fighters.length?"":`<div class="empty">Kein passendes kampfbereites Pokémon gefunden.</div>`}`,"Pokémon auswählen");
}
function startBattle(id) {
  state.fighter=byId(id); const excluded=new Set([id,state.fighter.nextEvolution]);
  const pool=state.pokemon.filter(p=>!excluded.has(p.id)&&!state.collected.has(p.id));
  state.opponent=id===25?byId(1):(pool.length?pool:state.pokemon.filter(p=>!excluded.has(p.id)))[Math.floor(Math.random()*(pool.length||1023))];
  state.rounds=[]; state.feedback=null; state.rewards=[]; state.question=nextQuestion(); state.screen="battle"; render();
}
function battleHeader() { const marks=state.rounds.map(ok=>ok?"✓":"✗").join(" ")||"Vier Runden"; return `<div class="battle-head"><div class="fighter">${pokemonImage(state.fighter)}<strong>${escapeHtml(state.fighter.name)}</strong></div><div class="versus">VS<div class="rounds">${marks}</div></div><div class="fighter">${pokemonImage(state.opponent)}<strong>${escapeHtml(state.opponent.name)}</strong></div></div>`; }
function answerBattle(value) {
  const correct=value===state.question.result; state.rounds.push(correct); state.solved++; saveProgress(); state.feedback={correct,correctAnswer:state.question.result};
  if(state.rounds.length===4) {
    const won=state.rounds.filter(Boolean).length>=3;
    if(won) { const ids=[state.opponent.id,state.fighter.nextEvolution].filter(Boolean); for(const id of ids) state.collected.add(id); state.rewards=ids.map(byId); saveProgress(); }
    state.feedback.finished=true; state.feedback.won=won;
  }
  render();
}
function renderBattle() {
  const header=battleHeader();
  if(!state.feedback) { const q=state.question; app.innerHTML=shell(`${header}<section class="card task"><span class="task-label">Runde ${state.rounds.length+1} von 4</span><h2 class="question">${escapeHtml(q.text)}</h2><div class="answers">${q.answers.map(n=>`<button class="answer" data-answer="${n}">${n}</button>`).join("")}</div></section>`,"Pokémon-Kampf"); return; }
  const f=state.feedback;
  if(f.finished) { app.innerHTML=shell(`${header}<section class="card result"><div class="result-icon">${f.won?"🏆":"🌟"}</div><h2>${f.won?"Kampf gewonnen!":"Weiter üben!"}</h2><p>Du hast ${state.rounds.filter(Boolean).length} von 4 Runden gewonnen.</p>${f.won?`<div class="reward-list">${state.rewards.map(p=>`<span class="reward">${escapeHtml(p.name)}</span>`).join("")}</div><p>Diese Pokémon wurden deiner Sammlung hinzugefügt.</p>`:""}<button class="primary" data-action="battle-select">Neuen Kampf starten</button></section>`,"Kampfergebnis"); return; }
  app.innerHTML=shell(`${header}<section class="card result"><div class="result-icon">${f.correct?"✅":"❌"}</div><h2>${f.correct?"Runde gewonnen!":"Runde verloren"}</h2>${f.correct?"":`<p>Die richtige Antwort war <strong>${f.correctAnswer}</strong>.</p>`}<button class="primary" data-action="battle-next">Nächste Runde</button></section>`,"Pokémon-Kampf");
}

function render() {
  if(state.screen==="home")renderHome(); else if(state.screen==="collect")renderCollect(); else if(state.screen==="collection")renderCollection(); else if(state.screen==="battle-select")renderBattleSelect(); else renderBattle();
  bindInteractions();
}
function navigate(screen) { state.screen=screen; state.search=""; state.feedback=null; render(); }

function handleAction(action) {
  if(action==="home")navigate("home"); else if(action==="collect")startCollect(); else if(action==="collection")navigate("collection"); else if(action==="battle-select")navigate("battle-select");
  else if(action==="collect-next"){state.feedback=null;state.question=nextQuestion();render();} else if(action==="battle-next"){state.feedback=null;state.question=nextQuestion();render();}
}
function bindInteractions() {
  app.querySelectorAll("[data-action]").forEach(button => button.setAttribute("onclick", "window.learningApp.handleAction(this.dataset.action)"));
  app.querySelectorAll("[data-answer]").forEach(button => button.setAttribute("onclick", "window.learningApp.answer(Number(this.dataset.answer))"));
  app.querySelectorAll("[data-fighter]").forEach(button => button.setAttribute("onclick", "window.learningApp.startBattle(Number(this.dataset.fighter))"));
  const search=app.querySelector("[data-search]");
  if(search) search.oninput=()=>{state.search=search.value;const pos=search.selectionStart;render();const next=app.querySelector("[data-search]");next?.focus();next?.setSelectionRange(pos,pos);};
}

window.learningApp={
  handleAction,
  answer(value){state.screen==="collect"?answerCollect(value):answerBattle(value);},
  startBattle
};

window.addEventListener("hashchange", () => {
  if (location.hash === "#collect") startCollect();
});

function registerWebMcp() {
  const context=document.modelContext; if(!context?.registerTool)return;
  const register=tool=>Promise.resolve(context.registerTool(tool)).catch(()=>{});
  register({name:"get_learning_progress",title:"Lernfortschritt lesen",description:"Liest die Anzahl gelöster Aufgaben und gesammelter Pokémon.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({solvedTasks:state.solved,collectedPokemon:state.collected.size})});
  register({name:"start_learning_mode",title:"Lernmodus öffnen",description:"Öffnet den Sammelmodus oder die Pokémon-Auswahl für den Kampf.",inputSchema:{type:"object",properties:{mode:{type:"string",enum:["collect","battle"]}},required:["mode"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:({mode})=>{if(mode==="collect")startCollect();else navigate("battle-select");return{screen:state.screen};}});
  register({name:"answer_current_math_question",title:"Rechenaufgabe beantworten",description:"Beantwortet die aktuell sichtbare Rechenaufgabe im Sammel- oder Kampfmodus.",inputSchema:{type:"object",properties:{answer:{type:"integer",minimum:0,maximum:20}},required:["answer"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:({answer})=>{if(!state.question||state.feedback)throw new Error("Es ist keine unbeantwortete Aufgabe geöffnet.");state.screen==="collect"?answerCollect(answer):state.screen==="battle"?answerBattle(answer):(()=>{throw new Error("Zuerst einen Lernmodus öffnen.")})();return{correct:state.feedback.correct,screen:state.screen};}});
}

app.innerHTML=`<main class="shell"><div class="loading">Pokémon werden vorbereitet …</div></main>`;
loadProgress();
try {
  loadCatalog();
  if (location.hash === "#collect") startCollect(); else render();
  registerWebMcp();
  if (location.protocol.startsWith("http") && "serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").then(registration => registration.update());
} catch {
  app.innerHTML=shell(`<section class="card result"><div class="result-icon">⚠️</div><h2>Daten konnten nicht geladen werden</h2><p>Bitte prüfe, ob alle Dateien im Web-App-Ordner vorhanden sind.</p></section>`,"Lern-Abenteuer",false);
}
