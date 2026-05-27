# MOBAPP - Última Milla

Sistema multi-plataforma para cotización de envíos de última milla (CABA + GBA) integrado con **Tienda Nube** y **WooCommerce**, alimentado por una planilla maestra de Google Sheets.

---

## 📦 Componentes del repositorio

| Carpeta | Plataforma | Descripción |
|---|---|---|
| `tiendanube-app/` | Tienda Nube | App Node.js/Express deployada en Dokku que expone el endpoint OAuth + `/api/shipping_rates` que Tienda Nube consulta en cada checkout. |
| `woocommerce-plugin/` | WooCommerce | Plugin PHP que se instala en WP-Admin y agrega el método de envío "MOBAPP FLASH - Última Milla". |

Ambos componentes leen los mismos datos (CPs + tarifas) del Sheet maestro **`1rlMBJAjV6FwhesW8y2SUX43ogQeqLw8QKIbbDEirTfg`** (`Tarifarios Logísticos - Multi-Tienda`), pero por mecanismos distintos:

- **Tienda Nube** → lee con la **service account de Google Cloud** (`mobapp-tienda-nube-v2@mobapp-tienda-nube-v2.iam.gserviceaccount.com`), credencial JSON inyectada via env var `GCP_CREDENTIALS_JSON`.
- **WooCommerce** → lee 2 URLs CSV **publicadas** del Sheet (ver tabla más abajo).

---

## 🗂️ Índice

1. [Datos importantes](#1-datos-importantes)
2. [URLs CSV para el plugin WooCommerce](#2-urls-csv-para-el-plugin-woocommerce)
3. [Setup inicial del servidor Dokku (una sola vez)](#3-setup-inicial-del-servidor-dokku-una-sola-vez)
4. [Deploy de cambios desde GitHub](#4-deploy-de-cambios-desde-github)
5. [Reinicio rápido y caché](#5-reinicio-rápido-y-caché)
6. [Verificaciones post-deploy](#6-verificaciones-post-deploy)
7. [Verificar SSL y dominio](#7-verificar-ssl-y-dominio)
8. [Verificar carga interna de caché](#8-verificar-carga-interna-de-caché)
9. [Verificar cálculo interno de tarifa](#9-verificar-cálculo-interno-de-tarifa)
10. [Probar endpoint público](#10-probar-endpoint-público)
11. [Casos de prueba recomendados](#11-casos-de-prueba-recomendados)
12. [Qué hacer si devuelve `rates: []`](#12-qué-hacer-si-devuelve-rates-)
13. [Troubleshooting](#13-troubleshooting)
14. [Notas importantes sobre actualización de tarifas](#14-notas-importantes-sobre-actualización-de-tarifas)
15. [Estado esperado para considerar OK](#15-estado-esperado-para-considerar-ok)
16. [Comandos útiles resumidos](#16-comandos-útiles-resumidos)

---

## 1. Datos importantes

### App Dokku
- **Nombre:** `flash`
- **Dominio público:** https://flash.mobappexpress.com
- **Servidor:** `dokku@147.79.86.6`

### Endpoints
- `GET /health` — health check
- `GET /install` — inicio del flujo OAuth de instalación
- `GET /oauth_callback` — callback OAuth de Tienda Nube
- `POST /api/shipping_rates` — endpoint que consume Tienda Nube en cada checkout

### Google Sheet
- **ID:** `1rlMBJAjV6FwhesW8y2SUX43ogQeqLw8QKIbbDEirTfg`
- **Hojas usadas:**
  - `MOBAPP FLASH CP` (códigos postales → zona)
  - `MOBAPP FLASH TARIFA` (precios por zona/tramo)

### Tienda Nube App
- **APP_ID / client_id:** `32545`

---

## 2. URLs CSV para el plugin WooCommerce

Estas son las URLs CSV **públicas** del Sheet maestro. Se obtienen con `Archivo → Compartir → Publicar en la web → seleccionar hoja → CSV → Publicar`.

| Campo del panel | Hoja | URL |
|---|---|---|
| **CSV URL — Tarifas** | `MOBAPP FLASH TARIFA` | `https://docs.google.com/spreadsheets/d/e/2PACX-1vR10pelt-jk2dKh38-ar_pgGsXo2fADUjHOMkBK7jt3uV8Y-zQJSRGcaZSk3S_kL6GP33IAw6Mjd3LA/pub?gid=14...&output=csv` |
| **CSV URL — CPs** | `MOBAPP FLASH CP` | `https://docs.google.com/spreadsheets/d/e/2PACX-1vR10pelt-jk2dKh38-ar_pgGsXo2fADUjHOMkBK7jt3uV8Y-zQJSRGcaZSk3S_kL6GP33IAw6Mjd3LA/pub?gid=1928763953&output=csv` |

> Configuración: **WP-Admin → WooCommerce → Ajustes → Envíos → [zona] → agregar método "MOBAPP FLASH - Última Milla"** y pegar las 2 URLs en sus respectivos campos.

### ⚠️ Notas WooCommerce

- **Verificá las URLs en incógnito**: deben devolver CSV crudo sin pedir login. Si pide login, la hoja no está bien publicada.
- **Latencia de actualización:**
  - Google tarda hasta ~5 min en actualizar el CSV publicado tras editar.
  - El plugin cachea el CSV durante **1 día** (`DAY_IN_SECONDS`) en transients de WordPress.
  - Para forzar refresh inmediato: borrar los transients `datos_csv_mobapp_flash_cp` y `datos_csv_mobapp_flash_tarifa` (vía *Transients Manager* o WP-CLI).
- **Si rotás el Sheet o re-publicás**, las URLs CAMBIAN (cambia el token después de `/e/`). En ese caso, actualizar:
  - Este README
  - El campo de configuración en WooCommerce

---

## 3. Setup inicial del servidor Dokku (una sola vez)

```bash
# 1. Crear la app
dokku apps:create flash

# 2. Configurar dominio
dokku domains:add flash flash.mobappexpress.com

# 3. ⚠️ IMPORTANTE: configurar puertos correctamente
#    Sin esto, nginx escucha en el puerto 3000 con SSL en vez de 443,
#    y el dominio cae en otro vhost por defecto.
dokku ports:add flash http:80:3000 https:443:3000

# 4. Variables de entorno (ajustar valores reales)
dokku config:set flash \
  APP_ID=32545 \
  CLIENT_SECRET=xxxxx \
  MODALIDAD=flash \
  GOOGLE_SHEET_ID=1rlMBJAjV6FwhesW8y2SUX43ogQeqLw8QKIbbDEirTfg \
  SESSION_SECRET=xxxxx \
  PUBLIC_API_URL=https://flash.mobappexpress.com \
  GCP_CREDENTIALS_JSON='{"type":"service_account",...}'

# 5. Plugin de Redis (para sesiones OAuth)
dokku redis:create flash-sessions
dokku redis:link flash-sessions flash

# 6. Certificado SSL Let's Encrypt
dokku letsencrypt:set --global email tu-email@dominio.com
dokku letsencrypt:enable flash
dokku letsencrypt:cron-job --add

# 7. Regenerar nginx (por las dudas)
dokku proxy:build-config flash
systemctl reload nginx
```

---

## 4. Deploy de cambios desde GitHub

```bash
# En tu PC (una sola vez):
git remote add dokku dokku@147.79.86.6:flash

# Cada vez que querés deployar:
git checkout main
git pull origin main
git push dokku main
```

Tras el push, Dokku construye la imagen Docker y la promueve automáticamente. Verificar con:

```bash
dokku logs flash -t
```

---

## 5. Reinicio rápido y caché

> ⚠️ La caché de Google Sheets se carga **una sola vez al iniciar** la app. No se refresca automáticamente.
> Si cambiás precios o CPs en la planilla, hay que reiniciar.

```bash
dokku ps:restart flash
```

### Logs esperados al arrancar

```text
[INFO] Iniciando carga de la caché de Google Sheets...
[INFO] [FLASH] Hoja CP cargada: 578 códigos postales.
[INFO] [FLASH] Hoja TARIFA cargada: 8 tramos.
[INFO] ¡Éxito! La caché de Google Sheets ha sido cargada.
[INFO] Servidor LISTO Y ESCUCHANDO en http://0.0.0.0:3000
[INFO] MODALIDAD: FLASH
[INFO] PUBLIC_API_URL: https://flash.mobappexpress.com
```

Si no aparece eso, revisar:
- variables de entorno (`dokku config:show flash`)
- credenciales `GCP_CREDENTIALS_JSON`
- permisos de la service account en el Sheet (debe ser Editor)

---

## 6. Verificaciones post-deploy

```bash
dokku ports:report flash        # Debe mostrar: http:80:3000 https:443:3000
dokku domains:report flash      # Debe mostrar: flash.mobappexpress.com
dokku ps:report flash           # Debe mostrar: running

# Health check público
curl -vk https://flash.mobappexpress.com/health
# Esperado: HTTP/2 200 + body "OK"

# Verificar que /install redirige al client_id correcto
curl -ksI https://flash.mobappexpress.com/install | grep -i location
# Esperado: location: https://www.tiendanube.com/apps/32545/authorize?...
```

---

## 7. Verificar SSL y dominio

### Reporte Dokku
```bash
dokku certs:report flash
```

Esperado:
- `Ssl enabled: true`
- `Ssl hostnames: flash.mobappexpress.com`
- `Ssl verified: verified by a certificate authority`

### Inspección manual del certificado
```bash
openssl x509 -in /home/dokku/flash/tls/server.crt -noout -subject -issuer -dates -ext subjectAltName
```

Esperado:
```text
subject=CN = flash.mobappexpress.com
DNS:flash.mobappexpress.com
```

### Ver config nginx
```bash
dokku nginx:show-config flash | sed -n '1,220p'
```

---

## 8. Verificar carga interna de caché

Entrar al contenedor:

```bash
docker exec -it flash.web.1 sh
node
```

En el REPL:

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

Esperado:
```text
1000 => CABA
1406 => CABA
1602 => 1ER CORDON
1714 => 2DO CORDON
1900 => 3ER CORDON
```

Salir: `.exit`

---

## 9. Verificar cálculo interno de tarifa

Dentro del contenedor:

```bash
node -e "const svc=require('./src/services/googleSheetsService'); const calc=require('./src/services/flashCalculator'); (async()=>{ await svc.loadAllSheetDataIntoCache(); console.log(calc.calcularTarifa('1000',1000)); })();"
```

Esperado:
```text
{
  titulo: 'MOBAPP FLASH CABA A DOMICILIO - 🔥 ENTREGA EN 24HS',
  precio: 8500,
  zona: 'CABA'
}
```

---

## 10. Probar endpoint público

### Desde dentro del contenedor (saltea nginx/TLS)
```bash
node -e "fetch('http://127.0.0.1:3000/api/shipping_rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination:{zipcode:'1000'},items:[{grams:1000,quantity:1}]})}).then(r=>r.json()).then(console.log)"
```

### Desde el host (vía nginx + TLS)
```bash
curl -vk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1000"},"items":[{"grams":1000,"quantity":1}]}'
```

Esperado: HTTP 200 + JSON tipo:
```json
{"rates":[{"name":"MOBAPP FLASH CABA A DOMICILIO - 🔥 ENTREGA EN 24HS","code":"MOBAPP_FLASH","price":8500,"price_merchant":8500,"currency":"ARS","type":"ship","min_delivery_date":"...","max_delivery_date":"..."}]}
```

### Ver logs en vivo mientras se prueba

```bash
dokku logs flash -t
```

Esperado:
```text
[FLASH /shipping_rates] CP: 1000, Peso total: 1000g
[FLASH /shipping_rates] Tarifa encontrada: MOBAPP FLASH CABA A DOMICILIO - 🔥 ENTREGA EN 24HS / $8500 / Zona: CABA
```

---

## 11. Casos de prueba recomendados

| Zona | CP | Esperado |
|---|---|---|
| CABA | `1000` | zona `CABA`, precio `8500` |
| 1ER CORDON | `1602` | zona `1ER CORDON`, precio según tabla vigente |
| 2DO CORDON | `1714` | zona `2DO CORDON`, precio según tabla vigente |
| 3ER CORDON | `1900` | zona `3ER CORDON`, precio según tabla vigente |
| No cubierto | `1704` | `{"rates":[]}` |

Plantilla:
```bash
curl -sk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"<CP>"},"items":[{"grams":1000,"quantity":1}]}'
```

---

## 12. Qué hacer si devuelve `rates: []`

1. **Ver logs en vivo:**
   ```bash
   dokku logs flash -t
   ```

2. **Repetir request y revisar si aparece:**
   - `CP: ...`
   - `Peso total: ...g`
   - `Tarifa encontrada: ...` ó `Sin tarifa para CP ...`

3. **Probar cálculo directo dentro del contenedor** (ver sección 9).

4. **Si cambiaste la planilla, reiniciar:**
   ```bash
   dokku ps:restart flash
   ```

---

## 13. Troubleshooting

### Síntoma: el dominio devuelve el certificado o contenido de OTRA app
**Causa:** `dokku ports:report flash` está vacío o con puertos raros (ej. `https:3000:3000`).
nginx termina escuchando en 3000 con SSL en vez de en 443, y el dominio cae en otro vhost.

**Fix:**
```bash
dokku ports:add flash http:80:3000 https:443:3000
dokku proxy:build-config flash
systemctl reload nginx
```

### Síntoma: 401 "Invalid access token" al instalar la app en una tienda
**Causa:** La API REST de Tienda Nube **NO usa el header HTTP estándar `Authorization`**. Usa un header propietario llamado **`Authentication`** (sin la "or").

Ver: https://dev.tiendanube.com/docs/applications/authentication

**Fix:** En `tiendanube-app/src/services/tiendaNubeService.js`, los headers deben ser:
```js
const headers = {
  Authentication: `bearer ${accessToken}`,  // ✅ Authentication, no Authorization
  'Content-Type': 'application/json',
  'User-Agent': `TiendaNubeShippingApp/${process.env.APP_ID}`,
};
```

### Síntoma: la sesión OAuth se pierde entre `/install` y `/oauth_callback`
**Causa:** `express-session` con `saveUninitialized: true` y/o sin un store persistente puede perder el `state` CSRF si el contenedor se reinicia o entre instancias.

**Fix:** Usar `saveUninitialized: false` y el plugin de Redis linkeado (`dokku redis:link flash-sessions flash`) como store de sesiones (`connect-redis`).

### Síntoma: cambié precios en la planilla y no se reflejan
**Causa:** La app cachea Google Sheets al arrancar y no refresca automáticamente.

**Fix:**
```bash
dokku ps:restart flash
```

---

## 14. Notas importantes sobre actualización de tarifas

| Plataforma | Mecanismo | Refresh |
|---|---|---|
| Tienda Nube | Service account → Sheet directo | `dokku ps:restart flash` |
| WooCommerce | URLs CSV públicas + transients WP | Borrar transients o esperar 1 día |

> Si rotás credenciales o cambiás el `GOOGLE_SHEET_ID`, hay que actualizar:
> - `dokku config:set flash GCP_CREDENTIALS_JSON=...`
> - `dokku config:set flash GOOGLE_SHEET_ID=...`
> - reiniciar la app

---

## 15. Estado esperado para considerar OK

Antes de instalar en una tienda real, validar TODOS estos puntos:

- [ ] `dokku ps:report flash` muestra `running`
- [ ] `dokku ports:report flash` muestra `http:80:3000 https:443:3000`
- [ ] `dokku certs:report flash` muestra cert válido para `flash.mobappexpress.com`
- [ ] `curl https://flash.mobappexpress.com/health` devuelve `OK`
- [ ] Logs de arranque muestran "Hoja CP cargada" y "Hoja TARIFA cargada"
- [ ] `curl https://flash.mobappexpress.com/install` redirige a `client_id=32545` y `redirect_uri=https%3A%2F%2Fflash.mobappexpress.com%2Foauth_callback`
- [ ] `/api/shipping_rates` devuelve `rates` correctos para CABA, 1°, 2° y 3° cordón
- [ ] Instalación OAuth completa termina con "Shipping Carrier registrado exitosamente"

Después de instalar en Tienda Nube:
- [ ] El método "MOBAPP Flash - Última Milla" aparece en Configuración → Métodos de envío
- [ ] Checkout simulado con CP real devuelve tarifa correcta

---

## 16. Comandos útiles resumidos

```bash
# App
dokku ps:restart flash                 # Reiniciar (refresca caché Sheets)
dokku ps:report flash                  # Estado del proceso
dokku config:show flash                # Ver env vars
dokku logs flash -t                    # Logs en vivo
dokku logs flash --num 100             # Últimas 100 líneas

# Red / SSL
dokku domains:report flash             # Ver dominios
dokku ports:report flash               # Ver mapeo de puertos
dokku proxy:report flash               # Ver config proxy
dokku certs:report flash               # Ver estado SSL
dokku letsencrypt:list                 # Ver certs Let's Encrypt
dokku nginx:show-config flash          # Ver nginx.conf generado

# Health & shipping
curl -vk https://flash.mobappexpress.com/health

curl -sk https://flash.mobappexpress.com/api/shipping_rates \
  -H 'Content-Type: application/json' \
  -d '{"destination":{"zipcode":"1000"},"items":[{"grams":1000,"quantity":1}]}'

# Verificar OAuth redirect
curl -ksI https://flash.mobappexpress.com/install | grep -i location

# Entrar al contenedor
docker exec -it flash.web.1 sh
```

---

## 📝 Historial de problemas resueltos

| Fecha | Problema | Solución |
|---|---|---|
| 2026-05-26 | `client_id` y `redirect_uri` de DOM hardcodeados en código FLASH | Refactor para usar env vars (`APP_ID`, `PUBLIC_API_URL`) |
| 2026-05-26 | Sesión OAuth se perdía entre `/install` y `/oauth_callback` | `saveUninitialized: false` + Redis session store |
| 2026-05-26 | Dokku con puertos mal: `https:3000:3000` (cert de DOM en flash) | `dokku ports:add flash http:80:3000 https:443:3000` |
| 2026-05-26 | API Tienda Nube devolvía 401 con token válido | Header `Authentication` (no `Authorization`) |
