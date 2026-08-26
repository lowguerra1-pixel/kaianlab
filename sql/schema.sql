-- =====================================================================
-- KAIAN LAB — schema
-- Cole isto inteiro no SQL Editor do Supabase e rode uma vez.
-- Pode rodar de novo sem quebrar nada (é idempotente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ALLOWLIST
-- Só quem estiver aqui enxerga a base, mesmo tendo conta no Supabase.
-- 'editor' cadastra e altera. 'leitor' só consulta.
-- ---------------------------------------------------------------------
create table if not exists public.membros (
  email     text primary key,
  nome      text not null default '',
  papel     text not null default 'editor' check (papel in ('editor','leitor')),
  criado_em timestamptz not null default now()
);

create or replace function public.membro_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.membros
   where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.eh_membro()
returns boolean language sql stable security definer set search_path = public as $$
  select public.membro_papel() is not null
$$;

create or replace function public.eh_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.membro_papel() = 'editor', false)
$$;

-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------
create table if not exists public.ofertas (
  id             text primary key,          -- ART-BR-01
  nome           text not null default '',
  pais           text not null default 'BR',
  responsavel    text not null default '',
  fase           smallint not null default 1,
  link_drive     text not null default '',
  link_checkout  text not null default '',
  doc            text not null default '',
  build          jsonb not null default '{}'::jsonb,
  data_inicio    date,
  data_final     date,
  investido      numeric,
  faturamento    numeric,
  ticket_medio   numeric,
  take_rate_ob   numeric,
  veredito       text not null default 'EM TESTE',
  -- build: BRAIN > A FAZER > FAZENDO > EM REVISÃO > APROVADO (+ BLOQUEADO, N/A)
  aprendizado    text not null default '',
  obs            text not null default '',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.levas (
  id             text primary key,          -- ART-BR-01-L07
  oferta_id      text not null references public.ofertas(id) on update cascade on delete cascade,
  data_entrega   date,
  qtd            integer not null default 20,
  angulo         text not null default '',
  copy           text not null default 'BRAIN',
  edicao         text not null default 'BRAIN',
  trafego        text not null default 'A FAZER',
  obs            text not null default '',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists levas_oferta_idx on public.levas(oferta_id);

create table if not exists public.criativos (
  id             text primary key,          -- ART-BR-01-L07-C03  (= nome do anúncio no Meta)
  leva_id        text not null references public.levas(id) on delete cascade,
  angulo         text not null default '',
  angulo_hook    text not null default '',
  hook           text not null default '',
  formato        text not null default '',
  body           text not null default '',
  pai            text,
  gasto          numeric,
  cpa            numeric,
  roas           numeric,
  veredito       text not null default 'VALIDADO',
  obs            text not null default '',
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists criativos_leva_idx on public.criativos(leva_id);

-- ---------------------------------------------------------------------
-- 2b. Garante ON UPDATE CASCADE (bancos criados antes desta versão)
-- Sem isso, trocar o ID de uma oferta é recusado pelo Postgres.
-- ---------------------------------------------------------------------
do $$
declare nome text;
begin
  select tc.constraint_name into nome
    from information_schema.table_constraints tc
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name
   where tc.table_schema = 'public' and tc.table_name = 'levas'
     and tc.constraint_type = 'FOREIGN KEY' and rc.update_rule <> 'CASCADE'
   limit 1;
  if nome is not null then
    execute format('alter table public.levas drop constraint %I', nome);
    execute 'alter table public.levas add constraint levas_oferta_id_fkey
             foreign key (oferta_id) references public.ofertas(id)
             on update cascade on delete cascade';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. atualizado_em automático
-- ---------------------------------------------------------------------
create or replace function public.toca_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ofertas','levas','criativos'] loop
    execute format('drop trigger if exists %I_toca on public.%I', t, t);
    execute format(
      'create trigger %I_toca before update on public.%I
       for each row execute function public.toca_atualizado_em()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. RLS — nada é visível sem estar na allowlist
-- ---------------------------------------------------------------------
alter table public.membros   enable row level security;
alter table public.ofertas   enable row level security;
alter table public.levas     enable row level security;
alter table public.criativos enable row level security;

do $$
declare t text;
begin
  -- membros: quem é da equipe enxerga a lista; alterar só pelo SQL Editor.
  drop policy if exists membros_ler on public.membros;
  create policy membros_ler on public.membros
    for select to authenticated using (public.eh_membro());

  foreach t in array array['ofertas','levas','criativos'] loop
    execute format('drop policy if exists %I_ler on public.%I', t, t);
    execute format('drop policy if exists %I_escrever on public.%I', t, t);

    execute format(
      'create policy %I_ler on public.%I
         for select to authenticated using (public.eh_membro())', t, t);

    execute format(
      'create policy %I_escrever on public.%I
         for all to authenticated
         using (public.eh_editor()) with check (public.eh_editor())', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Realtime — todo mundo vê a alteração do outro na hora
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['ofertas','levas','criativos'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =====================================================================
-- 6. LIBERE VOCÊ MESMO  ←←← EDITE A LINHA ABAIXO
-- =====================================================================
insert into public.membros (email, nome, papel)
values ('lowguerra1@gmail.com', 'Kaian', 'editor')
on conflict (email) do update set papel = excluded.papel;

-- Pra liberar o time depois, rode só isto (uma linha por pessoa):
--   insert into public.membros (email, nome, papel)
--   values ('fulano@gmail.com', 'Fulano', 'editor')
--   on conflict (email) do update set papel = excluded.papel;
--
-- Pra tirar o acesso de alguém:
--   delete from public.membros where email = 'fulano@gmail.com';
