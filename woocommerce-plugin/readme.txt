=== MOBAPP FLASH - Última Milla ===
Contributors: mobappexpress
Tags: woocommerce, shipping, ultima milla, flash, envios
Requires at least: 5.8
Tested up to: 6.5
Stable tag: 1.0.1
License: GPLv2 or later

Servicio de última milla MOBAPP en CABA y GBA (4 zonas por código postal). Lee tarifas de Google Sheet publicado como CSV.

== Descripción ==

Este plugin registra el método de envío "MOBAPP FLASH - Última Milla" en WooCommerce.
La lógica de cotización se basa en:
1. Identificar la zona del CP destino leyendo la hoja `MOBAPP FLASH CP` de Google Sheets.
2. Encontrar la tarifa correspondiente según zona y peso total del carrito leyendo la hoja `MOBAPP FLASH TARIFA`.

Las tarifas se actualizan automáticamente cada hora vía WP-Cron.

**Importante sobre la unidad de peso:**
El plugin obtiene el peso del carrito con `WC()->cart->get_cart_contents_weight()`, que retorna el peso en la unidad
configurada en WooCommerce (Ajustes → Productos → Unidades → Peso). Asegurate de que esta unidad esté
configurada en **kilogramos (kg)** para que el matching con los tramos de la hoja de tarifas sea correcto.

== Instalación ==

1. Subí el archivo `mobapp-flash-ultima-milla.php` a la carpeta `/wp-content/plugins/mobapp-flash-ultima-milla/`.
2. Activá el plugin desde el menú "Plugins" en WordPress.
3. Andá a WooCommerce → Ajustes → Envío.
4. Creá o editá una zona de envío y agregá el método "MOBAPP FLASH - Última Milla".
5. Configurá las URLs de los CSVs (ver sección "Configuración de las URLs de Google Sheets" abajo).

== Configuración de las URLs de Google Sheets ==

El plugin lee los datos de dos hojas del Google Sheet configurado en el ecosistema MOBAPP:
- **MOBAPP FLASH CP**: Mapeo de CP → Zona
- **MOBAPP FLASH TARIFA**: Tarifas por zona y tramo de peso

Para obtener las URLs de los CSVs publicados:

1. Abrí el Google Sheet en tu navegador.
2. Hacé clic en **Archivo → Compartir → Publicar en la web**.
3. En el primer dropdown, seleccioná la hoja que querés publicar (ej: "MOBAPP FLASH CP").
4. En el segundo dropdown, seleccioná **Valores separados por comas (.csv)**.
5. Hacé clic en **Publicar** y confirmá.
6. Copiá la URL generada (tendrá el formato: `https://docs.google.com/spreadsheets/d/.../pub?gid=...&single=true&output=csv`).
7. Pegá esa URL en el campo correspondiente en la configuración del método de envío.
8. Repetí el proceso para la hoja "MOBAPP FLASH TARIFA".

**Nota sobre los CPs en Google Sheets:**
Al pegar la columna de CPs en Google Sheets, la app puede interpretarlos como números (ej: `1000` → `1.000`).
Para evitar este problema, formateá la columna A como "Texto sin formato" antes de pegar los datos:
Seleccioná la columna A → Formato → Número → Texto sin formato.

== Estructura del Google Sheet ==

=== Hoja: MOBAPP FLASH CP ===

| A: CP (texto, 4 dígitos) | B: ZONA | C: LOCALIDAD |

Zonas válidas: `CABA`, `1ER CORDON`, `2DO CORDON`, `3ER CORDON`
La fila 1 es el encabezado y se salta automáticamente.

=== Hoja: MOBAPP FLASH TARIFA ===

| A: TITULO | B: (vacío) | C: ZONA | D: PESO_MIN (kg) | E: PESO_MAX (kg) | F: PRECIO (ARS) |

El match es: `peso_carrito_kg > PESO_MIN AND peso_carrito_kg <= PESO_MAX AND zona == ZONA`
La fila 1 es el encabezado y se salta automáticamente.

Si el carrito tiene 0 kg de peso, asegurate de tener un tramo `0-25` (donde `PESO_MIN=0` y `PESO_MAX=25`),
ya que `0 > 0` es `false`. Para cubrir pesos 0 kg, usá `PESO_MIN=-1` y `PESO_MAX=0.001` o ajustá según necesidad.

== Troubleshooting ==

**No aparece la opción de envío:**
- Verificá que las URLs de los CSVs estén correctamente configuradas.
- Comprobá que el CP del cliente exista en la hoja MOBAPP FLASH CP.
- Verificá que haya un tramo de tarifa que cubra el peso del carrito para la zona del CP.
- El plugin muestra logs de error si activás el modo debug de WordPress (WP_DEBUG=true).

**Las tarifas no se actualizan:**
- El WP-Cron se ejecuta cuando hay visitas al sitio. En sitios con poco tráfico, puede que el cron no se ejecute regularmente.
- Usá el botón "Forzar recarga ahora" en la configuración del método de envío.
- Alternativamente, configurá el cron del servidor para ejecutar `wp cron event run mobapp_flash_daily_event` cada hora.

**El CP no se reconoce:**
- Verificá que el CP en Google Sheets esté formateado como texto de 4 dígitos (sin puntos ni espacios).
- El plugin normaliza el CP ingresado por el cliente: elimina caracteres no numéricos y aplica padding izquierdo a 4 dígitos.

**Coexistencia con otros plugins MOBAPP:**
- Todas las funciones de este plugin tienen el prefijo `mobapp_flash_` para evitar colisiones con otros plugins del ecosistema MOBAPP.
- Los transients de WP usan nombres únicos: `datos_csv_mobapp_flash_cp` y `datos_csv_mobapp_flash_tarifa`.

== Changelog ==

= 1.0.1 =
* Evita la recursión fatal al cargar el selector de zonas ocultas consultando las zonas por SQL en lugar de instanciar métodos de envío.
* Reemplaza el campo de recarga manual por uno compatible con `instance_form_fields`.
* Hace defensiva la inicialización del método si WooCommerce todavía no cargó `WC_Shipping_Method`.

= 1.0.0 =
* Versión inicial con soporte para 4 zonas (CABA, 1ER CORDON, 2DO CORDON, 3ER CORDON).
* Cron horario para actualización automática de tarifas.
* Soporte para destacar la opción con ícono y texto.
* Botón de recarga manual en el panel de administración.
* Campo de costo de embalaje adicional.
* Soporte para ocultar el método en zonas específicas de WooCommerce.
