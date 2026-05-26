# mobapp-ultima-milla
# URLs publicadas del Google Sheet — MOBAPP FLASH

Estas son las URLs CSV **públicas** de las 2 hojas del Sheet maestro `1rlMBJAjV6FwhesW8y2SUX43ogQeqLw8QKIbbDEirTfg` (`Tarifarios Logísticos - Multi-Tienda`).

Se obtienen con `Archivo → Compartir → Publicar en la web → seleccionar hoja → CSV → Publicar`.

---

## 📋 URLs a copiar en el plugin WooCommerce

| Campo del panel | URL |
|---|---|
| **CSV URL — Tarifas** (hoja `MOBAPP FLASH TARIFA`) | `https://docs.google.com/spreadsheets/d/e/2PACX-1vR10pelt-jk2dKh38-ar_pgGsXo2fADUjHOMkBK7jt3uV8Y-zQJSRGcaZSk3S_kL6GP33IAw6Mjd3LA/pub?gid=1451646784&single=true&output=csv` |
| **CSV URL — CPs** (hoja `MOBAPP FLASH CP`) | `https://docs.google.com/spreadsheets/d/e/2PACX-1vR10pelt-jk2dKh38-ar_pgGsXo2fADUjHOMkBK7jt3uV8Y-zQJSRGcaZSk3S_kL6GP33IAw6Mjd3LA/pub?gid=1928763953&single=true&output=csv` |

> El plugin Woo se configura desde **WP-Admin → WooCommerce → Ajustes → Envíos → [zona] → agregar método "MOBAPP FLASH - Última Milla"** y pegar estas 2 URLs en sus respectivos campos.

---

## 🔵 Para Tienda Nube — NO se usan estas URLs

La app de Tienda Nube (`tiendanube-app/`) lee el Sheet directamente con la **service account de Google Cloud** ya autorizada como **Editor** en el Sheet:

- `mobapp-tienda-nube-v2@mobapp-tienda-nube-v2.iam.gserviceaccount.com`

La app usa el `GOOGLE_SHEET_ID` (`1rlMBJAjV6FwhesW8y2SUX43ogQeqLw8QKIbbDEirTfg`) y la credencial JSON inyectada via la env var `GCP_CREDENTIALS_JSON` en Dokku. Esto es más robusto y no depende del cache de "Publicar en la web" de Google (que tarda hasta 5 min en refrescar).

---

## ⚠️ Notas importantes

1. **Verificá que las URLs respondan CSV en incógnito**: abrilas en una pestaña privada del navegador. Tenés que ver el CSV crudo, sin pedido de login. Si te pide login → la hoja no está publicada correctamente.

2. **Latencia de actualización (Woo)**:
   - Cuando editás precios en la planilla, **Google tarda hasta ~5 minutos** en actualizar el CSV publicado.
   - Adicionalmente, el plugin Woo cachea el CSV durante **1 día** (`DAY_IN_SECONDS`) en un transient de WordPress.
   - Para forzar refresh inmediato: borrar los transients `datos_csv_mobapp_flash_cp` y `datos_csv_mobapp_flash_tarifa` (vía un plugin tipo *Transients Manager* o WP-CLI), o esperar al próximo ciclo del cron horario.

3. **Latencia de actualización (Tienda Nube)**:
   - La app TN carga el Sheet **una sola vez al arrancar** y lo mantiene en memoria.
   - Para refrescar precios: `dokku ps:restart flash` en el servidor.

4. **Si rotás el Sheet** o re-publicás las hojas, las URLs CAMBIAN (cambia el token después de `/e/`). En ese caso, actualizar:
   - Este archivo
   - El campo de configuración en WooCommerce → Envíos
# MOBAPP FLASH - Guía de actualización y comprobaciones

## Objetivo
Esta guía sirve para:

- actualizar/redeployar la app `flash`
- reiniciar la caché
- verificar que Google Sheets cargó correctamente
- probar el endpoint de cotización
- confirmar que el dominio y SSL están bien
- validar antes y después de instalar en Tiendanube

---

# 1. Datos importantes

## App Dokku
- App: `flash`

## Dominio público
- `https://flash.mobappexpress.com`

## Endpoint de health
- `GET /health`

## Endpoint de cotización
- `POST /api/shipping_rates`

## Hojas usadas
- `MOBAPP FLASH CP`
- `MOBAPP FLASH TARIFA`

---

# 2. Cuándo usar esta guía

Usar esta guía cuando:

- se hizo un deploy nuevo
- se cambió código
- se modificó la planilla de Google Sheets
- se quiere validar que Tiendanube va a recibir tarifas
- se quiere revisar que el SSL siga correcto
- la app devuelve `rates: []` y se necesita diagnosticar

---

# 3. Reinicio rápido de la app

> Importante: la caché de Google Sheets se carga al iniciar la app.
> Si se cambia la planilla, hay que reiniciar.

```bash
dokku ps:restart flash
```

---

# 4. Ver logs al reiniciar

Después del restart, revisar:

```bash
dokku logs flash -t
```

## Lo esperado en logs
Deberían aparecer líneas como estas:

```text
[INFO] Iniciando carga de la caché de Google Sheets...
[INFO] [FLASH] Hoja CP cargada: 578 códigos postales.
[INFO] [FLASH] Hoja TARIFA cargada: 8 tramos.
[INFO] ¡Éxito! La caché de Google Sheets ha sido cargada.
[INFO] Servidor LISTO Y ESCUCHANDO en http://0.0.0.0:3000
[INFO] MODALIDAD: FLASH
[INFO] PUBLIC_API_URL: https://flash.mobappexpress.com
```

## Si no aparece eso
Hay que revisar:
- variables de entorno
- acceso a Google Sheets
- credenciales
- errores de arranque

---

# 5. Health check público

Probar que la app responda públicamente:

```bash
curl -vk https://flash.mobappexpress.com/health
```

## Resultado esperado
```text
HTTP/2 200
OK
```

---

# 6. Verificar SSL del dominio

## Reporte Dokku
```bash
dokku certs:report flash
```

## Resultado esperado
- `Ssl enabled: true`
- `Ssl hostnames: flash.mobappexpress.com`
- `Ssl verified: verified by a certificate authority`

## Inspección manual del certificado
```bash
openssl x509 -in /home/dokku/flash/tls/server.crt -noout -subject -issuer -dates -ext subjectAltName
```

## Resultado esperado
Debe incluir:

```text
subject=CN = flash.mobappexpress.com
DNS:flash.mobappexpress.com
```

---

# 7. Verificar dominio, proceso y proxy

## Dominio de la app
```bash
dokku domains:report flash
```

## Proceso
```bash
dokku ps:report flash
```

## Proxy
```bash
dokku proxy:report flash
```

## Config nginx
```bash
dokku nginx:show-config flash | sed -n '1,220p'
```

## Lo esperado
- dominio configurado: `flash.mobappexpress.com`
- 1 proceso `web.1` corriendo
- proxy nginx activo
- upstream apuntando al contenedor `flash`

---

# 8. Verificar carga interna de caché

Entrar al contenedor:

```bash
docker exec -it flash.web.1 sh
```

## Probar carga de caché y mapeo CP → zona
```bash
node
```

Luego:

```js
const svc = require('./src/services/googleSheetsService');

(async () => {
  await svc.loadAllSheetDataIntoCache();
  console.log('1000 =>', svc.getCpToZona('1000'));
  console.log('1406 =>', svc.getCpToZona('1406'));
  console.log('1602 =>', svc.getCpToZona('1602'));
  console.log('1714 =>', svc.getCpToZona('1714'));
  console.log('1900 =>', svc.getCpToZona('1900'));
})();
```

## Resultado esperado
```text
1000 => CABA
1406 => CABA
1602 => 1ER CORDON
1714 => 2DO CORDON
1900 => 3ER CORDON
```

Salir del REPL:
```js
.exit
```

---

# 9. Verificar cálculo interno de tarifa

Dentro del contenedor:

```bash
node -e "const svc=require('./src/services/googleSheetsService'); const calc=require('./src/services/flashCalculator'); (async()=>{ await svc.loadAllSheetDataIntoCache(); console.log(calc.calcularTarifa('1000',1000)); process.exit(0); })().catch(err=>{ console.error(err); process.exit(1); })"
```

## Resultado esperado
Algo similar a:

```text
{
  titulo: 'MOBAPP FLASH CABA A DOMICILIO - 🔥 ENTREGA EN 24HS',
  precio: 8500,
  zona: 'CABA'
}
```

---

# 10. Verificar endpoint local dentro del contenedor

Esto prueba el endpoint Express sin depender de nginx/TLS:

```bash
node -e "fetch('http://127.0.0.1:3000/api/shipping_rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:{zipcode:'1000'},items:[{grams:1000,quantity:1}]})}).then(r=>r.text()).then(console.log).catch(console.error)"
```

## Resultado esperado
Debe devolver algo como:

```json
{"rates":[{"name":"MOBAPP FLASH CABA A DOMICILIO - 🔥 ENTREGA EN 24HS","code":"MOBAPP_FLASH","price":8500,"price_merchant":8500,"currency":"ARS","type":"ship","min_delivery_date":"...","max_delivery_date":"...","phone_required":false,"reference":"flash-1000"}]}
```

---

# 11. Verificar endpoint público

Desde el host:

```bash
curl -vk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1000"},"items":[{"grams":1000,"quantity":1}]}'
```

## Caso esperado
HTTP 200 y JSON con tarifa.

> Si `curl` muestra algo raro, validar con logs en vivo.

---

# 12. Ver logs en vivo mientras se prueba el endpoint

En una terminal:

```bash
dokku logs flash -t
```

En otra terminal:

```bash
curl -sk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1000"},"items":[{"grams":1000,"quantity":1}]}'
```

## Resultado esperado en logs
```text
[FLASH /shipping_rates] CP: 1000, Peso total: 1000g
[FLASH /shipping_rates] Tarifa encontrada: MOBAPP FLASH CABA A DOMICILIO - 🔥 ENTREGA EN 24HS / $8500 / Zona: CABA
```

---

# 13. Casos de prueba recomendados

## CABA
```bash
curl -sk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1000"},"items":[{"grams":1000,"quantity":1}]}'
```

Esperado:
- zona: `CABA`
- precio: `8500`

---

## 1ER CORDON
```bash
curl -sk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1602"},"items":[{"grams":1000,"quantity":1}]}'
```

Esperado:
- zona: `1ER CORDON`
- precio según tabla vigente

---

## 2DO CORDON
```bash
curl -sk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1714"},"items":[{"grams":1000,"quantity":1}]}'
```

Esperado:
- zona: `2DO CORDON`
- precio según tabla vigente

---

## 3ER CORDON
```bash
curl -sk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1900"},"items":[{"grams":1000,"quantity":1}]}'
```

Esperado:
- zona: `3ER CORDON`
- precio según tabla vigente

---

## CP no contemplado
```bash
curl -sk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1704"},"items":[{"grams":1000,"quantity":1}]}'
```

Esperado:

```json
{"rates":[]}
```

---

# 14. Qué hacer si devuelve `rates: []`

## Paso 1
Ver logs en vivo:

```bash
dokku logs flash -t
```

## Paso 2
Repetir request y revisar:
- si llega `CP`
- si llega `Peso total`
- si aparece `Tarifa encontrada`
- o `Sin tarifa para CP ...`

## Paso 3
Entrar al contenedor y probar cálculo directo:

```bash
docker exec -it flash.web.1 sh
```

```bash
node -e "const svc=require('./src/services/googleSheetsService'); const calc=require('./src/services/flashCalculator'); (async()=>{ await svc.loadAllSheetDataIntoCache(); console.log(calc.calcularTarifa('1000',1000)); process.exit(0); })().catch(err=>{ console.error(err); process.exit(1); })"
```

## Paso 4
Si se cambió la planilla, reiniciar la app:

```bash
dokku ps:restart flash
```

---

# 15. Actualización / redeploy

## Si se hace push o deploy nuevo
Después del deploy:

1. revisar logs:
```bash
dokku logs flash -t
```

2. validar health:
```bash
curl -vk https://flash.mobappexpress.com/health
```

3. validar shipping:
```bash
curl -vk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1000"},"items":[{"grams":1000,"quantity":1}]}'
```

4. verificar certificado:
```bash
dokku certs:report flash
```

---

# 16. Nota importante sobre caché

Actualmente la app:

- carga la caché al iniciar
- no refresca automáticamente Google Sheets
- necesita reinicio para tomar cambios de planilla

## Comando para refrescar caché
```bash
dokku ps:restart flash
```

---

# 17. Recomendación operativa

## Antes de instalar en Tiendanube
Validar:
- `health`
- SSL
- logs
- cálculo interno
- endpoint público
- al menos 3 o 4 CP reales

## Después de instalar en Tiendanube
Hacer pruebas reales en checkout con:
- CABA
- 1ER CORDON
- 2DO CORDON
- 3ER CORDON
- CP no cubierto

---

# 18. Estado esperado para considerar OK

Se puede considerar la app lista si se cumple todo esto:

- `dokku ps:report flash` muestra `running`
- `/health` responde `OK`
- `dokku certs:report flash` muestra cert válido
- logs muestran carga correcta de hojas
- `calcularTarifa('1000',1000)` devuelve tarifa
- `/api/shipping_rates` devuelve JSON con `rates`
- Tiendanube recibe cotización correctamente

---

# 19. Comandos útiles resumidos

## Reiniciar app
```bash
dokku ps:restart flash
```

## Ver logs
```bash
dokku logs flash -t
```

## Ver dominio
```bash
dokku domains:report flash
```

## Ver proceso
```bash
dokku ps:report flash
```

## Ver proxy
```bash
dokku proxy:report flash
```

## Ver SSL
```bash
dokku certs:report flash
```

## Health
```bash
curl -vk https://flash.mobappexpress.com/health
```

## Shipping test
```bash
curl -vk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1000"},"items":[{"grams":1000,"quantity":1}]}'
```

---

# 20. Observación final

Si se actualiza la planilla y no se ve reflejado el cambio, recordar:

```bash
dokku ps:restart flash
```

porque la caché no se refresca automáticamente.
