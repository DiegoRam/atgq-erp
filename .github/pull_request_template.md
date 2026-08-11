## Qué cambia

<!-- Resumen del cambio: qué problema resuelve y por qué este enfoque. -->

## Verificación

<!-- Qué se corrió y qué dio. Ver "Verifying a change" en CLAUDE.md. -->

- [ ] `npm run lint` y `npx tsc --noEmit` limpios
- [ ] SQL ejercitado contra una base real (si el cambio toca migraciones o RPCs)
- [ ] `code-review` corrida (obligatoria en Tier 2+)
- [ ] `agent-browser` sobre las pantallas afectadas (Tier 2+), capturas en `tests/screenshots/`
- [ ] `npm run build` limpio (último, después del browser)

## Autoría

<!--
El tagger lee esta sección. Marcá la casilla O poné el comentario de abajo en
`true` si el código lo escribió (total o parcialmente) un agente de IA.
Cualquiera de las dos cosas alcanza; también se detecta por trailer de commit
(Co-Authored-By: Claude) y por prefijo de rama (claude/*, agent/*).

No borres el comentario `agent-authored` que va dentro de la casilla: es el
sentinel que busca el tagger. Sin él, marcar la casilla no dispara ninguna
señal — y la detección no puede ser más laxa, porque "agent-browser" más
arriba también es una casilla que contiene la palabra "agent".

(Este bloque no puede escribir la secuencia de cierre de un comentario HTML
dentro de sí mismo: la primera aparición cierra el bloque y todo lo que sigue
se renderiza como texto visible en cada PR.)
-->

- [ ] <!-- agent-authored --> Este PR fue escrito (total o parcialmente) por un agente de IA

<!-- agent-authored: false -->
