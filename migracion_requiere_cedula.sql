-- Por defecto todo torneo exige la foto de cédula (frontal y trasera) al
-- registrar un jugador nuevo desde el link público. El organizador puede
-- desactivar esta obligatoriedad para su propio torneo desde "Editar torneo".
alter table tournaments add column if not exists requiere_cedula boolean not null default true;
