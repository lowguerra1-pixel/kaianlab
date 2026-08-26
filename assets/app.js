// =====================================================================
// KAIAN LAB — interface
// =====================================================================

import {
  sb, configurado, sessaoAtual, entrar, sair, aoMudarAuth, meuPapel,
  carregarTudo, inserirComId, remover, agendarPatch, descarregar,
  aoMudarGravacao, temPendencia, inscrever
} from "./dados.js";

// ---------------------------------------------------------------------
// Constantes de domínio
// ---------------------------------------------------------------------
const BUILD_STEPS = [
  ["research","Research"], ["entregavel","Entregável"], ["checkout","Checkout"],
  ["obEntregavel","O.B + Entregável"], ["app","App"], ["backRedirect","Back-Redirect"]
];
const ST_BUILD = ["A FAZER","FAZENDO","EM REVISÃO","APROVADO","BLOQUEADO","N/A"];
const ST_PROD  = ["A FAZER","FAZENDO","EM REVISÃO","APROVADO","BLOQUEADO"];
const ST_TRAF  = ["A FAZER","PROGRAMADO","EM TESTE","LIDO"];
const ST_VER_O = ["EM TESTE","APROVADO → FASE 2","REPESCAGEM","MORTA"];
const ST_VER_C = ["VALIDADO","POTENCIAL","MORTO","LATERALIZADO"];
const PAISES   = ["BR","AR","MX","CO","CL","PE","EC","ES","PT","US","IT"];
const FORMATOS = ["UGC","Depoimento","Slideshow","VSL curta","Motion/IA","Screen record","Foto estática","Carrossel","Outro"];

const TONE = {
  "A FAZER":"idle","FAZENDO":"info","EM REVISÃO":"warn","APROVADO":"ok","BLOQUEADO":"bad","N/A":"idle",
  "PROGRAMADO":"info","EM TESTE":"warn","LIDO":"ok",
  "APROVADO → FASE 2":"ok","REPESCAGEM":"warn","MORTA":"bad",
  "VALIDADO":"ok","POTENCIAL":"warn","MORTO":"bad","LATERALIZADO":"info"
};
const tone = s => TONE[s] || "idle";

// ---------------------------------------------------------------------
// Estado da tela
// ---------------------------------------------------------------------
let state = { ofertas: [], levas: [], criativos: [] };
let view = "ofertas";
let filters = { ofertas:"", levas:"", criativos:"", vencedores:"" };
let levaOferta = "", criOferta = "";
let drawerCtx = null;
let papel = null;
let sessao = null;
let gravacao = "ok", erroGravacao = "";
let podeEditar = false;
let assinaturasLigadas = false;

const $app = () => document.getElementById("app");

// ---------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------
function h(s){
  return String(s == null ? "" : s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
const BRL = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
function money(v){ const n = Number(v); return (v !== "" && v != null && isFinite(n)) ? BRL.format(n) : "—"; }
function num(v,d=2){ const n = Number(v); return (v !== "" && v != null && isFinite(n)) ? n.toFixed(d) : "—"; }
function addDays(iso,d){
  if(!iso) return "";
  const p = String(iso).slice(0,10).split("-"); if(p.length !== 3) return "";
  const dt = new Date(+p[0], +p[1]-1, +p[2]); dt.setDate(dt.getDate()+d);
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
}
function br(iso){ if(!iso) return "—"; const p = String(iso).slice(0,10).split("-"); return p.length===3 ? `${p[2]}/${p[1]}` : "—"; }
const pad = n => String(n).padStart(2,"0");
const pill = s => `<span class="pill p-${tone(s)}">${h(s)}</span>`;
function pillsel(val, list, kind, id){
  const o = list.map(x => `<option${x===val?" selected":""}>${h(x)}</option>`).join("");
  return `<select class="pillsel p-${tone(val)}" data-inline="${kind}" data-id="${h(id)}"${podeEditar?"":" disabled"}>${o}</select>`;
}
const opts = (list,val) => list.map(x => `<option value="${h(x)}"${x===val?" selected":""}>${h(x)}</option>`).join("");
const byId = (list,id) => list.find(x => x.id === id) || null;
function lucro(o){
  const f = Number(o.faturamento), i = Number(o.investido);
  if(o.faturamento === "" && o.investido === "") return null;
  if(!isFinite(f) && !isFinite(i)) return null;
  return (isFinite(f)?f:0) - (isFinite(i)?i:0);
}
function roas(o){
  const f = Number(o.faturamento), i = Number(o.investido);
  return (isFinite(f) && isFinite(i) && i > 0) ? f/i : null;
}
const levasDe = oid => state.levas.filter(l => l.ofertaId === oid);
const crisDe  = lid => state.criativos.filter(c => c.levaId === lid);

function toast(msg, ruim){
  let t = document.getElementById("toast");
  if(!t){ t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.className = "toast" + (ruim ? " ruim" : "") + " on";
  t.textContent = msg;
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 4200);
}

// ---------------------------------------------------------------------
// Telas de entrada
// ---------------------------------------------------------------------
function telaAviso(titulo, corpo, acao){
  return `<div class="portao"><div class="cartao">
    <div class="brand" style="margin-bottom:18px"><b>KAIAN LAB</b><span>Esteira</span></div>
    <h1>${titulo}</h1>${corpo}${acao||""}</div></div>`;
}

function telaConfig(){
  $app().innerHTML = telaAviso("Falta configurar o Supabase", `
    <p>O arquivo <code>assets/config.js</code> ainda está com os valores de exemplo.
       Preencha com a URL e a chave <b>anon</b> do seu projeto e publique de novo.</p>
    <p class="passo">Painel do Supabase → <b>Project Settings</b> → <b>Data API</b></p>
    <p>Antes disso, rode o <code>sql/schema.sql</code> no SQL Editor — é ele que cria
       as tabelas e libera o seu acesso.</p>`);
}

function telaLogin(){
  $app().innerHTML = telaAviso("Entrar", `
    <form id="formLogin" class="formLogin">
      <input type="email" id="email" placeholder="seu@email.com" required autocomplete="username">
      <input type="password" id="senha" placeholder="sua senha" required autocomplete="current-password">
      <button class="btn primary" type="submit">Entrar</button>
    </form>
    <p class="passo" id="avisoLogin"></p>`);
  const e = document.getElementById("email");
  if (e) e.focus();
}

function telaSemAcesso(){
  $app().innerHTML = telaAviso("Sem acesso", `
    <p>Você entrou como <b>${h(sessao?.user?.email || "")}</b>, mas esse e-mail não está
       liberado no Kaian Lab.</p>
    <p class="passo">Peça pro Kaian rodar no SQL Editor do Supabase:<br>
      <code>insert into membros (email, nome, papel) values ('${h(sessao?.user?.email||"")}', 'Nome', 'editor');</code></p>`,
    `<button class="btn" data-act="sair">Sair</button>`);
}

function telaErro(e){
  $app().innerHTML = telaAviso("Não consegui carregar", `
    <p>${h(explicaErro(e))}</p>
    <p class="passo">Se a mensagem fala de tabela inexistente, falta rodar o
       <code>sql/schema.sql</code> no SQL Editor do Supabase.</p>`,
    `<button class="btn primary" data-act="recarregar">Tentar de novo</button>
     <button class="btn" data-act="sair">Sair</button>`);
}

// ---------------------------------------------------------------------
// Indicador de gravação
// ---------------------------------------------------------------------
function paintSave(){
  const el = document.getElementById("saveState");
  if(!el) return;
  let cls = "dot", txt;
  if (gravacao === "erro"){ cls += " err"; txt = "erro ao gravar"; }
  else if (gravacao === "gravando"){ cls += " dirty"; txt = "gravando…"; }
  else if (gravacao === "pendente"){ cls += " dirty"; txt = "não gravado"; }
  else txt = podeEditar ? "gravado" : "somente leitura";
  el.innerHTML = `<span class="${cls}"></span><small>${h(txt)}</small>` +
    (gravacao === "erro" ? ` <button class="btn sm" data-act="regravar">Tentar de novo</button>` : "");
}

// ---------------------------------------------------------------------
// Casca
// ---------------------------------------------------------------------
function render(){
  const counts = {
    ofertas: state.ofertas.length, levas: state.levas.length,
    criativos: state.criativos.length,
    vencedores: state.criativos.filter(c => c.veredito === "VALIDADO").length
  };
  const tabs = [["ofertas","Fase 1 · Ofertas"],["levas","Fase 2 · Levas"],["criativos","Criativos"],
                ["vencedores","Vencedores"],["guia","Guia"]];
  const nav = tabs.map(t =>
    `<button class="tab" role="tab" aria-selected="${view===t[0]}" data-view="${t[0]}">${t[1]}` +
    (counts[t[0]] != null ? `<span class="cnt">${counts[t[0]]}</span>` : "") + `</button>`).join("");

  const body = view==="ofertas" ? viewOfertas()
             : view==="levas" ? viewLevas()
             : view==="criativos" ? criativoTable(false)
             : view==="vencedores" ? criativoTable(true)
             : viewGuia();

  const aviso = podeEditar ? "" :
    `<div class="banner"><b>Somente leitura:</b> seu acesso é de leitor. Pra cadastrar e alterar,
     o Kaian precisa mudar seu papel pra <code>editor</code>.</div>`;

  $app().innerHTML =
    `<header class="top">
       <div class="brand"><b>KAIAN LAB</b><span>Esteira</span></div>
       <nav role="tablist">${nav}</nav>
       <div class="saveState" id="saveState"></div>
       <button class="btn ghost sm" data-act="sair" title="${h(sessao?.user?.email||"")}">Sair</button>
     </header>
     <main>${aviso}${body}</main>`;
  paintSave();
}

const kpi = (l,v,cls) => `<div class="kpi"><div class="lbl">${h(l)}</div><div class="val ${cls||""}">${h(v)}</div></div>`;
const emptyState = (t,s,act,btn) =>
  `<div class="twrap"><div class="empty"><p><b>${h(t)}</b><br>${h(s)}</p>` +
  (act && podeEditar ? `<button class="btn primary" data-act="${act}">${h(btn)}</button>` : "") + `</div></div>`;

// ---------------------------------------------------------------------
// Fase 1
// ---------------------------------------------------------------------
function viewOfertas(){
  const f1 = state.ofertas.filter(o => Number(o.fase||1) === 1).length;
  const f2 = state.ofertas.filter(o => Number(o.fase||1) === 2).length;
  let inv = 0, fat = 0;
  state.ofertas.forEach(o => { inv += Number(o.investido)||0; fat += Number(o.faturamento)||0; });
  const luc = fat - inv, rg = inv > 0 ? fat/inv : null;

  const kpis = kpi("Em Fase 1", f1) + kpi("Em Fase 2", f2) +
    kpi("Investido", money(inv)) + kpi("Faturado", money(fat)) +
    kpi("Lucro", money(luc), luc>0?"pos":(luc<0?"neg":"")) +
    kpi("ROAS geral", rg==null?"—":num(rg));

  const q = filters.ofertas.toLowerCase();
  const rows = state.ofertas.filter(o =>
    !q || `${o.id} ${o.nome} ${o.responsavel}`.toLowerCase().includes(q));

  const tb = rows.map(o => {
    const l = lucro(o), r = roas(o);
    const squares = BUILD_STEPS.map(s => {
      const st = (o.build && o.build[s[0]]) || "A FAZER";
      const cl = st==="N/A" ? "s-na" : (st==="A FAZER" ? "" : "s-"+tone(st));
      return `<span class="bsq ${cl}" title="${h(s[1]+": "+st)}"></span>`;
    }).join("");
    return `<tr data-open="oferta" data-id="${h(o.id)}">
      <td class="id">${h(o.id)}</td>
      <td class="name">${h(o.nome||"—")}</td>
      <td class="txt">${h(o.responsavel||"—")}</td>
      <td><span class="buildbar">${squares}</span></td>
      <td class="n">${br(o.dataInicio)}</td>
      <td class="n">${br(addDays(o.dataInicio,5))}</td>
      <td class="n">${br(o.dataFinal)}</td>
      <td class="n">${money(o.investido)}</td>
      <td class="n ${l>0?"pos":(l<0?"neg":"")}">${l==null?"—":money(l)}</td>
      <td class="n">${r==null?"—":num(r)}</td>
      <td>${pill(o.veredito||"EM TESTE")}</td></tr>`;
  }).join("");

  const table = rows.length
    ? `<div class="twrap with-kpis"><table><thead><tr>` +
      ["ID","Oferta","Resp.","Build","Início","Leitura","Fim","Investido","Lucro","ROAS","Veredito"]
        .map(t => `<th>${t}</th>`).join("") +
      `</tr></thead><tbody>${tb}</tbody></table></div>`
    : emptyState("Nenhuma oferta ainda.","Cadastre a primeira oferta em modelagem.","new-oferta","Nova oferta");

  return `<div class="kpis">${kpis}</div>
    <div class="toolbar"><h2>Fase 1 — Validação &amp; Modelagem</h2><div class="sp"></div>
      <input class="search" data-filter="ofertas" placeholder="Buscar oferta…" value="${h(filters.ofertas)}">
      <button class="btn" data-act="csv-ofertas">CSV</button>
      ${podeEditar?`<button class="btn primary" data-act="new-oferta">+ Nova oferta</button>`:""}
    </div>${table}`;
}

// ---------------------------------------------------------------------
// Fase 2 — levas
// ---------------------------------------------------------------------
function viewLevas(){
  const q = filters.levas.toLowerCase();
  const rows = state.levas.filter(l => {
    if (levaOferta && l.ofertaId !== levaOferta) return false;
    return !q || `${l.id} ${l.angulo}`.toLowerCase().includes(q);
  }).sort((a,b) => String(b.dataEntrega||"").localeCompare(String(a.dataEntrega||"")));

  const f2 = state.ofertas.filter(o => Number(o.fase||1)===2 || o.veredito==="APROVADO → FASE 2");

  const tb = rows.map(l => {
    const o = byId(state.ofertas, l.ofertaId);
    const cris = crisDe(l.id);
    const val = cris.filter(c => c.veredito === "VALIDADO").length;
    return `<tr>
      <td class="id" data-open="leva" data-id="${h(l.id)}" style="cursor:pointer">${h(l.id)}</td>
      <td class="txt">${h(o?o.nome:"—")}</td>
      <td class="n">${br(l.dataEntrega)}</td>
      <td class="n">${br(addDays(l.dataEntrega,2))}</td>
      <td class="n">${h(l.qtd||20)}</td>
      <td class="txt">${h(l.angulo||"—")}</td>
      <td>${pillsel(l.copy||"A FAZER", ST_PROD, "leva.copy", l.id)}</td>
      <td>${pillsel(l.edicao||"A FAZER", ST_PROD, "leva.edicao", l.id)}</td>
      <td>${pillsel(l.trafego||"A FAZER", ST_TRAF, "leva.trafego", l.id)}</td>
      <td class="n">${cris.length}${val?` <span class="pill p-ok">${val} val</span>`:""}</td>
      <td>${podeEditar?`<button class="btn sm" data-act="new-criativo" data-id="${h(l.id)}">+ criativo</button>`:""}</td>
    </tr>`;
  }).join("");

  const table = rows.length
    ? `<div class="twrap"><table><thead><tr>` +
      ["ID Leva","Oferta","Entrega","Leitura","Qtd","Ângulo da leva","Copy","Edição","Tráfego","Que gastou",""]
        .map(t => `<th>${t}</th>`).join("") +
      `</tr></thead><tbody>${tb}</tbody></table></div>`
    : emptyState(
        f2.length ? "Nenhuma leva ainda." : "Nenhuma oferta em Fase 2.",
        f2.length ? "Cada leva é um lote de ~20 criativos entregue a cada 2 dias."
                  : "Marque uma oferta como APROVADO → FASE 2 na aba Fase 1.",
        f2.length ? "new-leva" : null, "Nova leva");

  const sel = `<select class="selfilter" data-ofilter="leva"><option value="">Todas as ofertas</option>` +
    state.ofertas.map(o => `<option value="${h(o.id)}"${levaOferta===o.id?" selected":""}>${h(o.id+" · "+(o.nome||""))}</option>`).join("") +
    `</select>`;

  return `<div class="toolbar"><h2>Fase 2 — Levas de criativo</h2><div class="sp"></div>${sel}
    <input class="search" data-filter="levas" placeholder="Buscar leva…" value="${h(filters.levas)}">
    <button class="btn" data-act="csv-levas">CSV</button>
    ${podeEditar?`<button class="btn primary" data-act="new-leva"${f2.length?"":" disabled"}>+ Nova leva</button>`:""}
    </div>${table}`;
}

// ---------------------------------------------------------------------
// Criativos / Vencedores
// ---------------------------------------------------------------------
function criativoTable(onlyWin){
  const key = onlyWin ? "vencedores" : "criativos";
  const q = filters[key].toLowerCase();
  const rows = state.criativos.filter(c => {
    if (onlyWin && c.veredito !== "VALIDADO") return false;
    const l = byId(state.levas, c.levaId);
    if (criOferta && (!l || l.ofertaId !== criOferta)) return false;
    return !q || `${c.id} ${c.angulo} ${c.hook} ${c.formato} ${c.anguloHook}`.toLowerCase().includes(q);
  }).sort((a,b) => String(b.id).localeCompare(String(a.id)));

  const tb = rows.map(c => {
    const l = byId(state.levas, c.levaId);
    const o = l ? byId(state.ofertas, l.ofertaId) : null;
    return `<tr>
      <td class="id" data-open="criativo" data-id="${h(c.id)}" style="cursor:pointer">${h(c.id)}
        <button class="copyid" data-copy="${h(c.id)}" title="Copiar ID pro nome do anúncio">⧉</button></td>
      <td class="txt">${h(o?o.nome:"—")}</td>
      <td class="txt">${h(c.angulo||"—")}</td>
      <td class="txt">${h(c.anguloHook||"—")}</td>
      <td class="txt">${h(c.hook||"—")}</td>
      <td class="txt">${h(c.formato||"—")}</td>
      <td class="txt">${h(c.body||"—")}</td>
      <td class="id">${h(c.pai||"—")}</td>
      <td class="n">${money(c.gasto)}</td>
      <td class="n">${money(c.cpa)}</td>
      <td class="n">${c.roas?num(c.roas):"—"}</td>
      <td>${pillsel(c.veredito||"VALIDADO", ST_VER_C, "cri.veredito", c.id)}</td></tr>`;
  }).join("");

  const heads = ["ID (= nome do anúncio)","Oferta","Ângulo","Ângulo do Hook","Hook","Formato","Body","Pai","Gasto","CPA","ROAS","Veredito"];
  const table = rows.length
    ? `<div class="twrap"><table><thead><tr>${heads.map(t=>`<th>${t}</th>`).join("")}</tr></thead><tbody>${tb}</tbody></table></div>`
    : emptyState(
        onlyWin ? "Nenhum vencedor ainda." : "Nenhum criativo lançado ainda.",
        onlyWin ? "Criativos marcados como VALIDADO aparecem aqui, com ângulo, hook e formato."
                : "Só entra aqui criativo que gastou. Use o botão “+ criativo” na leva.");

  const sel = `<select class="selfilter" data-ofilter="cri"><option value="">Todas as ofertas</option>` +
    state.ofertas.map(o => `<option value="${h(o.id)}"${criOferta===o.id?" selected":""}>${h(o.id+" · "+(o.nome||""))}</option>`).join("") +
    `</select>`;

  return `<div class="toolbar"><h2>${onlyWin?"Biblioteca de Vencedores":"Criativos que gastaram"}</h2>
    <div class="sp"></div>${sel}
    <input class="search" data-filter="${key}" placeholder="Buscar ângulo, hook, formato…" value="${h(filters[key])}">
    <button class="btn" data-act="csv-criativos">CSV</button></div>${table}`;
}

// ---------------------------------------------------------------------
// Guia
// ---------------------------------------------------------------------
function viewGuia(){
  return `<div class="guide">
  <h3>Como o Lab funciona</h3>
  <p>Três tabelas ligadas. Uma <b>oferta</b> entra na Fase 1, é testada, e se aprovar vira Fase 2.
     Na Fase 2 ela recebe <b>levas</b> de ~20 criativos a cada 2 dias. Cada leva gera <b>criativos</b>
     — e só entra na tabela o criativo que efetivamente gastou.</p>

  <div class="rule"><p><b>Regra inegociável:</b> o ID do criativo é o nome do anúncio no Meta.
     O Lab gera o ID; você copia (botão ⧉) e cola como nome do anúncio. Se isso não for respeitado,
     ninguém consegue casar resultado com criativo e a base morre em um mês.</p></div>

  <h3>Convenção de ID</h3>
  <table class="gtable">
  <tr><td><code>ART-BR-01</code></td><td>Oferta — 3 letras + país + sequencial. Nunca muda, mesmo que o nome mude.</td></tr>
  <tr><td><code>ART-BR-01-L07</code></td><td>Leva 07 daquela oferta. Gerado automático.</td></tr>
  <tr><td><code>ART-BR-01-L07-C03</code></td><td>Criativo 03 da leva 07. Este é o nome do anúncio.</td></tr>
  </table>

  <h3>Status de build e produção</h3>
  <table class="gtable">
  <tr><td>${pill("A FAZER")}</td><td>Ninguém começou.</td></tr>
  <tr><td>${pill("FAZENDO")}</td><td>Em execução agora. Existe pra o meio não ficar invisível.</td></tr>
  <tr><td>${pill("EM REVISÃO")}</td><td>Pronto, esperando aprovação do Kaian.</td></tr>
  <tr><td>${pill("APROVADO")}</td><td>Fechado.</td></tr>
  <tr><td>${pill("BLOQUEADO")}</td><td>Parado esperando algo externo — conta, gateway, terceiro. É o status que salva dinheiro.</td></tr>
  <tr><td>${pill("N/A")}</td><td>Essa oferta não tem essa etapa.</td></tr>
  </table>

  <h3>Tráfego (na leva)</h3>
  <p>${pill("A FAZER")} → ${pill("PROGRAMADO")} → ${pill("EM TESTE")} → ${pill("LIDO")}</p>
  <p><b>LIDO</b> não quer dizer campanha parada. Quer dizer que o teste foi lido e o resultado já está registrado.</p>

  <h3>Janelas de leitura</h3>
  <ul>
  <li><b>Fase 1: 5 dias.</b> A data de leitura é calculada sozinha a partir do início. A espera existe
      pra medir o orderbump no funil — por isso o <b>Take Rate do OB</b> é campo obrigatório na prática:
      sem ele, a espera não produziu nada.</li>
  <li><b>Fase 2: 2 dias.</b> Calculada a partir da data de entrega da leva.</li>
  </ul>

  <h3>Veredito da oferta</h3>
  <table class="gtable">
  <tr><td>${pill("EM TESTE")}</td><td>Rodando, ainda sem decisão.</td></tr>
  <tr><td>${pill("APROVADO → FASE 2")}</td><td>Passou. Libera criar levas.</td></tr>
  <tr><td>${pill("REPESCAGEM")}</td><td>Morreu por execução (checkout torto, criativo fraco), não por falta de mercado. Volta depois.</td></tr>
  <tr><td>${pill("MORTA")}</td><td>Não tem mercado. Não volta.</td></tr>
  </table>

  <h3>Veredito do criativo</h3>
  <p>Todo criativo que está na tabela <b>já gastou</b> — é esse o filtro de entrada.</p>
  <table class="gtable">
  <tr><td>${pill("VALIDADO")}</td><td>Padrão. Gastou e performou. Vai pra Biblioteca de Vencedores.</td></tr>
  <tr><td>${pill("POTENCIAL")}</td><td>Sinal bom mas ainda não conclusivo. Merece mais budget ou reteste.</td></tr>
  <tr><td>${pill("MORTO")}</td><td>Gastou e não pagou.</td></tr>
  <tr><td>${pill("LATERALIZADO")}</td><td>Já virou base pra novas variações — os filhos apontam pra ele no campo <b>Pai</b>.</td></tr>
  </table>

  <h3>Por que ângulo, hook e formato importam</h3>
  <p>Sem esses campos você aprende "o criativo 3 ganhou" — informação que morre naquela leva.
     Com eles você aprende "hook de pergunta + depoimento + ângulo financeiro ganha nesse mercado",
     que é o que se leva pra próxima oferta. A <b>Biblioteca de Vencedores</b> é o acúmulo disso,
     e é o único ativo aqui que compõe com o tempo.</p>

  <h3>Gravação</h3>
  <p>Cada campo grava sozinho no banco, ~1 segundo depois que você para de digitar. Duas pessoas
     mexendo em colunas diferentes da mesma linha <b>não se atropelam</b>. E o que uma altera
     aparece na tela da outra na hora, sem recarregar.</p>
  </div>`;
}

// ---------------------------------------------------------------------
// Gaveta
// ---------------------------------------------------------------------
function closeDrawer(){
  drawerCtx = null;
  const d = document.getElementById("drawer");
  d.classList.remove("on"); d.setAttribute("aria-hidden","true");
  document.getElementById("scrim").classList.remove("on");
  descarregar();
  render();
}
function openDrawer(kind,id){
  drawerCtx = { kind, id };
  const d = document.getElementById("drawer");
  d.innerHTML = kind==="oferta" ? drawerOferta(id) : kind==="leva" ? drawerLeva(id) : drawerCriativo(id);
  d.classList.add("on"); d.setAttribute("aria-hidden","false");
  document.getElementById("scrim").classList.add("on");
}
const ro = () => podeEditar ? "" : " disabled";
function dShell(title,sub,inner,delAct,delId){
  return `<div class="dhead"><div class="t"><b>${h(title)}</b><small>${h(sub)}</small></div>
    <button class="btn ghost" data-act="close-drawer">Fechar</button></div>
    <div class="dbody">${inner}</div>
    <div class="dfoot"><button class="btn primary" data-act="close-drawer">Concluir</button>
    <div style="flex:1"></div>
    ${podeEditar?`<button class="btn ghost" data-act="${delAct}" data-id="${h(delId)}" style="color:var(--bad)">Excluir</button>`:""}
    </div>`;
}
const fld = (label,kind,id,field,type,value,hint) =>
  `<div class="f"><label>${h(label)}</label>
   <input type="${type}"${type==="number"?' step="any"':''} data-edit="${kind}" data-id="${h(id)}"
     data-field="${field}" value="${h(value==null?"":value)}"${ro()}>
   ${hint?`<span class="hint">${h(hint)}</span>`:""}</div>`;
const sel = (label,kind,id,field,list,value) =>
  `<div class="f"><label>${h(label)}</label>
   <select data-edit="${kind}" data-id="${h(id)}" data-field="${field}"${ro()}>${opts(list,value)}</select></div>`;
const area = (label,kind,id,field,value,hint) =>
  `<div class="f full"><label>${h(label)}</label>
   <textarea data-edit="${kind}" data-id="${h(id)}" data-field="${field}"${ro()}>${h(value||"")}</textarea>
   ${hint?`<span class="hint">${h(hint)}</span>`:""}</div>`;
const calc = (label,val,cls) =>
  `<div class="f"><label>${h(label)}</label><div class="calc ${cls||""}">${h(val)}</div></div>`;

function drawerOferta(id){
  const o = byId(state.ofertas,id); if(!o) return "";
  const l = lucro(o), r = roas(o);
  const checks = BUILD_STEPS.map(s => {
    const v = (o.build && o.build[s[0]]) || "A FAZER";
    return `<div class="checkrow"><span>${h(s[1])}</span>
      <select class="p-${tone(v)}" data-build="${h(o.id)}" data-step="${s[0]}"${ro()}>${opts(ST_BUILD,v)}</select></div>`;
  }).join("");

  const inner =
    `<fieldset><legend>Identificação</legend><div class="grid">
      ${fld("Nome da oferta","oferta",id,"nome","text",o.nome)}
      ${sel("País","oferta",id,"pais",PAISES,o.pais)}
      ${fld("Responsável","oferta",id,"responsavel","text",o.responsavel)}
      ${sel("Fase atual","oferta",id,"fase",["1","2"],String(o.fase||1))}
      ${fld("Link do Drive","oferta",id,"linkDrive","url",o.linkDrive)}
      ${fld("Link do checkout","oferta",id,"linkCheckout","url",o.linkCheckout)}
    </div></fieldset>
    <fieldset><legend>Build</legend>${checks}</fieldset>
    <fieldset><legend>Janela de teste</legend><div class="grid g3">
      ${fld("Início","oferta",id,"dataInicio","date",String(o.dataInicio||"").slice(0,10))}
      ${calc("Leitura (+5d)", br(addDays(o.dataInicio,5)))}
      ${fld("Final","oferta",id,"dataFinal","date",String(o.dataFinal||"").slice(0,10))}
    </div></fieldset>
    <fieldset><legend>Resultado</legend><div class="grid">
      ${fld("Investido (R$)","oferta",id,"investido","number",o.investido)}
      ${fld("Faturamento (R$)","oferta",id,"faturamento","number",o.faturamento)}
      ${fld("Ticket médio (R$)","oferta",id,"ticketMedio","number",o.ticketMedio)}
      ${fld("Take rate do OB (%)","oferta",id,"takeRateOB","number",o.takeRateOB,"O motivo dos 5 dias de espera.")}
      ${calc("Lucro", l==null?"—":money(l), l>0?"pos":(l<0?"neg":""))}
      ${calc("ROAS", r==null?"—":num(r))}
    </div></fieldset>
    <fieldset><legend>Decisão</legend><div class="grid">
      ${sel("Veredito","oferta",id,"veredito",ST_VER_O,o.veredito||"EM TESTE")}
    </div><div class="grid" style="margin-top:10px">
      ${area("Aprendizado","oferta",id,"aprendizado",o.aprendizado,"O que essa oferta ensinou. É isso que volta pra mineração.")}
      ${area("Observações","oferta",id,"obs",o.obs)}
    </div></fieldset>
    <fieldset><legend>Documentação da oferta</legend><div class="grid">
      ${area("Hub","oferta",id,"doc",o.doc,"Research, avatar, mecanismo, promessa, estrutura do funil, links — tudo que alguém precisa pra assumir essa oferta sozinho.")}
    </div></fieldset>`;

  return dShell(o.nome||"Sem nome", o.id, inner, "del-oferta", id);
}

function drawerLeva(id){
  const l = byId(state.levas,id); if(!l) return "";
  const o = byId(state.ofertas,l.ofertaId);
  const cris = crisDe(id);
  const list = cris.length
    ? `<div class="twrap" style="margin-top:4px;max-height:none"><table><tbody>` + cris.map(c =>
        `<tr><td class="id" data-open="criativo" data-id="${h(c.id)}" style="cursor:pointer">${h(c.id)}</td>
         <td class="txt">${h(c.hook||"—")}</td><td class="n">${money(c.gasto)}</td>
         <td>${pill(c.veredito||"VALIDADO")}</td></tr>`).join("") + `</tbody></table></div>`
    : `<p style="color:var(--muted);font-size:13px;margin:2px 0 10px">Nenhum criativo gastou nesta leva ainda.</p>`;

  const inner =
    `<fieldset><legend>Leva</legend><div class="grid">
      ${calc("Oferta", o ? o.nome : "—")}
      ${fld("Data de entrega","leva",id,"dataEntrega","date",String(l.dataEntrega||"").slice(0,10))}
      ${calc("Leitura (+2d)", br(addDays(l.dataEntrega,2)))}
      ${fld("Qtd de criativos","leva",id,"qtd","number",l.qtd==null?20:l.qtd)}
    </div><div class="grid" style="margin-top:10px">
      ${area("Ângulo da leva","leva",id,"angulo",l.angulo,"O tema que orienta os 20 criativos deste lote.")}
    </div></fieldset>
    <fieldset><legend>Produção</legend><div class="grid g3">
      ${sel("Copy","leva",id,"copy",ST_PROD,l.copy||"A FAZER")}
      ${sel("Edição","leva",id,"edicao",ST_PROD,l.edicao||"A FAZER")}
      ${sel("Tráfego","leva",id,"trafego",ST_TRAF,l.trafego||"A FAZER")}
    </div></fieldset>
    <fieldset><legend>Criativos que gastaram
      <span style="float:right;font-weight:400;text-transform:none;letter-spacing:0">
      ${podeEditar?`<button class="btn sm" data-act="new-criativo" data-id="${h(id)}">+ criativo</button>`:""}</span></legend>
      ${list}</fieldset>
    <fieldset><legend>Observações</legend><div class="grid">${area("","leva",id,"obs",l.obs)}</div></fieldset>`;

  return dShell("Leva "+(String(l.id).split("-L")[1]||""), l.id, inner, "del-leva", id);
}

function drawerCriativo(id){
  const c = byId(state.criativos,id); if(!c) return "";
  const l = byId(state.levas,c.levaId);
  const o = l ? byId(state.ofertas,l.ofertaId) : null;
  const irmaos = state.criativos.filter(x => {
    if (x.id === c.id) return false;
    const xl = byId(state.levas,x.levaId);
    return xl && l && xl.ofertaId === l.ofertaId;
  }).map(x => x.id);

  const inner =
    `<fieldset><legend>Identificação</legend><div class="grid">
      ${calc("Oferta", o ? o.nome : "—")}${calc("Leva", c.levaId)}
    </div>
    <div class="f full" style="margin-top:10px"><label>ID = nome do anúncio no Meta</label>
      <div class="calc" style="display:flex;align-items:center;gap:8px">
        <span style="flex:1">${h(c.id)}</span>
        <button class="btn sm" data-copy="${h(c.id)}">Copiar</button></div></div></fieldset>
    <fieldset><legend>Anatomia</legend><div class="grid">
      ${fld("Ângulo","criativo",id,"angulo","text",c.angulo,"A dor/desejo que o criativo ataca.")}
      ${fld("Ângulo do hook","criativo",id,"anguloHook","text",c.anguloHook,"Por onde o hook entra.")}
      ${fld("Hook","criativo",id,"hook","text",c.hook,"A primeira frase/imagem.")}
      ${sel("Formato","criativo",id,"formato",[""].concat(FORMATOS),c.formato||"")}
    </div><div class="grid" style="margin-top:10px">
      ${area("Body","criativo",id,"body",c.body,"O corpo do criativo — desenvolvimento, prova, CTA.")}
    </div><div class="grid" style="margin-top:10px">
      <div class="f"><label>Pai (de qual vencedor saiu)</label>
      <select data-edit="criativo" data-id="${h(id)}" data-field="pai"${ro()}>${opts([""].concat(irmaos), c.pai||"")}</select>
      <span class="hint">Deixe vazio se for criativo original.</span></div>
    </div></fieldset>
    <fieldset><legend>Resultado</legend><div class="grid g3">
      ${fld("Gasto (R$)","criativo",id,"gasto","number",c.gasto)}
      ${fld("CPA (R$)","criativo",id,"cpa","number",c.cpa)}
      ${fld("ROAS","criativo",id,"roas","number",c.roas)}
    </div><div class="grid" style="margin-top:10px">
      ${sel("Veredito","criativo",id,"veredito",ST_VER_C,c.veredito||"VALIDADO")}
    </div><div class="grid" style="margin-top:10px">
      ${area("Observações","criativo",id,"obs",c.obs)}
    </div></fieldset>`;

  return dShell(c.hook || "Criativo", c.id, inner, "del-criativo", id);
}

// ---------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------
async function novaOferta(){
  const nome = prompt("Nome da oferta:"); if(!nome) return;
  let sig = prompt("Sigla de 3 letras (ex: ART):",""); if(!sig) return;
  sig = sig.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3);
  if(sig.length < 2){ toast("A sigla precisa ter ao menos 2 letras.", true); return; }
  let pais = (prompt("País (BR, AR, MX, CO, CL, PE, EC, ES, PT, US, IT):","BR")||"BR").toUpperCase();
  if(!PAISES.includes(pais)) pais = "BR";

  const pre = `${sig}-${pais}-`;
  const jaTem = state.ofertas.filter(o => o.id.startsWith(pre)).length;
  try {
    const nova = await inserirComId("ofertas", n => pre + pad(jaTem + n), {
      nome, pais, responsavel:"", fase:1, linkDrive:"", linkCheckout:"", doc:"",
      build:{research:"A FAZER",entregavel:"A FAZER",checkout:"A FAZER",
             obEntregavel:"A FAZER",app:"A FAZER",backRedirect:"A FAZER"},
      dataInicio:"", dataFinal:"", investido:"", faturamento:"",
      ticketMedio:"", takeRateOB:"", veredito:"EM TESTE", aprendizado:"", obs:""
    });
    state.ofertas.push(nova);
    render(); openDrawer("oferta", nova.id);
  } catch(e){ toast("Não consegui criar: " + (e.message||e), true); }
}

async function novaLeva(){
  const elegiveis = state.ofertas.filter(o => Number(o.fase||1)===2 || o.veredito==="APROVADO → FASE 2");
  if(!elegiveis.length){ toast("Nenhuma oferta em Fase 2.", true); return; }
  let oid = levaOferta && byId(elegiveis,levaOferta) ? levaOferta : null;
  if(!oid){
    const msg = "Para qual oferta?\n\n" + elegiveis.map((o,i) => `${i+1}) ${o.id} — ${o.nome}`).join("\n");
    const pick = parseInt(prompt(msg,"1"),10);
    if(!pick || !elegiveis[pick-1]) return;
    oid = elegiveis[pick-1].id;
  }
  const jaTem = levasDe(oid).length;
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-${pad(hoje.getDate())}`;
  try {
    const nova = await inserirComId("levas", n => `${oid}-L${pad(jaTem + n)}`, {
      ofertaId: oid, dataEntrega: iso, qtd: 20, angulo:"",
      copy:"A FAZER", edicao:"A FAZER", trafego:"A FAZER", obs:""
    });
    state.levas.push(nova);
    render(); openDrawer("leva", nova.id);
  } catch(e){ toast("Não consegui criar: " + (e.message||e), true); }
}

async function novoCriativo(levaId){
  const l = byId(state.levas,levaId); if(!l) return;
  const jaTem = crisDe(levaId).length;
  try {
    const novo = await inserirComId("criativos", n => `${levaId}-C${pad(jaTem + n)}`, {
      levaId, angulo: l.angulo||"", anguloHook:"", hook:"", formato:"", body:"",
      pai:"", gasto:"", cpa:"", roas:"", veredito:"VALIDADO", obs:""
    });
    state.criativos.push(novo);
    openDrawer("criativo", novo.id);
  } catch(e){ toast("Não consegui criar: " + (e.message||e), true); }
}

// ---------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------
const csvCell = v => { const s = String(v==null?"":v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
const toCsv = (head,rows) => [head,...rows].map(r => r.map(csvCell).join(";")).join("\n");

function exportCsv(which){
  let name, csv;
  if(which==="ofertas"){
    name = "kaian-lab-ofertas.csv";
    csv = toCsv(["ID","Nome","Pais","Responsavel","Fase",...BUILD_STEPS.map(s=>s[1]),
      "Inicio","Leitura","Final","Investido","Faturamento","Lucro","ROAS","Ticket Medio","Take Rate OB","Veredito","Aprendizado","Observacoes"],
      state.ofertas.map(o => {
        const l = lucro(o), r = roas(o);
        return [o.id,o.nome,o.pais,o.responsavel,o.fase||1,
          ...BUILD_STEPS.map(s => (o.build&&o.build[s[0]])||"A FAZER"),
          o.dataInicio,addDays(o.dataInicio,5),o.dataFinal,o.investido,o.faturamento,
          l==null?"":l, r==null?"":r.toFixed(2), o.ticketMedio,o.takeRateOB,o.veredito,o.aprendizado,o.obs];
      }));
  } else if(which==="levas"){
    name = "kaian-lab-levas.csv";
    csv = toCsv(["ID Leva","Oferta","Nome Oferta","Entrega","Leitura","Qtd","Angulo","Copy","Edicao","Trafego","Criativos que gastaram","Observacoes"],
      state.levas.map(l => {
        const o = byId(state.ofertas,l.ofertaId);
        return [l.id,l.ofertaId,o?o.nome:"",l.dataEntrega,addDays(l.dataEntrega,2),l.qtd,l.angulo,l.copy,l.edicao,l.trafego,crisDe(l.id).length,l.obs];
      }));
  } else {
    name = "kaian-lab-criativos.csv";
    csv = toCsv(["ID","Leva","Oferta","Angulo","Angulo do Hook","Hook","Formato","Body","Pai","Gasto","CPA","ROAS","Veredito","Observacoes"],
      state.criativos.map(c => {
        const l = byId(state.levas,c.levaId); const o = l?byId(state.ofertas,l.ofertaId):null;
        return [c.id,c.levaId,o?o.nome:"",c.angulo,c.anguloHook,c.hook,c.formato,c.body,c.pai,c.gasto,c.cpa,c.roas,c.veredito,c.obs];
      }));
  }
  const blob = new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------
function tabelaDe(kind){ return kind==="oferta" ? "ofertas" : kind==="leva" ? "levas" : "criativos"; }
function listaDe(kind){ return kind==="oferta" ? state.ofertas : kind==="leva" ? state.levas : state.criativos; }

document.addEventListener("click", async (e) => {
  const t = e.target;

  const cp = t.closest?.("[data-copy]");
  if(cp){
    e.stopPropagation();
    const val = cp.getAttribute("data-copy");
    try { await navigator.clipboard.writeText(val); } catch { /* sem permissão */ }
    const old = cp.textContent; cp.textContent = "✓";
    setTimeout(() => { cp.textContent = old; }, 900);
    return;
  }

  const tab = t.closest?.("[data-view]");
  if(tab){ view = tab.getAttribute("data-view"); render(); return; }

  const act = t.closest?.("[data-act]");
  if(act){
    const a = act.getAttribute("data-act"), aid = act.getAttribute("data-id");
    if(a==="new-oferta") novaOferta();
    else if(a==="new-leva") novaLeva();
    else if(a==="new-criativo"){ e.stopPropagation(); novoCriativo(aid); }
    else if(a==="close-drawer") closeDrawer();
    else if(a==="regravar") descarregar();
    else if(a==="recarregar") location.reload();
    else if(a==="sair"){ await descarregar(); await sair(); location.reload(); }
    else if(a==="csv-ofertas") exportCsv("ofertas");
    else if(a==="csv-levas") exportCsv("levas");
    else if(a==="csv-criativos") exportCsv("criativos");
    else if(a==="del-oferta"){
      const nl = levasDe(aid).length;
      if(confirm(`Excluir a oferta ${aid}${nl?` e suas ${nl} leva(s) e criativos`:""}? Não dá pra desfazer.`)){
        try {
          await remover("ofertas", aid);
          const lids = levasDe(aid).map(x => x.id);
          state.criativos = state.criativos.filter(c => !lids.includes(c.levaId));
          state.levas = state.levas.filter(l => l.ofertaId !== aid);
          state.ofertas = state.ofertas.filter(x => x.id !== aid);
          closeDrawer();
        } catch(err){ toast("Não consegui excluir: " + (err.message||err), true); }
      }
    }
    else if(a==="del-leva"){
      if(confirm(`Excluir a leva ${aid} e seus criativos?`)){
        try {
          await remover("levas", aid);
          state.criativos = state.criativos.filter(c => c.levaId !== aid);
          state.levas = state.levas.filter(l => l.id !== aid);
          closeDrawer();
        } catch(err){ toast("Não consegui excluir: " + (err.message||err), true); }
      }
    }
    else if(a==="del-criativo"){
      if(confirm(`Excluir o criativo ${aid}?`)){
        try {
          await remover("criativos", aid);
          state.criativos = state.criativos.filter(c => c.id !== aid);
          closeDrawer();
        } catch(err){ toast("Não consegui excluir: " + (err.message||err), true); }
      }
    }
    return;
  }

  const op = t.closest?.("[data-open]");
  if(op){ openDrawer(op.getAttribute("data-open"), op.getAttribute("data-id")); return; }
  if(t.id === "scrim") closeDrawer();
});

document.addEventListener("change", (e) => {
  const t = e.target;

  if(t.hasAttribute?.("data-inline")){
    const kind = t.getAttribute("data-inline"), id = t.getAttribute("data-id"), v = t.value;
    if(kind.startsWith("leva.")){
      const campo = kind.split(".")[1];
      const l = byId(state.levas,id); if(l) l[campo] = v;
      agendarPatch("levas", id, { [campo]: v });
    } else if(kind === "cri.veredito"){
      const c = byId(state.criativos,id); if(c) c.veredito = v;
      agendarPatch("criativos", id, { veredito: v });
    }
    t.className = "pillsel p-" + tone(v);
    return;
  }

  if(t.hasAttribute?.("data-build")){
    const id = t.getAttribute("data-build");
    const o = byId(state.ofertas, id);
    if(o){
      o.build = { ...(o.build||{}), [t.getAttribute("data-step")]: t.value };
      agendarPatch("ofertas", id, { build: o.build });
    }
    t.className = "p-" + tone(t.value);
    return;
  }

  if(t.hasAttribute?.("data-ofilter")){
    if(t.getAttribute("data-ofilter")==="leva") levaOferta = t.value; else criOferta = t.value;
    render();
  }
});

document.addEventListener("input", (e) => {
  const t = e.target;

  if(t.hasAttribute?.("data-filter")){
    const nome = t.getAttribute("data-filter");
    filters[nome] = t.value;
    const pos = t.selectionStart;
    render();
    const again = document.querySelector(`[data-filter="${nome}"]`);
    if(again){ again.focus(); try{ again.setSelectionRange(pos,pos); }catch{} }
    return;
  }

  if(t.hasAttribute?.("data-edit")){
    const kind = t.getAttribute("data-edit"), id = t.getAttribute("data-id"), f = t.getAttribute("data-field");
    const rec = byId(listaDe(kind), id);
    if(!rec) return;
    rec[f] = (f === "fase") ? Number(t.value) : t.value;
    agendarPatch(tabelaDe(kind), id, { [f]: rec[f] });

    const fs = t.closest("fieldset");
    if(f==="dataInicio"){ const c = fs?.querySelector(".calc"); if(c) c.textContent = br(addDays(t.value,5)); }
    if(f==="dataEntrega"){ const cs = fs?.querySelectorAll(".calc"); if(cs?.[1]) cs[1].textContent = br(addDays(t.value,2)); }
    if(kind==="oferta" && (f==="investido"||f==="faturamento")){
      const cs = fs?.querySelectorAll(".calc");
      const l = lucro(rec), r = roas(rec);
      if(cs?.[0]){ cs[0].textContent = l==null?"—":money(l); cs[0].className = "calc " + (l>0?"pos":(l<0?"neg":"")); }
      if(cs?.[1]) cs[1].textContent = r==null?"—":num(r);
    }
  }
});

document.addEventListener("keydown", (e) => {
  if(e.key === "Escape" && drawerCtx) closeDrawer();
  if((e.metaKey||e.ctrlKey) && e.key === "s"){ e.preventDefault(); descarregar(); }
});

window.addEventListener("beforeunload", (e) => {
  if(temPendencia()){ e.preventDefault(); e.returnValue = ""; }
});

// ---------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------
function aplicarRemoto({ tabela, tipo, linha, id }){
  // Não sobrescreve a linha que a pessoa está editando agora na gaveta.
  if (drawerCtx && drawerCtx.id === id) return;
  const lista = state[tabela];
  const i = lista.findIndex(x => x.id === id);
  if(tipo === "DELETE"){ if(i >= 0) lista.splice(i,1); }
  else if(linha){ if(i >= 0) lista[i] = linha; else lista.push(linha); }
  render();
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
async function boot(){
  try {
    await bootInterno();
  } catch(e){
    // Sem isto, qualquer falha aqui (rede, sessão expirada) deixava a
    // página carregando pra sempre, sem nada na tela.
    telaErro(e);
  }
}

async function bootInterno(){
  if(!configurado){ telaConfig(); return; }

  sessao = await sessaoAtual();
  if(!sessao){ telaLogin(); return; }

  papel = await meuPapel();
  if(!papel){ telaSemAcesso(); return; }
  podeEditar = papel === "editor";

  try {
    state = await carregarTudo();
  } catch(e){ telaErro(e); return; }

  if(!assinaturasLigadas){
    assinaturasLigadas = true;
    aoMudarGravacao((estado, detalhe) => {
      gravacao = estado;
      if(estado === "erro"){
        erroGravacao = detalhe?.message || "";
        toast("Não consegui gravar: " + erroGravacao, true);
      }
      paintSave();
    });
    inscrever(aplicarRemoto);
  }
  render();
}

function explicaErro(err){
  const m = String(err?.message || err || "");
  if(/failed to fetch|networkerror|load failed/i.test(m))
    return "não consegui falar com o Supabase. Confira a URL em assets/config.js e sua conexão.";
  if(/invalid api key|jwt/i.test(m))
    return "a chave anon em assets/config.js parece inválida.";
  if(/invalid login credentials/i.test(m))
    return "E-mail ou senha incorretos.";
  if(/email not confirmed/i.test(m))
    return "Esse usuário ainda não foi confirmado no Supabase.";
  if(/rate limit|too many/i.test(m))
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  return m;
}

document.addEventListener("submit", async (e) => {
  if(e.target.id !== "formLogin") return;
  e.preventDefault();
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  const aviso = document.getElementById("avisoLogin");
  const botao = e.target.querySelector("button");
  botao.disabled = true;
  aviso.textContent = "Entrando…";
  try {
    await entrar(email, senha);
    await boot();
  } catch(err){
    aviso.textContent = explicaErro(err);
    botao.disabled = false;
  }
});

aoMudarAuth((evento) => {
  // Só SIGNED_OUT recarrega. SIGNED_IN NÃO pode recarregar: o supabase-js
  // dispara esse evento toda vez que restaura a sessão salva ao abrir a
  // página, e recarregar aqui gera laço infinito. Quem monta a tela depois
  // do login é o boot(), chamado direto no submit.
  if(evento === "SIGNED_OUT") location.reload();
});

boot();
