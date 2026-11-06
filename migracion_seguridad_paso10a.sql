-- =====================================================================
-- PASO 10A — Links de planilla y reloj: preparación (NO cambia cómo funciona nada hoy)
-- =====================================================================
-- Hoy los links de planilla y de reloj guardan su "clave secreta" (token) dentro de la
-- tabla matches, que es PÚBLICA. Y para planillar basta con tener CUALQUIER sesión (incluso
-- una anónima) mientras el partido tenga un link activo.
-- El plan completo (fases 10A -> subir código -> 10B):
--   * 10A (este archivo): crea las tablas privadas y la función "entrar_planilla_por_link".
--   * Se sube el cambio de PlanillarLinkPage.jsx (llama a esa función al entrar).
--   * 10B: pasa los tokens a la tabla privada, los borra de matches, y exige haber entrado
--     con el link para poder planillar.
-- Este archivo es seguro: solo CREA cosas nuevas. Los links y las planillas siguen igual.
-- =====================================================================
begin;

-- Tokens de los links, solo accesibles desde funciones del servidor
create table if not exists public.match_link_tokens (
  match_id      uuid primary key references public.matches(id) on delete cascade,
  planilla_token uuid,
  grupo_token    uuid,
  reloj_token    uuid,
  updated_at     timestamptz not null default now()
);
create unique index if not exists match_link_tokens_planilla_uk on public.match_link_tokens (planilla_token) where planilla_token is not null;
create unique index if not exists match_link_tokens_reloj_uk    on public.match_link_tokens (reloj_token)    where reloj_token is not null;
create index        if not exists match_link_tokens_grupo_idx   on public.match_link_tokens (grupo_token)    where grupo_token is not null;
alter table public.match_link_tokens enable row level security;
revoke all on public.match_link_tokens from anon, authenticated;

-- Quién entró a planillar con un link (por sesión y partido)
create table if not exists public.planilla_accesos (
  user_id    uuid not null,
  match_id   uuid not null references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);
create index if not exists planilla_accesos_created_idx on public.planilla_accesos (created_at);
alter table public.planilla_accesos enable row level security;
revoke all on public.planilla_accesos from anon, authenticated;

-- Al abrir un link y tocar "Entrar a planillar": la página llama a esta función.
-- (Versión de transición: todavía lee el token de matches. La 10B la cambia.)
create or replace function public.entrar_planilla_por_link(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Sesión requerida';
  end if;

  select coalesce(array_agg(m.id), '{}') into v_ids
  from public.matches m
  where (m.link_planilla_token = p_token or m.link_planilla_grupo = p_token)
    and m.link_planilla_expira is not null
    and m.link_planilla_expira > now();

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Link inválido o vencido';
  end if;

  delete from public.planilla_accesos where created_at < now() - interval '14 days';

  insert into public.planilla_accesos (user_id, match_id)
  select auth.uid(), unnest(v_ids)
  on conflict do nothing;

  return jsonb_build_object('partidos', to_jsonb(v_ids));
end;
$$;
revoke all on function public.entrar_planilla_por_link(uuid) from public;
grant execute on function public.entrar_planilla_por_link(uuid) to authenticated;

commit;

-- PRUEBAS
-- A) Las tablas existen y un visitante NO puede leerlas (debe dar ERROR "permission denied"):
--    begin; set local role anon; select count(*) from public.match_link_tokens; rollback;
-- B) La función existe y sin sesión falla (debe dar ERROR "Sesión requerida"):
--    begin; set local role anon; select public.entrar_planilla_por_link(gen_random_uuid()); rollback;
-- ROLLBACK:
--    drop function if exists public.entrar_planilla_por_link(uuid);
--    drop table if exists public.planilla_accesos;
--    drop table if exists public.match_link_tokens;
