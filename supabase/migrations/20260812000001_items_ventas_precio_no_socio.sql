-- ============================================================
-- ATGQ ERP — Precio para no socios en items_ventas
--
-- El legacy `ItemsVentas` tenía DOS tarifas (`ValorSocio` y
-- `ValorNoSocio`) y `migration/migrate.py` sólo importó la de socio:
-- toda la tabla quedó con un único precio. Acá se agrega la segunda
-- columna y se recupera el dato perdido desde docs/backup.sql.
--
-- El backfill matchea por PRIMARY KEY, no por nombre: `items_ventas.nombre`
-- NO es único. El importador asignó ids deterministas
-- uuid5(a1b2c3d4-0000-4000-8000-a7a7a7a70001, 'items_ventas:<idItem>')
-- (migration/migrate.py:36-37), así que los 210 ítems legacy se pueden
-- direccionar exacto.
--
-- Para todo lo que no viene del legacy (seeds, altas del ABM) el default
-- es socio + 20%, la misma regla que autocompleta el formulario en
-- src/components/ventas/ItemVentaForm.tsx.
--
-- Re-runnable: ADD COLUMN IF NOT EXISTS y los dos UPDATE guardados por
-- `precio_no_socio IS NULL`. En una segunda corrida no tocan ninguna
-- fila — importante, porque si no pisarían los precios que el club
-- editó a mano desde el ABM.
--
-- Mantener en sync con `mig_items` en migration/migrate.py, que ahora
-- inserta ambas tarifas.
--
-- ORDEN DE DEPLOY: la columna queda NOT NULL y SIN DEFAULT a propósito —
-- un DEFAULT 0 silencioso convertiría un INSERT olvidado en un ítem gratis
-- en vez de fallar fuerte. El precio lo tiene que mandar siempre quien
-- escribe. La contra es que entre el `db push` y el deploy del frontend
-- (o si se rollbackea el bundle) dar de alta un ítem falla con 23502:
-- aplicar esta migración JUNTO con el deploy, no antes. Las altas ya
-- existentes y las ventas no se ven afectadas.
-- ============================================================

ALTER TABLE items_ventas
  ADD COLUMN IF NOT EXISTS precio_no_socio NUMERIC(12,2);

-- ------------------------------------------------------------
-- 1) Tarifa real del legacy (210 ítems de ItemsVentas.ValorNoSocio).
--    En una base sin datos legacy (local/demo) no matchea ninguna fila.
-- ------------------------------------------------------------
UPDATE items_ventas iv
   SET precio_no_socio = v.valor
  FROM (VALUES
    ('2bf5a845-cc25-555c-9d8a-a18300220aef'::uuid, 46000.00),  -- IDONEIDAD INST.EXTERNO
    ('df09e1f8-1987-53bd-8c2e-b5414a648c12'::uuid, 1200.00),  -- Amebas
    ('cb77eb12-4824-5169-8c29-b2d1edd2c05a'::uuid, 120000.00),  -- Anexo IV Inst.Externo
    ('6d3e1b53-eeb8-55e2-850e-fc5bea591fac'::uuid, 400.00),  -- Blanco Arqueria
    ('92b8dac7-805d-518c-920b-04e096740d87'::uuid, 100.00),  -- Blanco Carabina neumática
    ('d6a7f7c5-6bac-50ae-889a-71e79778a78a'::uuid, 20.00),  -- Blanco Carabina Olímpica cod.3
    ('253d911e-87ba-5c58-ba65-6a21e299eebc'::uuid, 1500.00),  -- Blanco Fusil 1 Zona
    ('074d9497-2103-5837-bce9-1cd24721acb3'::uuid, 1500.00),  -- Blanco Fusil 4 zonas
    ('81d1dbe7-00c7-5846-a0d8-e2e070b97ddc'::uuid, 1500.00),  -- Blanco Internacional
    ('75fd2d66-a931-59b5-ba26-bc4be17ad288'::uuid, 700.00),  -- Blanco Minirifle FBI
    ('5ca2c45a-eef3-51ac-b558-dbf01ca3430c'::uuid, 150.00),  -- Blanco pistola neumática
    ('d3c11a19-13a7-574a-bebb-1722635282a6'::uuid, 1500.00),  -- Blanco Tiro Rápido
    ('510ed9e8-7b25-57a7-b585-4cbcba7e45fc'::uuid, 5.00),  -- Blancos carabina prom. Rifle Quebrar Cod. 32
    ('1827033e-9f58-5b8c-9d71-e37c15d96e4b'::uuid, 1500.00),  -- Blancos FBI 2
    ('d551be97-d1cb-54ac-b8d6-05403fd5f9da'::uuid, 400.00),  -- Blancos Reducido Fusil 300/50 Cod. 9
    ('731f5600-f442-509e-b41f-2584d25773e7'::uuid, 1500.00),  -- Blancos Reducidos fusil
    ('3eef9f30-cbc3-5948-b094-74d01564b05c'::uuid, 100.00),  -- Bono Contribución
    ('34e1b7ec-b3b5-56de-924a-1f2350b4e00f'::uuid, 1500.00),  -- Bruselas
    ('082388e0-82c8-5e38-8806-a39774200e8c'::uuid, 2000.00),  -- Calcos (transparentes)
    ('fb8b4d31-9368-538c-ba63-a7097509abc8'::uuid, 2000.00),  -- Carnet
    ('59a0faf7-bff6-5284-9e1c-b004e80ab131'::uuid, 28000.00),  -- Cart. Fiocchi 12 - 24 gr. Uso de Linea
    ('1e8a1751-758b-580b-aa91-708480ab5d34'::uuid, 4000.00),  -- Cart. RD Cal 12 - 24 gr. Uso de Linea
    ('3f0d504a-2fdd-5b96-b066-6e0a121a27cf'::uuid, 4000.00),  -- Cart. RD Cal 12 - 28 gr. Uso de Linea
    ('d3e018b0-a377-5c89-a30f-a15d9f84cb9f'::uuid, 25000.00),  -- Cartucho SP 12/70 28 grs Mun 7 - Uso de Linea
    ('3e4444d2-4fc5-50fc-bad3-d1acc3a1252d'::uuid, 4500.00),  -- Cinta de Papel Blanca
    ('25c96f19-fe46-5dd9-b491-120f39574150'::uuid, 8000.00),  -- Cinta negra
    ('ffdd2dc8-be71-500e-a415-10f04c385fb4'::uuid, 3500.00),  -- (DESUSO) ARQUERIA PRIMERA CLASE
    ('fed0b89d-17b3-503a-983b-ea284f9474b5'::uuid, 9500.00),  -- (DESUSO) CORTAPLUMAS
    ('8209e820-7a74-5b00-9961-ae4819b8baa1'::uuid, 1000.00),  -- Credencial de Tiro
    ('5acc4334-3231-5738-8a1b-3510ba1d2292'::uuid, 100000.00),  -- Academia JCB: curso Instructor ITB
    ('756ee1f2-6800-537b-ae1e-75598bbe6d88'::uuid, 10000.00),  -- (DESUSO) Curso con Avallone Claudio
    ('1de80e99-46fb-50cf-9c21-8cc79f3b0b83'::uuid, 90000.00),  -- Curso FBI  con Buzachut Julio
    ('99de8ea8-c904-5e4d-a9f7-eaa83903846b'::uuid, 20000.00),  -- Clase con Fernández Diego
    ('61d88abc-307e-5ebe-99a4-b5715b6ec6cb'::uuid, 10000.00),  -- (DESUSO) Entrenamiento con Jorge Chaves
    ('fd25b443-89ce-5c53-b283-1a0d9ecccfb4'::uuid, 35000.00),  -- Curso con Stortoni Pablo
    ('0d604c15-f4cf-59b2-8e57-6808caa30ed6'::uuid, 17000.00),  -- Derecho de linea Arma Corta- FFSS
    ('a60b3996-bd19-5f02-9a3e-9592368b4094'::uuid, 15000.00),  -- DERECHO - CURSOS
    ('c8b0b05b-1802-5e0c-9862-22333e383b5d'::uuid, 28000.00),  -- Derecho de línea Galería
    ('5c5b7dff-8b54-5a08-a7c1-6c82ed2ec6fe'::uuid, 28000.00),  -- Derecho de línea  Arma corta
    ('66b084ac-5cbb-501f-9923-9aaaf6208d62'::uuid, 700.00),  -- Diana internacional
    ('1c40a5da-3066-52a8-b432-0b6d69717a67'::uuid, 700.00),  -- Dianas tiro rápido
    ('0e4fcd76-d38c-53c9-aa51-427975cb6bbb'::uuid, 5000.00),  -- Escudo Bordado
    ('8ebe98e3-5ec1-51fb-ba12-2f5a01857fe8'::uuid, 500.00),  -- Escuela de Tiro
    ('49bcec7b-27ba-5514-a92e-fbf935fe0984'::uuid, 2000.00),  -- Gorras ATGQ
    ('da7b1190-80c3-52f3-b473-44f79b5c9839'::uuid, 600.00),  -- Helice
    ('5f2fa7b9-13b1-5eda-83c8-cc7dec9610a2'::uuid, 40000.00),  -- (DESUSO)Id. Portacion y/o Anexo IV Buzachut J
    ('acad2e88-a05b-5aeb-84be-359f081abfa2'::uuid, 40000.00),  -- (DESUSO)Id. Portacion y/o Anexo IV Fernández
    ('818a7e63-4d17-5057-99a4-38382e940678'::uuid, 40000.00),  -- (DESUSO)Id. portacion y/o Anexo IV Jorge Chav
    ('05109a4d-5c1d-5c4b-8183-d391f28c5f30'::uuid, 40000.00),  -- (DESUSO)Id. Portacion y/o Anexo IV Stortoni P
    ('d4867210-23ae-596a-887e-4f7da8da6da4'::uuid, 46000.00),  -- Idoneidad de tiro ITB Avallone Claudio
    ('c8d41bf1-50d2-54b8-bd34-f42a491a6815'::uuid, 46000.00),  -- Idoneidad de tiro ITA Buzachut Julio
    ('ab098f01-0c17-52b8-b801-6d7457b6edcf'::uuid, 46000.00),  -- Idoneidad de tiro ITB Fernández Diego
    ('c0cc1f12-5e59-54a9-84d4-9c8a3d7491c1'::uuid, 46000.00),  -- Idoneidad de tiro ITA Jorge Chaves
    ('dc4fa9b9-84ab-533c-bc36-597e072f36c6'::uuid, 46000.00),  -- Idoneidad de tiro ITB Stortoni Pablo
    ('6c490a6a-9822-5fa5-a532-f4aea7a13cfa'::uuid, 4000.00),  -- Lentes Anteojos de seguridad Safetty Glasses
    ('10d59553-8a88-581b-a2c1-55b0b66f678d'::uuid, 400.00),  -- Libro de tiro Centenario
    ('a454561a-fcea-5fad-a80d-557125de90c0'::uuid, 2000.00),  -- MEDALLAS CHICAS
    ('47a0db50-111d-528e-a2a5-e94e8635ac0b'::uuid, 150.00),  -- MEDALLAS GRANDES
    ('4fc3996f-0b03-50ec-a394-4a1d211f0de8'::uuid, 46000.00),  -- MEDICO CLINICO
    ('330912ad-6605-54b6-8e6a-18ed9d44b1bf'::uuid, 700.00),  -- Mini Bruselas
    ('d7e50882-b733-5e2e-a6b7-05bedb8bfb73'::uuid, 14000.00),  -- Mun. FM cal.22 AC Uso Línea
    ('17bc1630-39ec-5f3e-a10e-b01681a53088'::uuid, 14000.00),  -- Mun. FM cal.22 AV Punta Hueca - Uso de linea
    ('c4d462fa-e198-5f6b-8395-be8c017ed949'::uuid, 11500.00),  -- Mun. FM cal.22 A.V. Uso Linea
    ('22abd7ff-9233-57de-8b45-39631a0e5383'::uuid, 15000.00),  -- Mun. FM cal.22 Competicion - Uso Linea
    ('81e8f495-4ffc-54a7-b7d4-e9a63ce57cf2'::uuid, 9500.00),  -- Mun. Orbea .22 LR Std. - Uso de Linea
    ('bea2ad94-262b-5aef-9a5f-70259973c434'::uuid, 2800.00),  -- Mun. Orbea cal.22 AVPS - Uso Linea
    ('b0da6bc1-79c3-5bcd-b12a-26cd7cd572ce'::uuid, 13000.00),  -- Mun. Remington 22 LR STD
    ('ef410b6b-0c42-5899-86f3-39d4b83e7d03'::uuid, 48000.00),  -- Mun. SP Cal .38 SPL 158 gr RN
    ('1ce8325c-d4fe-5d1a-92b8-d6d8f92885f2'::uuid, 35000.00),  -- Mun. SP cal. 9 mm 124 grs. Encamisada Uso Lin
    ('eaef21a7-d646-54ff-822a-18c0728f3768'::uuid, 63000.00),  -- Mun. SP cal.357 MAG Semi Encamisada Uso Linea
    ('43699653-6dc4-5c07-ad7d-398cd593e22d'::uuid, 38000.00),  -- Mun. SP cal.380 Encamisada Uso Linea
    ('bfbb9d7d-53fe-53fa-a2ac-94a73edac9b3'::uuid, 48000.00),  -- Mun. SP cal.40 Encamisada - Uso Linea
    ('5e03e6bf-7a3f-5a63-9f69-4a32b22fed6b'::uuid, 27000.00),  -- Mun. Waffen cal.9 Encamisada - Uso Linea
    ('ac1ece8e-9d14-51e2-9407-d6e77e86b4a7'::uuid, 14000.00),  -- Mun. Waffen .38 Sem Enc. - Uso Linea
    ('407b944c-1f58-5154-84d7-52a2e883b1ce'::uuid, 4500.00),  -- Mun. Waffen .40 Teflonada Uso Linea
    ('5a3b983a-1160-5bdc-9057-6a810e32916b'::uuid, 46000.00),  -- Mun. Waffen cal.40 Encamisada - Uso Linea
    ('259f8763-fc88-55e5-a2f4-baccf6259529'::uuid, 17500.00),  -- Mun. Waffen cal.45 Encamisada - Uso Linea
    ('2402a0a3-baf3-58ec-a2ea-7d25975a242b'::uuid, 22000.00),  -- Mun. Waffen cal.9 mm Teflonada - Uso Linea
    ('db86c3e7-d053-53a9-b9ba-252138e2eaba'::uuid, 780.00),  -- Mun.FM cal.22 Std. - Uso Linea
    ('c4b7598e-94dc-58e6-958f-382324b3fab0'::uuid, 57000.00),  -- Mun.SP cal.45 Encamisada - Uso Linea
    ('38c2211d-2d86-5f6e-bc40-e96990340d5a'::uuid, 17.00),  -- Obleas .38 x 1000 - Blancas
    ('eae559a8-4823-56e7-a47c-c94e0205053b'::uuid, 0.00),  -- Obleas Blancas 20 unid.x hoja
    ('19266990-1f2f-5ae6-937d-16315b75511b'::uuid, 0.00),  -- PASE DE TESORERIA
    ('21ed6b67-035a-5b73-b4a3-b4dee0fd13e0'::uuid, 400.00),  -- Permiso de Caza - No Socio
    ('c955c06d-e68b-5480-b16a-81393f31ee8f'::uuid, 330.00),  -- Permiso de Caza - Socio
    ('130d94eb-60b6-56e5-aa73-61d3ce97d0b7'::uuid, 5000.00),  -- Pin
    ('95c8b999-256b-59bf-9dc2-1ededbf392de'::uuid, 600.00),  -- PLATILLOS - Escopeta
    ('b7cf53e7-0b25-55cb-acbd-6742febd57e8'::uuid, 10000.00),  -- (DESUSO) Practica con Buzachut Julio
    ('c5e5ab7d-61d9-5eda-9d88-a217cf7289af'::uuid, 30000.00),  -- CURSO Inicial con Chaves Jorge
    ('299f9a7d-50c0-5b36-b918-30eab1c6278a'::uuid, 20000.00),  -- Entrenamiento  con Fernández Diego
    ('97c7fa67-7ee8-5a8d-aa79-018726642115'::uuid, 2000.00),  -- Práctica con Stortoni Pablo
    ('d6d6a294-bf4e-5cd4-ab3e-b2ffdd2a1e88'::uuid, 46000.00),  -- PSICOLOGO
    ('5826792f-c09b-5d54-98c9-031acd3f3a67'::uuid, 1300.00),  -- Relojes
    ('b51dbb2f-7697-5a83-a3a2-faf115911c24'::uuid, 0.00),  -- Rem. .22 Golden AV
    ('49899c75-b419-5375-a290-79fb44a677ba'::uuid, 7000.00),  -- Remeras Tiro Practico
    ('284002e0-8107-5a5b-b85b-d62b8fc7a1de'::uuid, 1000.00),  -- TAPABOCAS
    ('cb7b7951-0390-5c99-9b8f-65401e065f12'::uuid, 2000.00),  -- Tapones descartables
    ('77954cc2-6d0d-5a5c-ae66-eeab79dcaae1'::uuid, 3000.00),  -- (DESUSO) TARJETA PREPAGA ESCOPETA
    ('055b3f4c-22de-5a25-be9c-a46e6381534e'::uuid, 1600.00),  -- Uso Línea RD 28 gr. Hélice
    ('95fea275-67e7-568c-b48a-be37286df6b2'::uuid, 200.00),  -- Uso Línea S. Power 24 gr.
    ('25a0c985-64bd-5fa3-934b-b1aa053486cc'::uuid, 220.00),  -- Uso Línea S. Power 36 gr.
    ('633f0fb0-84e8-543e-999f-f4d37d67100b'::uuid, 2000.00),  -- Vainas .380 x300
    ('d6c18596-a8e6-5628-893f-aa0889319106'::uuid, 1000.00),  -- Vainas 30-06 x 25
    ('a1c33cd6-2b63-5d51-bd02-b5859844a6c0'::uuid, 2500.00),  -- Vainas 308 x 50
    ('93389b9d-58cf-5336-8e74-255ec74c6c24'::uuid, 2100.00),  -- Vainas 357 x 100
    ('fd744103-7b71-5046-92de-6259faf8989e'::uuid, 6000.00),  -- Vainas 38 x 100
    ('963268fe-3d04-5d08-91a3-3059aeee1a82'::uuid, 3600.00),  -- Vainas 38 x 300
    ('bc14df6b-305f-5710-95a8-dc6e10f8c6c0'::uuid, 8000.00),  -- Vainas 40 x 400
    ('db0eb902-048b-5443-946a-c417bdca5ba4'::uuid, 2000.00),  -- Vainas 44 x100
    ('fed2092a-ad6b-58e6-9ec2-99891f5288b9'::uuid, 4000.00),  -- Vainas 45 x 300
    ('e3ffa997-4b3a-5a5e-84a3-875f3380f7a8'::uuid, 1500.00),  -- Vainas 9 mm x 500
    ('d31e1a40-a517-5835-9b99-3e5707c738da'::uuid, 5000.00),  -- Vainas 9mm x1000
    ('9f28f3fd-9eef-5f1d-99e0-ba455535597d'::uuid, 30000.00),  -- Jorge Chaves Entrenamiento de Tiro
    ('6ef15e1e-32bc-5297-8343-8d873731375a'::uuid, 0.00),  -- ALQUILER ARMERIA
    ('14e10bc4-fdc6-5b6b-8bae-13603ff5fbdd'::uuid, 0.00),  -- (DESUSO) ESCOPETA : vueltas de platos
    ('ae61fdf1-a286-5d80-8486-07443632da23'::uuid, 3000.00),  -- ESTACIONAMIENTO
    ('88964a8f-6ade-5e73-8508-971c91dcfc71'::uuid, 5000.00),  -- (DESUSO) TARJETAS ESCOPETA - RECARGAS 5000
    ('9f2fe70f-9058-504f-9b05-6793908a9c66'::uuid, 700.00),  -- LLAVE SALA DE SOCIOS
    ('ad5323e2-d921-5baf-9917-e5362d58e079'::uuid, 30000.00),  -- CANCELA DIEGO- INST.DE TIRO
    ('2569fb26-19fe-574d-8f1e-12737e82e860'::uuid, 300.00),  -- VAINAS 380 X 50
    ('a5f656db-eac8-5976-8b64-35a37aa9b0ca'::uuid, 0.00),  -- (DESUSO) Derecho de Linea NO Socios Arma Cort
    ('8d433e46-6ef7-5aaa-8f9c-0551f6c8ee6d'::uuid, 40000.00),  -- (DESUSO)Id.Portacion y/o Anexo IV Robin Sergi
    ('65801f80-f3f3-5ff1-8a2b-ef53b9ec132c'::uuid, 46000.00),  -- Idoneidad de Tiro ITB Muñoz Hernan
    ('09973d9a-d422-57f6-87e5-2bfb2ecbcb32'::uuid, 15000.00),  -- TORNEO FUSIL 1 categoria
    ('7231d476-76d3-5e3f-868c-c25dc16963fd'::uuid, 50000.00),  -- Curso con Muñoz Hernan
    ('bd6c5a0c-8225-5ebd-883b-c0290e9ac2f3'::uuid, 200000.00),  -- PISTOLA BERSA CENTENARIO
    ('b6841998-cf0e-5de5-bc84-2c1b675fdebe'::uuid, 20000.00),  -- CURSO ROBIN
    ('7c7e572c-7f3f-5fb5-bf0b-49c2e29d0c35'::uuid, 20000.00),  -- CURSO INS.DE TIRO C/JONATAN LINARI
    ('7d756821-eedb-5fde-88e8-51eae8e98e9f'::uuid, 80000.00),  -- Idoneidad de Portacion Muñoz Hernan
    ('0d83146c-c164-5549-93fe-c3e1dd3c25fa'::uuid, 1500.00),  -- FUSIL 150 MTS REDUCIDO
    ('db0555fa-1a3c-5162-a19a-0c5f9c5af4a1'::uuid, 40000.00),  -- (DESUSO)Id. Portacion y/o Anexo IV Muñoz Hern
    ('9f062976-3701-564a-a3e5-626335b582d5'::uuid, 15000.00),  -- CHAVES TIRO DEFENSIVO
    ('7c2d54bb-9b87-5e75-b527-bc8ca1b621e0'::uuid, 250.00),  -- (DESUSO) FICHAS Helices Socios - Escopeta
    ('0aa3c7b3-f539-5c2c-b686-1b813c3f2f59'::uuid, 400.00),  -- (DESUSO) Fichas Helices - NO Socios - ESCOPET
    ('0580ee9e-50ce-5bae-9aa8-9cd2bbac0794'::uuid, 15000.00),  -- Mate ATGQ
    ('5906c5b5-4ec2-57f3-8b60-8e8bcecb389c'::uuid, 90000.00),  -- CURSO TIRO PRACTICO - ZARATE JOSE
    ('b6826bf4-f26a-5ae4-991c-9b5b496d7285'::uuid, 4000.00),  -- CURSO MECANICO ARMERO (VEGA JUAN MANUEL)
    ('cfd7d6c0-9bf4-50af-9052-b047d087272f'::uuid, 20000.00),  -- TORNEO FUSIL 2 categoria
    ('2481addd-6059-56d4-9be0-4f144df27fc7'::uuid, 7000.00),  -- JORNADA DE TIRO ACADEMIA TED
    ('55cca431-c3a2-5df6-a8d8-b50e35d2119b'::uuid, 6000.00),  -- (DESUSO) CURSO SINISCALCHI JUAN CARLOS
    ('d7ed20fb-5e8a-5d4b-a6d4-bbb37341fbda'::uuid, 192000.00),  -- ALQUILER DE QUINCHO CERRADO
    ('29aa0ba7-4607-5585-bfa9-1965c946bdd2'::uuid, 3000.00),  -- LIMPIEZA DE QUINCHO
    ('9ed8e696-1572-50d9-841d-0f5b9dce4eaa'::uuid, 5000.00),  -- (DESUSO) TORNEO T.P. METALES   ATR
    ('4bc33d16-5113-5fe5-91ec-6cbec84c5af1'::uuid, 500.00),  -- CARGA DE GAS PISTOLA
    ('28419ae9-185d-5118-a31e-671bf5eaf441'::uuid, 4000.00),  -- CURSO CLASIFICATORIO IDPA
    ('24ebab70-2bfe-5a9c-805c-3517d746ad3b'::uuid, 500.00),  -- Carga de GAS RIFLE
    ('61d4cbf8-a091-5470-897e-aa581af5138e'::uuid, 110000.00),  -- Curso Arqueria Bettina
    ('17d25ef4-2dcc-530c-8f3e-2e23cbe454fa'::uuid, 30000.00),  -- Clase Arqueria Bettina
    ('5d408cc2-6076-5a88-ba52-7e78db7c64e7'::uuid, 3500.00),  -- CHALET - HOSPEDAJE
    ('44ce24db-7bcc-532a-a957-2cae108a3b8a'::uuid, 4000.00),  -- CLASIFICACION IDPA - CHAVES
    ('132b6e1d-a34a-51c7-abf3-b87a3ef7d985'::uuid, 15000.00),  -- (DESUSO) Curso Inst. Rodolfo Ramirez
    ('c5388520-75c3-522c-8c56-397dfa9944f9'::uuid, 1000.00),  -- RECARGAS TARJETAS ESCOPETA
    ('ddc43a74-13b2-5f21-95e0-55643afc1c3f'::uuid, 3000.00),  -- Tarjeta plástica Tiro al Vuelo
    ('0dfeb7ea-4e59-5d12-b1e7-f853a7adfac1'::uuid, 10000.00),  -- (DESUSO) TARJETAS ESCOPETA RECARGA 10000
    ('6f4e1f0c-4d08-5c40-901d-50991d7c448a'::uuid, 100.00),  -- RECARGAS ESCOPETA 100
    ('1293e786-041a-5d19-ba77-5c9ac18f3838'::uuid, 100.00),  -- (DESUSO) TARJETA ESCOPETA 100
    ('26cff810-0e28-5826-9cc9-15296cf5bc75'::uuid, 1500.00),  -- (DESUSO) CAFE FICHAS
    ('fcdc6813-9737-549c-a119-b23ef093c8af'::uuid, 192000.00),  -- QUINCHO CERRADO ALQUILER Uso personal
    ('a47b5054-a319-5e70-a911-199970689f84'::uuid, 1200.00),  -- blanco de Bencj Rest
    ('41f964c8-9ca7-5675-8a0f-c0716199cfeb'::uuid, 35000.00),  -- Curso Andrea Celeste Bareiro
    ('6543a868-b6db-5615-ad7d-a1b3ce9a7972'::uuid, 4500.00),  -- TORNEO ESCUELA DE TIRO
    ('45ff070f-a359-5b9d-9f9e-f0ee33598b2c'::uuid, 1000.00),  -- caratula arma corta
    ('158aa288-9701-5f39-a61b-6079355c102c'::uuid, 1000.00),  -- Caratula arma larga
    ('bdeb5738-ed82-5e21-b627-a315c1597952'::uuid, 30000.00),  -- Tiro Policial Viera Leonardo Angel
    ('c43756a2-6569-571e-a85a-7b68db3ee8d3'::uuid, 95000.00),  -- Introduccion al Tiro Instructor Viera Ferreri
    ('319fe142-442d-5e28-ab43-14497ff8bcb1'::uuid, 40000.00),  -- (DESUSO)Id.Portacion y/o Anexo IV Avallone Cl
    ('b6f5a58b-44cf-5624-98a3-5878996df6f2'::uuid, 16000.00),  -- ERROR
    ('c3731c4e-838a-53c5-bbf6-859a654a55fe'::uuid, 46000.00),  -- Idoneidad de tiro ITB Viera Leonardo
    ('6eb011cb-8ae8-5801-9dd3-56f9993de0a4'::uuid, 30000.00),  -- Curso Instructor Externo
    ('87b0862e-9abe-5c24-84bf-5b4ceac790db'::uuid, 30000.00),  -- CURSO ITB 7685 ROXANA SIVORI
    ('46b65462-be62-583c-9041-264aaba931b2'::uuid, 40000.00),  -- Curso inicial  Instructor Viera Ferreira
    ('6789fb71-bc09-5a00-b296-02b7aa6711b1'::uuid, 500.00),  -- IMPRESIONES/FOTOCOPIAS
    ('c3670fba-7179-5a81-bb91-0a513b073b2e'::uuid, 18000.00),  -- Mun. Aguila  Interc. .22
    ('069d39e5-334c-5229-a7e5-48a860d84b69'::uuid, 15000.00),  -- Mun. Aguila HP .22
    ('8f7efbf8-77a3-5796-a355-bad3aa761f16'::uuid, 30000.00),  -- Curso de la Natividad Gregorio
    ('e93c0c8f-6c44-5575-be20-202b714335d7'::uuid, 20000.00),  -- DICHIARO GABRIELA CLASE DE TIRO
    ('680fcfbf-fd97-563a-9454-0086fcc3692d'::uuid, 33000.00),  -- Munic. Remington 22 LR alta velocidad
    ('e0b05eb4-2e49-5a6c-82f9-96323e64bc85'::uuid, 7000.00),  -- UBET Cat. Junior
    ('6ea7b4b3-e375-52cc-995d-07db042336fb'::uuid, 10000.00),  -- UBET Cat. Juvenil menor
    ('d5b74a93-b248-508d-8d29-f2266213200c'::uuid, 15000.00),  -- UBET Cat. Juvenil mayor / Senior / Veteranos
    ('073ab4e3-96ae-5910-b365-35bfc9111753'::uuid, 10000.00),  -- UBET 2da Prueba
    ('07e4a9e8-8fae-53f5-9cf8-a821daef2872'::uuid, 7000.00),  -- UBET Cat. Mini
    ('c7612d9c-41ae-586a-ae9e-4b04842fd5a2'::uuid, 34000.00),  -- Cart Sterling Cal 12 - 28 gr. Mun 7.5 Uso de
    ('51e4e4e1-a8c0-5085-93de-37ba6c6d4981'::uuid, 35000.00),  -- No Usar Mun. SP .9mm encamisada 147 grs.
    ('4914ff59-e190-5c80-ba98-f18c13ae8e87'::uuid, 35000.00),  -- Mun. SP 9 mm Encamisadas 147 grs ok
    ('c3d84c09-2957-50e6-8160-3815a537ab69'::uuid, 120000.00),  -- Anexo IV Buzachut Julio
    ('61b75559-5b18-5f7d-8eba-fd5318a61911'::uuid, 120000.00),  -- Anexo IV Fernandez Diego
    ('76b45e1e-27ce-5db1-a91a-b51145462ea7'::uuid, 120000.00),  -- Anexo IV Jorge Chaves
    ('caaa3d23-d90a-593d-b469-e56c7348bb93'::uuid, 120000.00),  -- Anexo IV Stortoni Pablo
    ('5c1f3f74-567b-5669-bc9a-3831bc936861'::uuid, 120000.00),  -- Anexo IV Robin Sergio
    ('ddb3d2b3-04cd-5d01-a5a1-b06118394453'::uuid, 120000.00),  -- Anexo IV Muñoz Hernan
    ('d0f64c9a-ab30-572c-a006-2a1219e439c2'::uuid, 120000.00),  -- Anexo IV Avallone Claudio
    ('e12e3dad-d0de-51a4-89f4-1368cdbe07c0'::uuid, 80000.00),  -- Idoneidad de Portacion Julio Buzachut
    ('8f7bd1a9-ad66-56f8-86cb-651989402cd7'::uuid, 80000.00),  -- Idoneidad de Portacion Fernandez Diego
    ('0f898d9e-a635-5de2-8417-9eb7e5b9d022'::uuid, 80000.00),  -- Idoneidad de Portacion Jorge Chaves
    ('6866f666-3510-5b62-afe2-0dd9b0cc7fb6'::uuid, 80000.00),  -- Idoneidad de Portacion Stortoni Pablo
    ('3d11c675-cdec-5a93-a369-1286cd4dd87a'::uuid, 80000.00),  -- Idoneidad de Portacion Robin Sergio
    ('80eb1062-c8f7-5bc8-b325-0da0f3152981'::uuid, 80000.00),  -- Idoneidad de Portacion Avallone Claudio
    ('25280f9e-d8fa-56c4-ba3b-860a1a6fae7d'::uuid, 30000.00),  -- Remeras atgq
    ('9112f435-c7e4-5382-b04b-98576bacd3e9'::uuid, 35000.00),  -- Chombas Atgq
    ('65e356b2-37bc-5a0f-89ea-0d176ce33d64'::uuid, 3000.00),  -- Medallas 70 mm 1,2,3 - FBI,25mts,Neumatica,TP
    ('b0a19684-6f8a-5c57-9adf-496f20a56152'::uuid, 2000.00),  -- Medallas 50 mm Genericas FBI,25mts,Neumatica,
    ('c228450b-4624-5ffd-bb97-4635338e52bc'::uuid, 1500.00),  -- Blanco Tiro Rapido - 2
    ('d0bef4d7-ec4d-5632-a2fc-5982c900bbe6'::uuid, 38000.00),  -- Mun. Magtech 9 mm 124 gr - Uso Linea
    ('ca491f2c-38e5-54fc-a00e-4bc3a72bd789'::uuid, 30000.00),  -- SIT. FERNANDEZ: CURSO ITB
    ('c7d72012-9c39-5b6d-a79a-6ff89a226274'::uuid, 40000.00),  -- Derecho linea Sector Neumatica
    ('0332bc6e-4a48-5abf-ad64-dd78dbfdc7fe'::uuid, 1500.00),  -- Bruselas - Para Torneos
    ('731ddf2a-dcc0-53d9-8734-424d1b2fba26'::uuid, 35000.00),  -- Cena 112 años
    ('2afa6b8e-1aa6-5c63-bfe3-687d5b03fb35'::uuid, 80000.00),  -- Jornada de Tiro Defensivo Muñoz Hernan
    ('4570a503-4d9f-542d-9f09-cb736d6e7303'::uuid, 18000.00)   -- Cena 112 años ENTRADA MENOR
  ) AS v(id, valor)
 WHERE iv.id = v.id
   AND iv.precio_no_socio IS NULL;

-- ------------------------------------------------------------
-- 2) Resto (seeds y altas posteriores): socio + 20%
-- ------------------------------------------------------------
UPDATE items_ventas
   SET precio_no_socio = round(precio * 1.2, 2)
 WHERE precio_no_socio IS NULL;

ALTER TABLE items_ventas
  ALTER COLUMN precio_no_socio SET NOT NULL;

-- El significado de `precio` se angosta: pasa de ser "el precio" a ser
-- "el precio de socio". Sin este comentario se malinterpreta en 6 meses.
COMMENT ON COLUMN items_ventas.precio IS
  'Precio para socios (ValorSocio en el legacy)';
COMMENT ON COLUMN items_ventas.precio_no_socio IS
  'Precio para no socios (ValorNoSocio en el legacy). Por defecto precio de socio + 20%, editable desde el ABM';


-- ============================================================
-- registrar_venta — elige la tarifa según el comprador
--
-- Misma firma de 8 argumentos que 20260805000001_ventas_no_socio.sql:
-- con CREATE OR REPLACE (sin DROP) sobreviven los GRANT y PostgREST no
-- queda con dos overloads. Único cambio: el bloque que normaliza ítems.
-- ============================================================
CREATE OR REPLACE FUNCTION registrar_venta(
  p_punto_venta_id           UUID,
  p_cliente_id               UUID,
  p_socio_id                 UUID,
  p_metodo_pago_id           UUID,
  p_items                    JSONB,  -- [{"item_id": "uuid", "cantidad": 2}, ...]
  p_no_socio_nombre          TEXT DEFAULT NULL,
  p_no_socio_dni             TEXT DEFAULT NULL,
  p_no_socio_credencial_venc DATE DEFAULT NULL
)
RETURNS TABLE (
  venta_id            UUID,
  venta_total         NUMERIC,
  movimiento_fondo_id UUID,
  items_negativos     JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_pdv         RECORD;
  v_venta_id    UUID;
  v_total       NUMERIC(12,2);
  v_items       JSONB;
  v_cat         UUID;
  v_mov_fondo   UUID;
  v_negativos   JSONB;
  v_ref         TEXT;
  v_ns_nombre   TEXT;
  v_ns_dni      TEXT;
  v_ns_venc     DATE;
  v_hoy         DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- SECURITY DEFINER => RLS no aplica: el chequeo es obligatorio acá
  IF NOT get_user_modulo_permission('ventas', 'escribir') THEN
    RAISE EXCEPTION 'No tiene permisos para registrar ventas';
  END IF;

  -- ---- Comprador: socio, cliente del histórico, o no socio ----
  IF p_socio_id IS NOT NULL OR p_cliente_id IS NOT NULL THEN
    -- No se mezclan identidades: si hay socio/cliente, lo tipeado se descarta
    v_ns_nombre := NULL;
    v_ns_dni    := NULL;
    v_ns_venc   := NULL;
  ELSE
    v_ns_nombre := NULLIF(btrim(COALESCE(p_no_socio_nombre, '')), '');
    v_ns_dni    := NULLIF(btrim(COALESCE(p_no_socio_dni, '')), '');
    v_ns_venc   := p_no_socio_credencial_venc;

    IF v_ns_nombre IS NULL OR v_ns_dni IS NULL OR v_ns_venc IS NULL THEN
      RAISE EXCEPTION 'Debe seleccionar un socio o completar nombre, DNI y vencimiento de credencial del no socio';
    END IF;

    -- La sesión corre en UTC: con CURRENT_DATE, a partir de las 21:00 ART
    -- una credencial que vence hoy ya daría vencida.
    v_hoy := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
    IF v_ns_venc < v_hoy THEN
      RAISE EXCEPTION 'La credencial de legítimo usuario está vencida (venció el %)',
        to_char(v_ns_venc, 'DD/MM/YYYY');
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agregue al menos un ítem';
  END IF;

  SELECT id, nombre, caja_id, activo, tipo INTO v_pdv
    FROM depositos WHERE id = p_punto_venta_id;
  IF NOT FOUND OR NOT v_pdv.activo OR v_pdv.tipo <> 'punto_venta' THEN
    RAISE EXCEPTION 'Punto de venta inválido o inactivo';
  END IF;

  -- Normalizar ítems con precio autoritativo del servidor.
  --
  -- Tarifa de socio sólo si la venta va a nombre de un socio. Un
  -- `cliente` del histórico es, por definición, un no socio (la tabla
  -- `Clientes` del legacy era la de compradores sueltos), así que paga
  -- `precio_no_socio` igual que el ocasional del mostrador. La regla es
  -- exactamente el toggle Socio/No Socio del POS.
  --
  -- El LATERAL evita repetir el CASE en 'precio_unitario' y en
  -- 'subtotal': dos copias es como se escapa este bug.
  SELECT jsonb_agg(jsonb_build_object(
           'item_id',         iv.id,
           'stock_item_id',   iv.stock_item_id,
           'cantidad',        x.cantidad,
           'precio_unitario', p.precio,
           'subtotal',        round(p.precio * x.cantidad, 2)))
    INTO v_items
    FROM jsonb_to_recordset(p_items) AS x(item_id UUID, cantidad INTEGER)
    JOIN items_ventas iv ON iv.id = x.item_id AND iv.activo
   CROSS JOIN LATERAL (
     SELECT CASE WHEN p_socio_id IS NOT NULL
                 THEN iv.precio
                 ELSE iv.precio_no_socio
            END AS precio
   ) p
   WHERE x.cantidad > 0;

  IF v_items IS NULL OR jsonb_array_length(v_items) <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'Algún ítem no existe, está inactivo o tiene cantidad inválida';
  END IF;

  SELECT COALESCE(sum((i->>'subtotal')::NUMERIC), 0)::NUMERIC(12,2)
    INTO v_total
    FROM jsonb_array_elements(v_items) AS i;

  INSERT INTO ventas (cliente_id, socio_id, punto_venta_id, fecha, total,
                      metodo_pago_id, usuario_id, anulada,
                      no_socio_nombre, no_socio_dni, no_socio_credencial_vencimiento)
  VALUES (p_cliente_id, p_socio_id, p_punto_venta_id, now(), v_total,
          p_metodo_pago_id, v_user_id, false,
          v_ns_nombre, v_ns_dni, v_ns_venc)
  RETURNING id INTO v_venta_id;

  v_ref := 'Venta #' || upper(left(v_venta_id::text, 8));

  INSERT INTO ventas_items (venta_id, item_id, cantidad, precio_unitario, subtotal)
  SELECT v_venta_id, i.item_id, i.cantidad, i.precio_unitario, i.subtotal
    FROM jsonb_to_recordset(v_items)
      AS i(item_id UUID, stock_item_id UUID, cantidad INTEGER,
           precio_unitario NUMERIC, subtotal NUMERIC);

  -- ---- Stock: egreso desde el PUNTO DE VENTA ----
  INSERT INTO movimientos_stock
    (item_id, deposito_id, tipo, cantidad, motivo, referencia_id, usuario_id)
  SELECT i.stock_item_id, p_punto_venta_id, 'egreso', i.cantidad,
         v_ref, v_venta_id, v_user_id
    FROM jsonb_to_recordset(v_items)
      AS i(item_id UUID, stock_item_id UUID, cantidad INTEGER,
           precio_unitario NUMERIC, subtotal NUMERIC)
   WHERE i.stock_item_id IS NOT NULL;

  -- Agrupado por ítem: dos líneas del mismo ítem no pueden tocar
  -- la misma fila de inventario dos veces en un ON CONFLICT
  WITH ups AS (
    INSERT INTO stock_inventario (item_id, deposito_id, cantidad)
    SELECT i.stock_item_id, p_punto_venta_id, -sum(i.cantidad)
      FROM jsonb_to_recordset(v_items)
        AS i(item_id UUID, stock_item_id UUID, cantidad INTEGER,
             precio_unitario NUMERIC, subtotal NUMERIC)
     WHERE i.stock_item_id IS NOT NULL
     GROUP BY i.stock_item_id
     ORDER BY i.stock_item_id
    ON CONFLICT (item_id, deposito_id) DO UPDATE
       SET cantidad   = stock_inventario.cantidad + EXCLUDED.cantidad,
           updated_at = now()
    RETURNING item_id, cantidad
  )
  SELECT COALESCE(
           jsonb_agg(jsonb_build_object('nombre', si.nombre, 'cantidad', u.cantidad)),
           '[]'::jsonb)
    INTO v_negativos
    FROM ups u
    JOIN stock_items si ON si.id = u.item_id
   WHERE u.cantidad < 0;

  -- ---- Tesorería: ingreso en la caja del punto de venta ----
  IF v_pdv.caja_id IS NOT NULL AND v_total > 0 THEN
    SELECT id INTO v_cat FROM categorias_movimientos
     WHERE nombre = 'Ventas' AND tipo = 'ingreso' LIMIT 1;
    IF v_cat IS NULL THEN
      RAISE EXCEPTION 'Falta la categoría de ingreso "Ventas" en tesorería';
    END IF;

    INSERT INTO movimientos_fondos
      (caja_id, categoria_id, tipo, monto, descripcion, fecha, referencia_id, usuario_id)
    VALUES (v_pdv.caja_id, v_cat, 'ingreso', v_total,
            v_ref || ' — ' || v_pdv.nombre, now(), v_venta_id, v_user_id)
    RETURNING id INTO v_mov_fondo;
  END IF;

  RETURN QUERY SELECT v_venta_id, v_total, v_mov_fondo, v_negativos;
END;
$$;

COMMENT ON FUNCTION registrar_venta(UUID, UUID, UUID, UUID, JSONB, TEXT, TEXT, DATE) IS
  'Registra una venta en un punto de venta (socio o no socio con credencial de legítimo usuario): cabecera, ítems con la tarifa que corresponda (precio para socios, precio_no_socio para el resto), egreso de stock del PdV e ingreso en su caja';
