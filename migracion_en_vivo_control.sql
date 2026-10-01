-- Panel de control en vivo (/admin/config-sitio): guarda, por cada
-- transmisión (en_vivo_streams), qué gráfica extra se está mostrando encima
-- del video (tabla de posiciones o goles del partido) y la marca de tiempo
-- que dispara una repetición MANUAL (normal o en cámara lenta) — antes la
-- única repetición posible era la automática, apenas el árbitro anotaba un
-- gol. Es jsonb igual que en_vivo_streams, con la misma forma por
-- transmisión: { overlay: null|'tabla'|'goles', overlay_tournament_id,
-- repeticion_ts, repeticion_camara_lenta }.
alter table site_config
  add column if not exists en_vivo_control jsonb not null default '{}'::jsonb;
