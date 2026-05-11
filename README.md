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
