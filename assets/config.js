// =====================================================================
// KAIAN LAB — configuração
//
// Preencha com os dados do SEU projeto Supabase.
// Onde achar: painel do Supabase > Project Settings > Data API
//   SUPABASE_URL      = "Project URL"
//   SUPABASE_ANON_KEY = "anon public" (ou "publishable")
//
// A chave anon é PÚBLICA por natureza — ela nasce pra ficar no navegador.
// Quem protege os dados é o RLS do schema.sql, não o sigilo dela.
// NUNCA coloque aqui a chave "service_role": essa ignora o RLS.
// =====================================================================

export const SUPABASE_URL = "https://nnebxmtzzobdcchcqryx.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_peUlsY5yFnCZaCajhnIIIg_E1b8p1hu";

export const configurado =
  SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_URL.startsWith("COLE_AQUI") && !SUPABASE_ANON_KEY.startsWith("COLE_AQUI");
