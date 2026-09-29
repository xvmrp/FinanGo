# Cartolas Falabella

La importación usa el PDF histórico de cuenta corriente Falabella y valida el saldo de cada fila y el cierre. No se guardan los PDF ni el número completo de cuenta; sí el nombre del archivo, últimos cuatro dígitos, una huella de cuenta, los saldos y movimientos.

## Uso

En FinanGo: Cartolas → seleccionar PDF → revisar → confirmar.

La lectura se ejecuta en el backend. Configure `PDF_PYTHON` con la ruta a Python y ejecute `python -m pip install -r scripts/requirements.txt`. En este equipo se detecta también el Python incluido con Codex. Tras cambiar el esquema: `npx prisma generate --config prisma7.config.ts` y `npx prisma migrate deploy --config prisma7.config.ts`.

Importación local opcional, después de compilar: `node scripts/import-falabella.mjs "ruta/cartola.pdf"`.

## Criterios

- Las cuentas de cartolas y sus importes son de solo lectura. Los registros manuales siguen separados.
- El último saldo documentado es el cierre de la cartola más reciente, no un saldo en tiempo real.
- Una cartola antigua nunca reemplaza un saldo más reciente. Los meses ausentes no se rellenan.
- Reimportar el mismo contenido no duplica filas. Otra versión del mismo mes se rechaza para revisión.
- Se preservan movimientos repetidos legítimos; se deduplica la cartola completa.
- No se recalcula el saldo sumando otra vez los movimientos importados.
- Abonos/cargos incluyen traspasos y pagos de tarjetas; no se clasifican automáticamente como ingresos/gastos personales.
- Importación de varios archivos: cada archivo es atómico; si uno falla, los anteriores permanecen y se puede reintentar.
- Formato inicial limitado a estas cartolas históricas. Retenciones, PDF escaneados, protegidos o estructuras distintas requieren revisión.
