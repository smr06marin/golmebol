-- El admin no podía "Ver cédulas" en el detalle del jugador: ese botón genera
-- una URL firmada (createSignedUrl) contra el bucket "cedulas", y esa
-- operación necesita permiso explícito sobre storage.objects — a diferencia
-- de simplemente mostrar la URL pública, que puede funcionar aunque falte
-- esta política. Como nunca se creó una política para este bucket, Supabase
-- bloqueaba la firma en silencio y la app se quedaba en blanco sin avisar
-- error (ya arreglado en el código para que si vuelve a fallar, se vea el
-- motivo). Esto agrega los permisos que faltan, igual de amplios que el
-- resto del proyecto.

drop policy if exists "cedulas_select_all" on storage.objects;
create policy "cedulas_select_all"
on storage.objects for select
using (bucket_id = 'cedulas');

drop policy if exists "cedulas_insert_all" on storage.objects;
create policy "cedulas_insert_all"
on storage.objects for insert
with check (bucket_id = 'cedulas');

drop policy if exists "cedulas_update_all" on storage.objects;
create policy "cedulas_update_all"
on storage.objects for update
using (bucket_id = 'cedulas');

drop policy if exists "cedulas_delete_all" on storage.objects;
create policy "cedulas_delete_all"
on storage.objects for delete
using (bucket_id = 'cedulas');
