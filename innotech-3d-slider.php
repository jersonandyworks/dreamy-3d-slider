<?php
/**
 * Plugin Name: Dreamy 3D Slider
 * Description: Interactive 3D carousel slider built with Three.js. Use shortcode [innotech_3d_slider] to display.
 * Version: 1.0.0
 * Author: BigTribeDigital
 * License: GPL-2.0+
 * Text Domain: innotech-3d-slider
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'INNOTECH_3DS_VERSION', '1.0.0' );
define( 'INNOTECH_3DS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'INNOTECH_3DS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once INNOTECH_3DS_PLUGIN_DIR . 'includes/class-innotech-3d-slider-db.php';
require_once INNOTECH_3DS_PLUGIN_DIR . 'includes/class-innotech-3d-slider-admin.php';
require_once INNOTECH_3DS_PLUGIN_DIR . 'includes/class-innotech-3d-slider-frontend.php';

register_activation_hook( __FILE__, array( 'Innotech_3D_Slider_DB', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Innotech_3D_Slider_DB', 'deactivate' ) );

if ( is_admin() ) {
	new Innotech_3D_Slider_Admin();
}

new Innotech_3D_Slider_Frontend();
