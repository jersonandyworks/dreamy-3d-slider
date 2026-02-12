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

		// Filter out slides with no image
		$valid_slides = array();
		foreach ( $slides as $slide ) {
			if ( ! empty( $slide['image_url'] ) ) {
				$valid_slides[] = array(
					'image'    => esc_url( $slide['image_url'] ),
					'title'    => esc_html( $slide['title'] ),
					'subtitle' => esc_html( $slide['subtitle'] ),
				);
			}
		}

		if ( empty( $valid_slides ) ) {
			return '<p style="text-align:center;color:#888;padding:40px;">No slides configured. Please add images in Settings &gt; InnoTECHT 3D Slider.</p>';
		}

		// Enqueue assets
		wp_enqueue_style(
			'innotech-3ds-slider-css',
			INNOTECH_3DS_PLUGIN_URL . 'assets/css/slider-style.css',
			array(),
			INNOTECH_3DS_VERSION
		);
		wp_enqueue_script(
			'three-js',
			'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
			array(),
			'0.160.0',
			true
		);
		wp_enqueue_script(
			'innotech-3ds-slider-js',
			INNOTECH_3DS_PLUGIN_URL . 'assets/js/threeDslider.js',
			array( 'three-js' ),
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
			'bgColor'        => $bg_int,
			'dragCursorUrl'  => esc_url( INNOTECH_3DS_PLUGIN_URL . 'assets/images/drag.png' ),
		);

		wp_localize_script( 'innotech-3ds-slider-js', 'innotech3DSConfig', $config );

		$container_id = esc_attr( $config['containerId'] );
		$height       = esc_attr( $settings['slider_height'] );
		$total        = count( $valid_slides );

		$show_counter = $settings['show_counter'] === '1';
		$show_arrows  = $settings['show_arrows'] === '1';

		ob_start();
		?>
		<div class="innotech-3ds-container" id="<?php echo $container_id; ?>" style="height:<?php echo $height; ?>;">
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
				<div class="innotech-3ds-dots"></div>
			</div>
		</div>
		<?php
		return ob_get_clean();
	}
}
