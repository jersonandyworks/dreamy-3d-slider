<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Innotech_3D_Slider_Frontend {

	private $instance_count = 0;

	public function __construct() {
		add_shortcode( 'innotech_3d_slider', array( $this, 'render_shortcode' ) );
	}

	public function render_shortcode( $atts ) {
		$this->instance_count++;
		$settings = Innotech_3D_Slider_DB::get_all_settings();
		$slides   = is_array( $settings['slides_data'] ) ? $settings['slides_data'] : array();

		// Build slide list. Use uploaded GLB if provided; otherwise mark for default fallback.
		$has_any_model = false;
		$normalized    = array();
		foreach ( $slides as $slide ) {
			$model = isset( $slide['model_url'] ) ? trim( $slide['model_url'] ) : '';
			if ( $model ) {
				$has_any_model = true;
			}
			$normalized[] = array(
				'model'    => $model,
				'image'    => isset( $slide['image_url'] ) ? esc_url( $slide['image_url'] ) : '',
				'title'    => isset( $slide['title'] ) ? esc_html( $slide['title'] ) : '',
				'subtitle' => isset( $slide['subtitle'] ) ? esc_html( $slide['subtitle'] ) : '',
				'link'     => isset( $slide['link_url'] ) ? esc_url( $slide['link_url'] ) : '',
			);
		}

		// Default cmap models when no uploads exist anywhere.
		$cmap_url = INNOTECH_3DS_PLUGIN_URL . 'assets/cmap/';
		$defaults = array(
			array( 'model' => $cmap_url . 'cmap_box.glb',     'title' => 'CMAP Box',      'subtitle' => '' ),
			array( 'model' => $cmap_url . 'cmap_sensor1.glb', 'title' => 'CMAP Sensor 1', 'subtitle' => '' ),
			array( 'model' => $cmap_url . 'cmap_sensor2.glb', 'title' => 'CMAP Sensor 2', 'subtitle' => '' ),
			array( 'model' => $cmap_url . 'sense.glb',        'title' => 'Sense',         'subtitle' => '' ),
		);

		if ( empty( $normalized ) ) {
			// Nothing configured at all — show pure defaults.
			$valid_slides = $defaults;
		} else {
			// Keep user's title/subtitle/link; fill any missing model from defaults.
			$valid_slides = array();
			$di           = 0;
			foreach ( $normalized as $s ) {
				if ( ! $s['model'] ) {
					$s['model'] = $defaults[ $di % count( $defaults ) ]['model'];
					$di++;
				}
				$valid_slides[] = $s;
			}
		}

		if ( empty( $valid_slides ) ) {
			return '<p style="text-align:center;color:#888;padding:40px;">No slides configured.</p>';
		}

		// Enqueue assets
		wp_enqueue_style(
			'innotech-3ds-slider-css',
			INNOTECH_3DS_PLUGIN_URL . 'assets/css/slider-style.css',
			array(),
			INNOTECH_3DS_VERSION
		);
		wp_enqueue_script(
			'innotech-3ds-glb-js',
			INNOTECH_3DS_PLUGIN_URL . 'assets/js/glb-slider.js',
			array(),
			INNOTECH_3DS_VERSION,
			true
		);

		// Convert bg_color hex to Three.js-compatible integer
		$bg_hex = ltrim( $settings['bg_color'], '#' );
		$bg_int = hexdec( $bg_hex );

		// Convert particle_color hex to integer
		$pc_hex = ltrim( $settings['particle_color'], '#' );
		$pc_int = hexdec( $pc_hex );

		$config = array(
			'containerId'    => 'innotech-3ds-container-' . $this->instance_count,
			'slides'         => $valid_slides,
			'cardMax'        => floatval( $settings['card_max'] ),
			'cornerRadius'   => floatval( $settings['corner_radius'] ),
			'arcRadius'      => floatval( $settings['arc_radius'] ),
			'arcAngle'       => floatval( $settings['arc_angle'] ),
			'lerpSpeed'      => floatval( $settings['lerp_speed'] ),
			'dragSensitivity'=> floatval( $settings['drag_sensitivity'] ),
			'snapThreshold'  => floatval( $settings['snap_threshold'] ),
			'wheelCooldown'  => intval( $settings['wheel_cooldown'] ),
			'blurMultiplier' => floatval( $settings['blur_multiplier'] ),
			'brightnessMin'  => floatval( $settings['brightness_min'] ),
			'opacityMin'     => floatval( $settings['opacity_min'] ),
			'particleCount'  => intval( $settings['particle_count'] ),
			'particleColor'  => $pc_int,
			// 'bgColor'        => $bg_int,
			'dragCursorUrl'  => esc_url( INNOTECH_3DS_PLUGIN_URL . 'assets/images/drag.png' ),
		);

		$container_id = esc_attr( $config['containerId'] );
		$height       = esc_attr( $settings['slider_height'] );
		$total        = count( $valid_slides );
		$config_json  = wp_json_encode( $config );

		$show_counter = $settings['show_counter'] === '1';
		$show_arrows  = $settings['show_arrows'] === '1';

		ob_start();
		?>
		<div class="innotech-3ds-container" id="<?php echo $container_id; ?>" style="height:<?php echo $height; ?>;" data-innotech-config="<?php echo esc_attr( $config_json ); ?>">
			<canvas class="innotech-3ds-canvas"></canvas>

			<div class="innotech-3ds-loading">
				<div class="innotech-3ds-spinner"></div>
			</div>

			<?php if ( $show_counter ) : ?>
			<div class="innotech-3ds-counter">
				<span class="innotech-3ds-current">01</span>
				<span> / </span>
				<span class="innotech-3ds-total"><?php echo str_pad( $total, 2, '0', STR_PAD_LEFT ); ?></span>
			</div>
			<?php endif; ?>

			<?php if ( $show_arrows ) : ?>
			<button class="innotech-3ds-arrow innotech-3ds-prev" aria-label="Previous slide">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
			</button>
			<button class="innotech-3ds-arrow innotech-3ds-next" aria-label="Next slide">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>
			</button>
			<?php endif; ?>

			<img class="innotech-3ds-drag-cursor" src="<?php echo esc_url( INNOTECH_3DS_PLUGIN_URL . 'assets/images/drag.png' ); ?>" alt="Drag" />

			<div class="innotech-3ds-info">
				<h2 class="innotech-3ds-title"></h2>
				<p class="innotech-3ds-subtitle"></p>
				<a class="innotech-3ds-learnmore" href="#" target="_blank" rel="noopener" style="display:none;"><span>Learn More</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></a>
				<div class="innotech-3ds-dots"></div>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}
}
