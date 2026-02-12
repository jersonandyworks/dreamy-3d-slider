<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Innotech_3D_Slider_DB {

	const TABLE_SUFFIX = 'innotech_3d_slider_settings';

	private static function table_name() {
		global $wpdb;
		return $wpdb->prefix . self::TABLE_SUFFIX;
	}

	public static function activate() {
		global $wpdb;
		$table   = self::table_name();
		$charset = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table} (
			id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
			option_name VARCHAR(100) NOT NULL UNIQUE,
			option_value LONGTEXT NOT NULL
		) {$charset};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );

		$defaults = self::get_defaults();
		foreach ( $defaults as $name => $value ) {
			$exists = $wpdb->get_var(
				$wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE option_name = %s", $name )
			);
			if ( ! $exists ) {
				$wpdb->insert(
					$table,
					array(
						'option_name'  => $name,
						'option_value' => is_array( $value ) ? wp_json_encode( $value ) : (string) $value,
					),
					array( '%s', '%s' )
				);
			}
		}
	}

	public static function deactivate() {
		// Keep data on deactivation; only remove on uninstall.
	}

	public static function uninstall() {
		global $wpdb;
		$table = self::table_name();
		$wpdb->query( "DROP TABLE IF EXISTS {$table}" );
	}

	public static function get_defaults() {
		return array(
			'slides_data'      => array(
				array( 'image_url' => '', 'title' => 'Predictive Maintenance', 'subtitle' => 'Anticipate failures before they happen' ),
				array( 'image_url' => '', 'title' => 'Corrosion Management', 'subtitle' => 'Real-time corrosion risk monitoring' ),
				array( 'image_url' => '', 'title' => 'Asset Monitoring', 'subtitle' => 'Smart insights for critical assets' ),
			),
			'card_max'         => '4.5',
			'corner_radius'    => '0.06',
			'arc_radius'       => '6',
			'arc_angle'        => '0.8',
			'lerp_speed'       => '0.08',
			'drag_sensitivity' => '0.25',
			'snap_threshold'   => '0.08',
			'wheel_cooldown'   => '400',
			'blur_multiplier'  => '0.8',
			'brightness_min'   => '0.45',
			'opacity_min'      => '0.6',
			'particle_count'   => '100',
			'particle_color'   => '#0080c7',
			'bg_color'         => '#020813',
			'slider_height'    => '100vh',
			'show_counter'     => '1',
			'show_arrows'      => '1',
		);
	}

	public static function get_option( $name ) {
		global $wpdb;
		$table = self::table_name();
		$value = $wpdb->get_var(
			$wpdb->prepare( "SELECT option_value FROM {$table} WHERE option_name = %s", $name )
		);

		if ( null === $value ) {
			$defaults = self::get_defaults();
			if ( isset( $defaults[ $name ] ) ) {
				$def = $defaults[ $name ];
				return is_array( $def ) ? $def : $def;
			}
			return '';
		}

		// Try JSON decode for slides_data
		if ( 'slides_data' === $name ) {
			$decoded = json_decode( $value, true );
			return is_array( $decoded ) ? $decoded : array();
		}

		return $value;
	}

	public static function update_option( $name, $value ) {
		global $wpdb;
		$table      = self::table_name();
		$store_val  = is_array( $value ) ? wp_json_encode( $value ) : (string) $value;

		$exists = $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE option_name = %s", $name )
		);

		if ( $exists ) {
			$wpdb->update(
				$table,
				array( 'option_value' => $store_val ),
				array( 'option_name' => $name ),
				array( '%s' ),
				array( '%s' )
			);
		} else {
			$wpdb->insert(
				$table,
				array(
					'option_name'  => $name,
					'option_value' => $store_val,
				),
				array( '%s', '%s' )
			);
		}
	}

	public static function get_all_settings() {
		$defaults = self::get_defaults();
		$settings = array();
		foreach ( $defaults as $name => $default ) {
			$settings[ $name ] = self::get_option( $name );
		}
		return $settings;
	}
}
