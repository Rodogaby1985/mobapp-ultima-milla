<?php
/**
 * Plugin Name: MOBAPP FLASH - Última Milla
 * Description: Servicio de última milla MOBAPP en CABA y GBA (4 zonas por código postal). Lee tarifas de Google Sheet publicado.
 * Version: 1.0.1
 * Author: MOBAPP EXPRESS
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ─────────────────────────────────────────
// 1. CRON HORARIO: descarga y cachea los CSVs
// ─────────────────────────────────────────

function mobapp_flash_setup_schedule() {
    if ( ! wp_next_scheduled( 'mobapp_flash_daily_event' ) ) {
        wp_schedule_event( time(), 'hourly', 'mobapp_flash_daily_event' );
    }
}
add_action( 'wp', 'mobapp_flash_setup_schedule' );

add_action( 'mobapp_flash_daily_event', 'mobapp_flash_refresh_cache' );

function mobapp_flash_refresh_cache() {
    $settings = get_option( 'woocommerce_mobapp-flash-ultima-milla_settings', [] );

    $url_cp     = isset( $settings['csv_url_cp'] ) ? trim( $settings['csv_url_cp'] ) : '';
    $url_tarifa = isset( $settings['csv_url_tarifa'] ) ? trim( $settings['csv_url_tarifa'] ) : '';

    if ( $url_cp ) {
        $csv = mobapp_flash_get_tarifa_csv( 'datos_csv_mobapp_flash_cp', $url_cp );
    }
    if ( $url_tarifa ) {
        $csv = mobapp_flash_get_tarifa_csv( 'datos_csv_mobapp_flash_tarifa', $url_tarifa );
    }
}

register_deactivation_hook( __FILE__, 'mobapp_flash_deactivate' );
function mobapp_flash_deactivate() {
    wp_clear_scheduled_hook( 'mobapp_flash_daily_event' );
    delete_transient( 'datos_csv_mobapp_flash_cp' );
    delete_transient( 'datos_csv_mobapp_flash_tarifa' );
}

// ─────────────────────────────────────────
// 2. HELPERS: cURL + carga de CSV con transient
// ─────────────────────────────────────────

function mobapp_flash_file_get_contents_curl( $url ) {
    $ch = curl_init();
    curl_setopt( $ch, CURLOPT_URL, $url );
    curl_setopt( $ch, CURLOPT_RETURNTRANSFER, 1 );
    curl_setopt( $ch, CURLOPT_FOLLOWLOCATION, true );
    curl_setopt( $ch, CURLOPT_TIMEOUT, 15 );
    $data = curl_exec( $ch );
    curl_close( $ch );
    return $data;
}

function mobapp_flash_get_tarifa_csv( $transient, $url ) {
    $csv = get_transient( $transient );
    if ( false === $csv ) {
        $csv = mobapp_flash_file_get_contents_curl( $url );
        if ( $csv ) {
            set_transient( $transient, $csv, DAY_IN_SECONDS );
        }
    }
    return $csv;
}

// ─────────────────────────────────────────
// 3. HELPERS: campos comunes y tooltip destacado
// ─────────────────────────────────────────

function mobapp_flash_add_common_fields( &$form_fields ) {
    $form_fields['featured'] = [
        'title'   => 'Destacar opción',
        'type'    => 'checkbox',
        'label'   => 'Mostrar esta opción destacada en negrita con ícono',
        'default' => 'no',
    ];
    $form_fields['featured_text'] = [
        'title'       => 'Texto del ícono destacado',
        'type'        => 'text',
        'description' => 'Sugerencias: 🔥 Más elegido  ⭐ Recomendado  💎 Premium',
        'default'     => '🔥 Más elegido',
    ];
}

function mobapp_flash_append_featured_tooltip( &$titulo, $instance ) {
    $featured      = $instance->get_option( 'featured' );
    $featured_text = $instance->get_option( 'featured_text', '🔥 Más elegido' );
    if ( 'yes' === $featured && $featured_text ) {
        $titulo = '<strong>' . esc_html( $titulo ) . '</strong> — ' . esc_html( $featured_text );
    }
}

// ─────────────────────────────────────────
// 4. REGISTRAR EL MÉTODO DE ENVÍO EN WOOCOMMERCE
// ─────────────────────────────────────────

add_filter( 'woocommerce_shipping_methods', 'mobapp_flash_register_shipping_method' );

function mobapp_flash_register_shipping_method( $methods ) {
    $methods['mobapp-flash-ultima-milla'] = 'WC_MOBAPP_FLASH_ULTIMA_MILLA';
    return $methods;
}

add_action( 'woocommerce_shipping_init', 'mobapp_flash_shipping_init' );

function mobapp_flash_shipping_init() {
    if ( ! class_exists( 'WC_Shipping_Method' ) ) {
        return;
    }

    if ( class_exists( 'WC_MOBAPP_FLASH_ULTIMA_MILLA' ) ) {
        return;
    }

    class WC_MOBAPP_FLASH_ULTIMA_MILLA extends WC_Shipping_Method {

        public function __construct( $instance_id = 0 ) {
            $this->id                 = 'mobapp-flash-ultima-milla';
            $this->instance_id        = absint( $instance_id );
            $this->method_title       = 'MOBAPP FLASH - Última Milla';
            $this->method_description = 'Servicio de última milla MOBAPP en CABA y GBA (4 zonas por código postal).';
            $this->supports           = [ 'shipping-zones', 'instance-settings' ];
            $this->init();
        }

        public function init() {
            $this->init_form_fields();
            $this->init_settings();

            $this->enabled = $this->get_option( 'enabled' );
            $this->title   = $this->get_option( 'title' );

            add_action(
                'woocommerce_update_options_shipping_' . $this->id,
                [ $this, 'process_admin_options' ]
            );

            // Botón de forzar recarga (hook admin)
            add_action( 'admin_init', [ $this, 'maybe_force_reload' ] );
        }

        public function init_form_fields() {
            $force_reload_url = esc_url(
                wp_nonce_url(
                    admin_url( 'admin.php?page=wc-settings&tab=shipping&mobapp_flash_force_reload=1' ),
                    'mobapp_flash_force_reload'
                )
            );

            $this->instance_form_fields = [
                'enabled' => [
                    'title'   => 'Habilitar',
                    'type'    => 'checkbox',
                    'label'   => 'Habilitar MOBAPP FLASH - Última Milla',
                    'default' => 'yes',
                ],
                'title' => [
                    'title'       => 'Título',
                    'type'        => 'text',
                    'description' => 'Nombre que verá el cliente en el checkout.',
                    'default'     => 'MOBAPP Flash - Última Milla',
                    'desc_tip'    => true,
                ],
                'csv_url_cp' => [
                    'title'       => 'URL CSV — Hoja de CPs',
                    'type'        => 'textarea',
                    'description' => 'URL de la hoja <strong>MOBAPP FLASH CP</strong> publicada como CSV.<br>Cómo obtenerla: Archivo → Compartir → Publicar en la web → seleccionar hoja → seleccionar formato CSV → Publicar → copiar URL.',
                    'default'     => '',
                    'css'         => 'width:100%; height:60px;',
                ],
                'csv_url_tarifa' => [
                    'title'       => 'URL CSV — Hoja de Tarifas',
                    'type'        => 'textarea',
                    'description' => 'URL de la hoja <strong>MOBAPP FLASH TARIFA</strong> publicada como CSV.<br>Mismo procedimiento que para CPs.',
                    'default'     => '',
                    'css'         => 'width:100%; height:60px;',
                ],
                'costo_embalaje' => [
                    'title'       => 'Costo de embalaje (ARS)',
                    'type'        => 'text',
                    'description' => 'Costo adicional de embalaje que se suma a la tarifa. Usar 0 para no agregar.',
                    'default'     => '0',
                    'desc_tip'    => true,
                ],
                'label_embalaje' => [
                    'title'       => 'Etiqueta embalaje',
                    'type'        => 'text',
                    'description' => 'Descripción del cargo de embalaje (solo para referencia interna).',
                    'default'     => 'Costo embalaje',
                    'desc_tip'    => true,
                ],
            ];

            // Agregar campos de destacado
            mobapp_flash_add_common_fields( $this->instance_form_fields );

            // Agregar campo de zonas a ocultar
            $this->instance_form_fields['ocultar_para_zonas'] = [
                'title'       => 'Ocultar para zonas de envío',
                'type'        => 'multiselect',
                'description' => 'Seleccioná las zonas de envío de WooCommerce donde este método NO debe aparecer.',
                'options'     => $this->get_wc_zones_options(),
                'default'     => [],
                'desc_tip'    => false,
            ];

            $this->instance_form_fields['force_reload_info'] = [
                'title'       => 'Forzar recarga de tarifas',
                'type'        => 'text',
                'description' => 'Para forzar recarga inmediata desde Google Sheets, abrir este link en una nueva pestaña:<br><a target="_blank" rel="noopener noreferrer" href="' . $force_reload_url . '">🔄 Forzar recarga ahora</a><p class="description">Borra la caché local y vuelve a descargar los CSVs desde Google Sheets inmediatamente.</p>',
                'custom_attributes' => [
                    'readonly' => 'readonly',
                    'style'    => 'display:none;',
                ],
            ];
        }

        private function get_wc_zones_options() {
            global $wpdb;

            $options = [];
            if ( ! function_exists( 'WC' ) || ! isset( $wpdb ) ) {
                return $options;
            }

            $table_name = $wpdb->prefix . 'woocommerce_shipping_zones';
            $rows       = $wpdb->get_results(
                "SELECT zone_id, zone_name FROM {$table_name} ORDER BY zone_order ASC"
            );

            if ( ! empty( $wpdb->last_error ) ) {
                return $options;
            }

            if ( ! empty( $rows ) ) {
                foreach ( $rows as $row ) {
                    $options[ (string) $row->zone_id ] = $row->zone_name;
                }
            }

            return $options;
        }

        /**
         * Forzar recarga de tarifas vía botón en el admin.
         */
        public function maybe_force_reload() {
            if (
                isset( $_GET['mobapp_flash_force_reload'] ) &&
                '1' === $_GET['mobapp_flash_force_reload'] &&
                current_user_can( 'manage_woocommerce' ) &&
                isset( $_GET['_wpnonce'] ) &&
                wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ), 'mobapp_flash_force_reload' )
            ) {
                delete_transient( 'datos_csv_mobapp_flash_cp' );
                delete_transient( 'datos_csv_mobapp_flash_tarifa' );
                mobapp_flash_refresh_cache();
                add_action( 'admin_notices', function () {
                    echo '<div class="notice notice-success is-dismissible"><p>✅ MOBAPP FLASH: Tarifas recargadas correctamente desde Google Sheets.</p></div>';
                } );
            }
        }

        /**
         * Verificar si este método debe ocultarse para la zona actual del paquete.
         */
        private function is_hidden_for_current_zone( $package ) {
            $zonas_a_ocultar = $this->get_option( 'ocultar_para_zonas', [] );
            if ( empty( $zonas_a_ocultar ) ) {
                return false;
            }
            $zone = WC_Shipping_Zones::get_zone_matching_package( $package );
            if ( ! $zone ) {
                return false;
            }
            return in_array( (string) $zone->get_id(), array_map( 'strval', (array) $zonas_a_ocultar ), true );
        }

        public function calculate_shipping( $package = [] ) {
            // Verificar si debe ocultarse para esta zona
            if ( $this->is_hidden_for_current_zone( $package ) ) {
                return;
            }

            // Obtener settings
            $url_cp     = trim( $this->get_option( 'csv_url_cp', '' ) );
            $url_tarifa = trim( $this->get_option( 'csv_url_tarifa', '' ) );

            if ( empty( $url_cp ) || empty( $url_tarifa ) ) {
                // URLs no configuradas, no ofrecer rate
                return;
            }

            // 1. Obtener el CP destino
            $cp = isset( $package['destination']['postcode'] )
                ? trim( (string) $package['destination']['postcode'] )
                : '';

            if ( empty( $cp ) ) {
                return;
            }

            // Normalizar CP a 4 dígitos (quitar caracteres no numéricos, pad izquierdo)
            $cp = preg_replace( '/\D/', '', $cp );
            $cp = str_pad( $cp, 4, '0', STR_PAD_LEFT );

            // 2. Obtener peso del carrito en kg
            // WooCommerce entrega el peso en la unidad configurada en Ajustes → Productos → Peso.
            // Se asume que la unidad de peso está configurada en kilogramos (kg), que es el valor por defecto.
            $peso_kg = floatval( WC()->cart->get_cart_contents_weight() );

            // 3. Cargar CSV de CPs y buscar la zona
            $csv_cp = mobapp_flash_get_tarifa_csv( 'datos_csv_mobapp_flash_cp', $url_cp );
            if ( ! $csv_cp ) {
                return;
            }

            $zona = null;
            $lineas_cp = array_filter( explode( "\n", $csv_cp ) );
            $primer_linea = true;
            foreach ( $lineas_cp as $linea ) {
                if ( $primer_linea ) {
                    // Saltar header
                    $primer_linea = false;
                    continue;
                }
                $cols = str_getcsv( $linea );
                if ( ! isset( $cols[0] ) ) {
                    continue;
                }
                if ( trim( $cols[0] ) === $cp ) {
                    $zona = isset( $cols[1] ) ? trim( $cols[1] ) : null;
                    break;
                }
            }

            if ( null === $zona ) {
                // CP no encontrado → no ofrecer rate
                return;
            }

            // 4. Cargar CSV de tarifas y buscar la tarifa por zona y peso
            $csv_tarifa = mobapp_flash_get_tarifa_csv( 'datos_csv_mobapp_flash_tarifa', $url_tarifa );
            if ( ! $csv_tarifa ) {
                return;
            }

            $titulo     = null;
            $base_cost  = null;
            $lineas_tar = array_filter( explode( "\n", $csv_tarifa ) );
            $primer_linea = true;
            foreach ( $lineas_tar as $linea ) {
                if ( $primer_linea ) {
                    $primer_linea = false;
                    continue;
                }
                $cols = str_getcsv( $linea );
                // Columnas: [0]=TITULO, [1]=(vacío), [2]=ZONA, [3]=PESO_MIN, [4]=PESO_MAX, [5]=PRECIO
                if ( count( $cols ) < 6 ) {
                    continue;
                }
                $col_zona     = trim( $cols[2] );
                $col_peso_min = floatval( $cols[3] );
                $col_peso_max = floatval( $cols[4] );

                if (
                    $col_zona === $zona &&
                    $peso_kg > $col_peso_min &&
                    $peso_kg <= $col_peso_max
                ) {
                    $titulo    = trim( $cols[0] );
                    $base_cost = floatval( $cols[5] );
                    break;
                }
            }

            if ( null === $titulo || null === $base_cost ) {
                // No hay tarifa para esta combinación zona/peso → no ofrecer rate
                return;
            }

            // 5. Sumar costo de embalaje
            $costo_embalaje = floatval( $this->get_option( 'costo_embalaje', '0' ) );
            $total_cost     = $base_cost + $costo_embalaje;

            // 6. Aplicar tooltip/destacado al título
            mobapp_flash_append_featured_tooltip( $titulo, $this );

            // 7. Agregar rate
            $this->add_rate( [
                'id'    => $this->id,
                'label' => $titulo,
                'cost'  => $total_cost,
            ] );
        }
    }
}

// 1.0.1: evita recursión fatal al cargar zonas de envío y usa un campo compatible para forzar recarga.
