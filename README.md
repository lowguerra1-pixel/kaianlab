# KAIAN LAB

Esteira de produção da operação. Aplicação de arquivo único: todo o app
(HTML + CSS + JS + dados) vive em `kaian-lab.html`.

**App no ar:** https://claude.ai/code/artifact/25ed7a03-b632-404d-894c-a6151086b6ef

---

## ⚠️ Leia antes de republicar

Este repositório guarda o **código**. O artifact publicado guarda o **código + os
dados do time**.

Os dados ficam dentro do próprio HTML, num bloco `<script id="kl-state">`. No
arquivo deste repo esse bloco está **vazio**:

```html
<script id="kl-state" type="application/json">{"v":1,"ofertas":[],"levas":[],"criativos":[]}</script>
```

Ou seja: **republicar este arquivo por cima do app no ar apaga tudo que o time
cadastrou.**

### O jeito certo de alterar o app

1. Traga o estado vivo pro arquivo local antes de mexer. Peça ao Claude:
   *"lê o artifact do Kaian Lab e traz o estado atual pro kaian-lab.html"*
2. Faça a alteração de código.
3. Republique (mesma URL).
4. Commite — o arquivo commitado deve voltar com o bloco de estado **vazio**,
   pra não versionar dados de operação junto com código.

Se só quiser um backup dos dados, use os botões **CSV** dentro do app.

---

## Estrutura de dados

Três tabelas ligadas, dentro do bloco de estado:

| Tabela      | Grão                  | Volume aproximado          |
|-------------|-----------------------|----------------------------|
| `ofertas`   | uma oferta            | dezenas                    |
| `levas`     | lote de ~20 criativos | ~3 por semana, por oferta  |
| `criativos` | criativo que gastou   | só os que receberam entrega |

`criativos` **não** guarda os 20 da leva — só entra quem gastou.

## Convenção de ID

Gerada automaticamente pelo app, hierárquica:

```
ART-BR-01              oferta   (3 letras + país + sequencial)
ART-BR-01-L07          leva 07
ART-BR-01-L07-C03      criativo 03  ← este é o nome do anúncio no Meta
```

**Regra inegociável:** o ID do criativo é o nome do anúncio no Meta. É a chave
que permite casar resultado com criativo. O app tem botão de copiar no ID.

## Janelas de leitura

- **Fase 1:** 5 dias após o início (calculado). Existe pra medir o take rate do orderbump.
- **Fase 2:** 2 dias após a entrega da leva (calculado).

## Rodar localmente

O arquivo do repo é o conteúdo do `<body>` — o wrapper (`doctype`, `head`) é
adicionado na publicação. Pra abrir no navegador, envolva num documento completo
ou publique como artifact. O salvamento compartilhado só funciona publicado.
