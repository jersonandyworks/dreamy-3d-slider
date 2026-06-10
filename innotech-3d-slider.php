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

define( 'INNOTECH_3DS_VERSION', '1.0.1' );
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

// Allow .glb uploads in WP media library.
add_filter( 'upload_mimes', function ( $mimes ) {
	$mimes['glb']  = 'model/gltf-binary';
	$mimes['gltf'] = 'model/gltf+json';
	return $mimes;
} );

add_filter( 'wp_check_filetype_and_ext', function ( $data, $file, $filename, $mimes ) {
	if ( ! empty( $data['ext'] ) && ! empty( $data['type'] ) ) {
		return $data;
	}
	$ext = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
	if ( 'glb' === $ext ) {
		$data['ext']  = 'glb';
		$data['type'] = 'model/gltf-binary';
	} elseif ( 'gltf' === $ext ) {
		$data['ext']  = 'gltf';
		$data['type'] = 'model/gltf+json';
	}
	return $data;
}, 10, 4 );

// Tag plugin JS as module (only the real src tag, not inline data scripts).
add_filter( 'script_loader_tag', function ( $tag, $handle, $src ) {
	if ( 'innotech-3ds-glb-js' === $handle && ! empty( $src ) ) {
		return '<script type="module" src="' . esc_url( $src ) . '" id="innotech-3ds-glb-js"></script>' . "\n";
	}
	return $tag;
}, 10, 3 );
