# KAIAN LAB

Esteira de produção da operação — Fase 1 (validação & modelagem) e Fase 2
(otimização constante), com banco de verdade e acesso por pessoa.

Stack: HTML/CSS/JS puro (sem build) · **Supabase** (Postgres + auth + realtime) · **Netlify**.

---

## Ligar (4 passos, ~15 min)

### 1. Criar o projeto no Supabase

Em <https://supabase.com> → **New project**. Guarde a senha do banco que ele pede
(você não precisa dela no dia a dia, mas não dá pra recuperar depois).

### 2. Criar as tabelas

No painel do projeto → **SQL Editor** → **New query** → cole todo o conteúdo de
[`sql/schema.sql`](sql/schema.sql) → **Run**.

Isso cria as três tabelas, liga a segurança por linha (RLS), liga o realtime e
já libera o seu e-mail como `editor`. Pode rodar de novo quando quiser: é idempotente.

### 3. Apontar o app pro seu projeto

No Supabase → **Project Settings** → **Data API**, copie:

- **Project URL**
- **anon public** (a chave pública)

Cole os dois em [`assets/config.js`](assets/config.js).

> A chave `anon` é pública por natureza — ela existe pra ficar no navegador.
> Quem protege os dados é o RLS, não o sigilo dela.
> **Nunca** coloque a `service_role` aí: essa ignora o RLS.

### 4. Publicar no Netlify

Em <https://netlify.com> → **Add new site** → **Import an existing project** →
conecte este repositório.

Não precisa configurar build: o `netlify.toml` já diz que o site é a raiz e que
não há comando de build. Cada `git push` publica sozinho.

---

## Liberar o time

Só quem está na tabela `membros` enxerga a base — ter conta no Supabase não basta.
No **SQL Editor**, uma linha por pessoa:

```sql
insert into membros (email, nome, papel)
values ('fulano@gmail.com', 'Fulano', 'editor')
on conflict (email) do update set papel = excluded.papel;
```

- `editor` — cadastra e altera.
- `leitor` — só consulta (o app entra em modo somente leitura).

Tirar o acesso:

```sql
delete from membros where email = 'fulano@gmail.com';
```

O login é por **link mágico**: a pessoa digita o e-mail, recebe um link, clica e
entra. Sem senha pra gerenciar.

---

## Estrutura

```
index.html            casca da página
netlify.toml          config do deploy
assets/
  config.js           ← você preenche (URL + chave anon)
  dados.js            camada de dados: Supabase, auth, realtime
  app.js              interface
  estilo.css          estilos
sql/
  schema.sql          tabelas, RLS, realtime, allowlist
artifact/
  kaian-lab.html      MVP anterior (roda dentro do Claude, sem banco)
```

### As três tabelas

| Tabela      | Grão                  | Volume                     |
|-------------|-----------------------|----------------------------|
| `ofertas`   | uma oferta            | dezenas                    |
| `levas`     | lote de ~20 criativos | ~3 por semana, por oferta  |
| `criativos` | criativo que gastou   | só os que tiveram entrega  |

`criativos` **não** guarda os 20 da leva — só entra quem gastou. A quantidade
do lote vive no campo `qtd` da leva.

---

## Convenções

IDs são gerados pelo app, hierárquicos:

```
ART-BR-01              oferta   (3 letras + país + sequencial)
ART-BR-01-L07          leva 07
ART-BR-01-L07-C03      criativo 03  ← este é o nome do anúncio no Meta
```

**Regra inegociável:** o ID do criativo é o nome do anúncio no Meta. É a chave
que permite casar resultado com criativo. O app tem botão de copiar no ID.

Janelas de leitura, calculadas sozinhas:

- **Fase 1: +5 dias** do início — existe pra medir o take rate do orderbump.
- **Fase 2: +2 dias** da entrega da leva.

O resto das convenções (status, vereditos, o porquê de cada um) está na aba
**Guia** dentro do próprio app.

---

## Gravação e concorrência

Cada campo grava sozinho ~1s depois que você para de digitar, com `UPDATE` na
coluna daquela linha. Duas pessoas mexendo em colunas diferentes da mesma leva
**não se sobrescrevem**. O realtime replica a alteração na tela de quem estiver
com o app aberto.

Único caso de conflito que sobra: duas pessoas editando **o mesmo campo da mesma
linha** no mesmo instante — aí vale o último. Na prática não acontece, porque
copy, edição e tráfego são colunas separadas.

---

## Rodar localmente

Precisa de um servidor (módulos ES não funcionam via `file://`):

```bash
python3 -m http.server 8899
```

Depois abra <http://localhost:8899>. Se editar arquivos em `assets/`, force
recarregar sem cache — o navegador guarda módulos de forma agressiva. Em
produção o `netlify.toml` já manda revalidar sempre.

---

## MVP anterior

`artifact/kaian-lab.html` é a primeira versão, que roda dentro do Claude e guarda
os dados no próprio HTML. Continua no ar e funcional, mas foi substituída por
esta — ela não tem banco, não tem login e o salvamento é do documento inteiro
(quem salva por último ganha).
