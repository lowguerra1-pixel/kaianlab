// =====================================================================
// KAIAN LAB — camada de dados (Supabase)
//
// Diferença central pro MVP antigo: aqui a gravação é por CAMPO de uma
// linha, não pelo documento inteiro. Duas pessoas mexendo em colunas
// diferentes da mesma leva não se sobrescrevem mais.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SUPABASE_URL, SUPABASE_ANON_KEY, configurado } from "./config.js";

export { configurado };

export const sb = configurado
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

// ---------------------------------------------------------------------
// Tradução camelCase (app) <-> snake_case (banco)
// ---------------------------------------------------------------------
const MAPA = {
  ofertas: {
    id:"id", nome:"nome", pais:"pais", responsavel:"responsavel", fase:"fase",
    linkDrive:"link_drive", linkCheckout:"link_checkout", doc:"doc", build:"build",
    dataInicio:"data_inicio", dataFinal:"data_final",
    investido:"investido", faturamento:"faturamento",
    ticketMedio:"ticket_medio", takeRateOB:"take_rate_ob",
    veredito:"veredito", aprendizado:"aprendizado", obs:"obs"
  },
  levas: {
    id:"id", ofertaId:"oferta_id", dataEntrega:"data_entrega", qtd:"qtd",
    angulo:"angulo", copy:"copy", edicao:"edicao", trafego:"trafego", obs:"obs"
  },
  criativos: {
    id:"id", levaId:"leva_id", angulo:"angulo", anguloHook:"angulo_hook",
    hook:"hook", formato:"formato", body:"body", pai:"pai",
    gasto:"gasto", cpa:"cpa", roas:"roas", veredito:"veredito", obs:"obs"
  }
};

const NUMERICOS = new Set(["investido","faturamento","ticketMedio","takeRateOB","gasto","cpa","roas"]);
const INTEIROS  = new Set(["fase","qtd"]);
const DATAS     = new Set(["dataInicio","dataFinal","dataEntrega"]);

function valorParaDb(campo, v){
  if (NUMERICOS.has(campo) || INTEIROS.has(campo)){
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (DATAS.has(campo)) return (v === "" || v == null) ? null : v;
  if (campo === "pai") return (v === "" || v == null) ? null : v;
  return v;
}

export function paraDb(tabela, obj){
  const m = MAPA[tabela], out = {};
  for (const [appK, dbK] of Object.entries(m)){
    if (Object.prototype.hasOwnProperty.call(obj, appK)) out[dbK] = valorParaDb(appK, obj[appK]);
  }
  return out;
}

export function paraApp(tabela, row){
  const m = MAPA[tabela], out = {};
  for (const [appK, dbK] of Object.entries(m)){
    let v = row[dbK];
    if (v === null || v === undefined) v = (appK === "build") ? {} : "";
    out[appK] = v;
  }
  return out;
}

// ---------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------
export async function sessaoAtual(){
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export async function entrar(email, senha){
  const { error } = await sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha
  });
  if (error) throw error;
}

export async function sair(){ if (sb) await sb.auth.signOut(); }

export function aoMudarAuth(cb){
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((evento) => cb(evento));
  return () => data.subscription.unsubscribe();
}

/** Devolve 'editor' | 'leitor' | null (null = autenticado mas fora da allowlist). */
export async function meuPapel(){
  if (!sb) return null;
  const { data, error } = await sb.from("membros").select("papel").limit(1).maybeSingle();
  if (error || !data) return null;
  return data.papel;
}

// ---------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------
export async function carregarTudo(){
  const [o, l, c] = await Promise.all([
    sb.from("ofertas").select("*").order("id"),
    sb.from("levas").select("*").order("data_entrega", { ascending: false }),
    sb.from("criativos").select("*").order("id", { ascending: false })
  ]);
  const erro = o.error || l.error || c.error;
  if (erro) throw erro;
  return {
    ofertas:   (o.data || []).map(r => paraApp("ofertas", r)),
    levas:     (l.data || []).map(r => paraApp("levas", r)),
    criativos: (c.data || []).map(r => paraApp("criativos", r))
  };
}

// ---------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------
export async function remover(tabela, id){
  const { error } = await sb.from(tabela).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Insere gerando o ID por tentativa. Se outra pessoa criou o mesmo ID no
 * mesmo instante o banco recusa (PK duplicada) e tentamos o número seguinte.
 * É isto que impede dois "ART-BR-01" nascerem ao mesmo tempo.
 */
export async function inserirComId(tabela, gerarId, base, tentativas = 12){
  let ultimoErro = null;
  for (let n = 1; n <= tentativas; n++){
    const id = gerarId(n);
    const linha = paraDb(tabela, { ...base, id });
    const { data, error } = await sb.from(tabela).insert(linha).select().single();
    if (!error) return paraApp(tabela, data);
    if (error.code !== "23505") throw error;   // 23505 = chave duplicada
    ultimoErro = error;
  }
  throw ultimoErro ?? new Error("não consegui gerar um ID livre");
}

// --------- fila de gravação: junta as teclas numa chamada só ----------
const pendentes = new Map();          // "tabela:id" -> { tabela, id, patch }
let temporizador = null;
let emVoo = 0;
const ouvintes = new Set();

function avisar(estado, detalhe){ ouvintes.forEach(f => f(estado, detalhe)); }
export function aoMudarGravacao(cb){ ouvintes.add(cb); return () => ouvintes.delete(cb); }
export function temPendencia(){ return pendentes.size > 0 || emVoo > 0; }

export function agendarPatch(tabela, id, patch){
  const chave = tabela + ":" + id;
  const atual = pendentes.get(chave) || { tabela, id, patch: {} };
  Object.assign(atual.patch, patch);
  pendentes.set(chave, atual);
  avisar("pendente");
  clearTimeout(temporizador);
  temporizador = setTimeout(descarregar, 700);
}

export async function descarregar(){
  clearTimeout(temporizador);
  if (!pendentes.size) return;
  const lote = [...pendentes.values()];
  pendentes.clear();
  emVoo += lote.length;
  avisar("gravando");
  try {
    await Promise.all(lote.map(async ({ tabela, id, patch }) => {
      const { error } = await sb.from(tabela).update(paraDb(tabela, patch)).eq("id", id);
      if (error) throw error;
    }));
    emVoo -= lote.length;
    avisar(temPendencia() ? "pendente" : "ok");
  } catch (e){
    emVoo = Math.max(0, emVoo - lote.length);
    avisar("erro", e);
  }
}

// ---------------------------------------------------------------------
// Realtime — a alteração de um aparece na tela do outro
// ---------------------------------------------------------------------
export function inscrever(aoReceber){
  if (!sb) return () => {};
  const canal = sb.channel("kaian-lab");
  for (const tabela of ["ofertas","levas","criativos"]){
    canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, (msg) => {
      aoReceber({
        tabela,
        tipo: msg.eventType,                                   // INSERT | UPDATE | DELETE
        linha: msg.new && msg.new.id ? paraApp(tabela, msg.new) : null,
        id: (msg.new && msg.new.id) || (msg.old && msg.old.id) || null
      });
    });
  }
  canal.subscribe();
  return () => sb.removeChannel(canal);
}
