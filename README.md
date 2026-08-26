# KAIAN LAB

Esteira de produção da operação — Fase 1 (validação & modelagem) e Fase 2
(otimização constante), com banco de verdade e acesso por pessoa.

Stack: HTML/CSS/JS puro (sem build) · **Supabase** (Postgres + auth + realtime) · **Netlify**.

---

## Já está no ar

| | |
|---|---|
| **App** | https://esteira.kaiandigital.online |
| **Netlify** | projeto `kaianlab`, deploy automático a cada push na `main` |
| **Supabase** | projeto `kaian-lab`, org gratuita "Kaian Lab" |
| **Região** | `sa-east-1` (São Paulo) |
| **Compute** | Nano — custo zero |
| **Ref do projeto** | `nnebxmtzzobdcchcqryx` |

O schema já foi aplicado e conferido no banco: 4 tabelas, todas com RLS,
7 políticas, 3 tabelas no realtime, 3 triggers de `atualizado_em`.

Autenticação já configurada:

- **Site URL:** `https://esteira.kaiandigital.online`
- **Redirect URLs:** `https://esteira.kaiandigital.online/**` e `http://localhost:8899/**`

Não há curinga tipo `*.netlify.app` na lista de redirect, de propósito: um
curinga assim deixaria qualquer site naquele domínio receber o token do link
mágico de quem estivesse logando.

### Se precisar refazer do zero

1. Criar projeto no Supabase (a senha do banco é sua, use *Generate a password*).
2. Rodar [`sql/schema.sql`](sql/schema.sql) no SQL Editor.
3. Pôr URL + chave publicável em [`assets/config.js`](assets/config.js).
4. Configurar Site URL e Redirect URLs em Authentication → URL Configuration.
5. Conectar o repo no Netlify (sem comando de build; o `netlify.toml` resolve).

---

## Login

**E-mail e senha.** Sem link por e-mail, sem código, sem espera. Entra uma vez e
o navegador guarda a sessão.

Os usuários são criados no painel do Supabase, em **Authentication → Users →
Add user**, com *Auto Confirm User* ligado. Cadastro público está desligado, então
ninguém cria conta sozinho.

São duas listas e as duas precisam ter a pessoa:

1. **Authentication → Users** — é quem consegue autenticar (tem e-mail e senha).
2. **Tabela `membros`** — é quem o RLS deixa enxergar os dados.

Estar só na primeira significa entrar e ver a tela de "Sem acesso". Estar só na
segunda significa não conseguir entrar.

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

Lembre que a linha em `membros` sozinha não basta: a pessoa também precisa
existir em **Authentication → Users**, com senha e *Auto Confirm User* ligado.
Uma lista diz quem consegue entrar; a outra diz quem enxerga os dados.

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
