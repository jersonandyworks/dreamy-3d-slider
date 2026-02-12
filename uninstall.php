<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

require_once plugin_dir_path( __FILE__ ) . 'includes/class-innotech-3d-slider-db.php';
Innotech_3D_Slider_DB::uninstall();
