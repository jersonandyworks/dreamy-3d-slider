<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Innotech_3D_Slider_Admin {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_menu_page' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		add_action( 'admin_init', array( $this, 'handle_save' ) );
		add_action( 'wp_ajax_innotech_3ds_get_links', array( $this, 'ajax_get_links' ) );
	}

	public function ajax_get_links() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( 'forbidden', 403 );
		}
		check_ajax_referer( 'innotech_3ds_links', 'nonce' );

		$search = isset( $_GET['search'] ) ? sanitize_text_field( wp_unslash( $_GET['search'] ) ) : '';

		$query_args = array(
			'post_type'      => array( 'post', 'page' ),
			'post_status'    => 'publish',
			'posts_per_page' => 50,
			'orderby'        => 'title',
			'order'          => 'ASC',
		);
		if ( $search ) {
			$query_args['s'] = $search;
		}

		$items = array();
		$query = new WP_Query( $query_args );
		foreach ( $query->posts as $post ) {
			$items[] = array(
				'id'    => $post->ID,
				'title' => get_the_title( $post ) ? get_the_title( $post ) : '(no title)',
				'url'   => get_permalink( $post ),
				'type'  => get_post_type( $post ),
			);
		}
		wp_reset_postdata();

		wp_send_json_success( $items );
	}

	public function add_menu_page() {
		add_options_page(
			'InnoTECHT 3D Slider',
			'InnoTECHT 3D Slider',
			'manage_options',
			'innotech-3d-slider',
			array( $this, 'render_page' )
		);
	}

	public function enqueue_admin_assets( $hook ) {
		if ( 'settings_page_innotech-3d-slider' !== $hook ) {
			return;
		}

		wp_enqueue_media();
		wp_enqueue_style(
			'innotech-3ds-admin-css',
			INNOTECH_3DS_PLUGIN_URL . 'admin/css/admin-style.css',
			array(),
			INNOTECH_3DS_VERSION
		);
		wp_enqueue_script(
			'innotech-3ds-admin-js',
			INNOTECH_3DS_PLUGIN_URL . 'admin/js/admin-script.js',
			array( 'jquery' ),
			INNOTECH_3DS_VERSION,
			true
		);
		wp_localize_script(
			'innotech-3ds-admin-js',
			'innotech3DSAdmin',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'innotech_3ds_links' ),
			)
		);
	}

	public function handle_save() {
		if ( ! isset( $_POST['innotech_3ds_save'] ) ) {
			return;
		}

		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		if ( ! isset( $_POST['innotech_3ds_nonce'] ) || ! wp_verify_nonce( $_POST['innotech_3ds_nonce'], 'innotech_3ds_save_settings' ) ) {
			add_settings_error( 'innotech_3ds', 'nonce_fail', 'Security check failed.', 'error' );
			return;
		}

		// Slides data
		$slides = array();
		if ( isset( $_POST['slides'] ) && is_array( $_POST['slides'] ) ) {
			$count = 0;
			foreach ( $_POST['slides'] as $slide ) {
				if ( $count >= 6 ) break;
				$slides[] = array(
					'image_url' => isset( $slide['image_url'] ) ? esc_url_raw( $slide['image_url'] ) : '',
					'model_url' => isset( $slide['model_url'] ) ? esc_url_raw( $slide['model_url'] ) : '',
					'link_url'  => isset( $slide['link_url'] ) ? esc_url_raw( $slide['link_url'] ) : '',
					'title'     => isset( $slide['title'] ) ? sanitize_text_field( $slide['title'] ) : '',
					'subtitle'  => isset( $slide['subtitle'] ) ? sanitize_text_field( $slide['subtitle'] ) : '',
				);
				$count++;
			}
		}
		if ( ! empty( $slides ) ) {
			Innotech_3D_Slider_DB::update_option( 'slides_data', $slides );
		}

		// Float settings
		$float_fields = array(
			'card_max', 'corner_radius', 'arc_radius', 'arc_angle',
			'lerp_speed', 'drag_sensitivity', 'snap_threshold',
			'blur_multiplier', 'brightness_min', 'opacity_min',
		);
		foreach ( $float_fields as $field ) {
			if ( isset( $_POST[ $field ] ) ) {
				$val = floatval( $_POST[ $field ] );
				Innotech_3D_Slider_DB::update_option( $field, (string) $val );
			}
		}

		// Integer settings
		$int_fields = array( 'wheel_cooldown', 'particle_count' );
		foreach ( $int_fields as $field ) {
			if ( isset( $_POST[ $field ] ) ) {
				$val = intval( $_POST[ $field ] );
				Innotech_3D_Slider_DB::update_option( $field, (string) $val );
			}
		}

		// Color settings
		$color_fields = array( 'particle_color', 'bg_color' );
		foreach ( $color_fields as $field ) {
			if ( isset( $_POST[ $field ] ) ) {
				$val = sanitize_text_field( $_POST[ $field ] );
				if ( preg_match( '/^#[0-9a-fA-F]{6}$/', $val ) ) {
					Innotech_3D_Slider_DB::update_option( $field, $val );
				}
			}
		}

		// Checkbox settings (unchecked = not in POST)
		$checkbox_fields = array( 'show_counter', 'show_arrows' );
		foreach ( $checkbox_fields as $field ) {
			$val = isset( $_POST[ $field ] ) ? '1' : '0';
			Innotech_3D_Slider_DB::update_option( $field, $val );
		}

		// Slider height
		if ( isset( $_POST['slider_height'] ) ) {
			$height = sanitize_text_field( $_POST['slider_height'] );
			if ( preg_match( '/^[\d.]+(px|vh|em|rem|%)$/', $height ) ) {
				Innotech_3D_Slider_DB::update_option( 'slider_height', $height );
			}
		}

		add_settings_error( 'innotech_3ds', 'saved', 'Settings saved successfully.', 'updated' );
	}

	public function render_page() {
		$settings = Innotech_3D_Slider_DB::get_all_settings();
		$slides   = is_array( $settings['slides_data'] ) ? $settings['slides_data'] : array();
		?>
		<div class="wrap innotech-3ds-admin">
			<h1>InnoTECHT 3D Slider Settings</h1>
			<?php settings_errors( 'innotech_3ds' ); ?>

			<form method="post" action="">
				<?php wp_nonce_field( 'innotech_3ds_save_settings', 'innotech_3ds_nonce' ); ?>

				<!-- Shortcode Section -->
				<div class="innotech-3ds-section">
					<h2>Shortcode</h2>
					<p>Copy and paste this shortcode into any page or post to display the 3D slider:</p>
					<div class="shortcode-display">
						<code id="innotech-shortcode">[innotech_3d_slider]</code>
						<button type="button" class="button" id="copy-shortcode">Copy</button>
					</div>
				</div>

				<!-- Slides Section -->
				<div class="innotech-3ds-section">
					<h2>Slides <small>(1-6 slides)</small></h2>
					<div id="slides-repeater">
						<?php
						if ( empty( $slides ) ) {
							$slides = array( array( 'image_url' => '', 'model_url' => '', 'link_url' => '', 'title' => '', 'subtitle' => '' ) );
						}
						foreach ( $slides as $i => $slide ) :
							$model_url = isset( $slide['model_url'] ) ? $slide['model_url'] : '';
							$model_name = $model_url ? basename( wp_parse_url( $model_url, PHP_URL_PATH ) ) : '';
							$link_url   = isset( $slide['link_url'] ) ? $slide['link_url'] : '';
						?>
						<div class="slide-item" data-index="<?php echo $i; ?>">
							<div class="slide-header">
								<span class="slide-label">Slide <?php echo $i + 1; ?></span>
								<button type="button" class="button remove-slide" title="Remove slide">&times;</button>
							</div>
							<div class="slide-fields">
								<div class="slide-image-field">
									<div class="image-preview">
										<?php if ( ! empty( $slide['image_url'] ) ) : ?>
											<img src="<?php echo esc_url( $slide['image_url'] ); ?>" alt="Preview" />
										<?php endif; ?>
									</div>
									<input type="hidden" name="slides[<?php echo $i; ?>][image_url]" class="slide-image-url" value="<?php echo esc_attr( $slide['image_url'] ); ?>" />
									<button type="button" class="button upload-image">Upload Image</button>
									<button type="button" class="button remove-image" <?php echo empty( $slide['image_url'] ) ? 'style="display:none"' : ''; ?>>Remove</button>
								</div>
								<div class="slide-model-field">
									<div class="model-preview"><?php echo $model_name ? esc_html( $model_name ) : '<em>No 3D model — default will be used</em>'; ?></div>
									<input type="hidden" name="slides[<?php echo $i; ?>][model_url]" class="slide-model-url" value="<?php echo esc_attr( $model_url ); ?>" />
									<button type="button" class="button upload-model">Upload 3D Model (.glb)</button>
									<button type="button" class="button remove-model" <?php echo empty( $model_url ) ? 'style="display:none"' : ''; ?>>Remove</button>
								</div>
								<div class="slide-text-fields">
									<label>Title
										<input type="text" name="slides[<?php echo $i; ?>][title]" value="<?php echo esc_attr( $slide['title'] ); ?>" placeholder="Slide title" />
									</label>
									<label>Subtitle
										<input type="text" name="slides[<?php echo $i; ?>][subtitle]" value="<?php echo esc_attr( $slide['subtitle'] ); ?>" placeholder="Slide subtitle" />
									</label>
									<label>Learn More Link <small>(optional)</small>
										<span class="slide-link-wrap">
											<input type="url" class="slide-link-url" name="slides[<?php echo $i; ?>][link_url]" value="<?php echo esc_attr( $link_url ); ?>" placeholder="https://… or pick a page/post" />
											<button type="button" class="button link-picker-btn" title="Choose page or post" aria-label="Choose page or post"><span class="dashicons dashicons-admin-links"></span></button>
										</span>
									</label>
								</div>
							</div>
						</div>
						<?php endforeach; ?>
					</div>
					<button type="button" class="button" id="add-slide">+ Add Slide</button>
				</div>

				<!-- Card Geometry -->
				<div class="innotech-3ds-section">
					<h2>Card Geometry</h2>
					<table class="form-table">
						<tr>
							<th><label for="card_max">Card Max Size</label></th>
							<td><input type="number" id="card_max" name="card_max" value="<?php echo esc_attr( $settings['card_max'] ); ?>" step="0.1" min="1" max="20" /> <span class="description">Max extent on the longer axis (world units)</span></td>
						</tr>
						<tr>
							<th><label for="corner_radius">Corner Radius</label></th>
							<td><input type="number" id="corner_radius" name="corner_radius" value="<?php echo esc_attr( $settings['corner_radius'] ); ?>" step="0.01" min="0" max="0.5" /> <span class="description">Rounded corner amount (0 = sharp)</span></td>
						</tr>
						<tr>
							<th><label for="arc_radius">Arc Radius</label></th>
							<td><input type="number" id="arc_radius" name="arc_radius" value="<?php echo esc_attr( $settings['arc_radius'] ); ?>" step="0.5" min="1" max="30" /> <span class="description">Radius of the circular carousel path</span></td>
						</tr>
						<tr>
							<th><label for="arc_angle">Arc Angle</label></th>
							<td><input type="number" id="arc_angle" name="arc_angle" value="<?php echo esc_attr( $settings['arc_angle'] ); ?>" step="0.05" min="0.1" max="3" /> <span class="description">Angle between adjacent slides (radians)</span></td>
						</tr>
					</table>
				</div>

				<!-- Animation -->
				<div class="innotech-3ds-section">
					<h2>Animation</h2>
					<table class="form-table">
						<tr>
							<th><label for="lerp_speed">Lerp Speed</label></th>
							<td><input type="number" id="lerp_speed" name="lerp_speed" value="<?php echo esc_attr( $settings['lerp_speed'] ); ?>" step="0.01" min="0.01" max="1" /> <span class="description">Animation smoothness (lower = smoother)</span></td>
						</tr>
					</table>
				</div>

				<!-- Interaction -->
				<div class="innotech-3ds-section">
					<h2>Interaction</h2>
					<table class="form-table">
						<tr>
							<th><label for="drag_sensitivity">Drag Sensitivity</label></th>
							<td><input type="number" id="drag_sensitivity" name="drag_sensitivity" value="<?php echo esc_attr( $settings['drag_sensitivity'] ); ?>" step="0.05" min="0.05" max="2" /> <span class="description">How much drag moves the carousel</span></td>
						</tr>
						<tr>
							<th><label for="snap_threshold">Snap Threshold</label></th>
							<td><input type="number" id="snap_threshold" name="snap_threshold" value="<?php echo esc_attr( $settings['snap_threshold'] ); ?>" step="0.01" min="0.01" max="0.5" /> <span class="description">Minimum drag distance to trigger slide change</span></td>
						</tr>
						<tr>
							<th><label for="wheel_cooldown">Wheel Cooldown (ms)</label></th>
							<td><input type="number" id="wheel_cooldown" name="wheel_cooldown" value="<?php echo esc_attr( $settings['wheel_cooldown'] ); ?>" step="50" min="100" max="2000" /> <span class="description">Delay between wheel scroll navigations</span></td>
						</tr>
					</table>
				</div>

				<!-- Visual Effects -->
				<div class="innotech-3ds-section">
					<h2>Visual Effects</h2>
					<table class="form-table">
						<tr>
							<th><label for="blur_multiplier">Blur Multiplier</label></th>
							<td><input type="number" id="blur_multiplier" name="blur_multiplier" value="<?php echo esc_attr( $settings['blur_multiplier'] ); ?>" step="0.1" min="0" max="5" /> <span class="description">Blur intensity for non-focused slides</span></td>
						</tr>
						<tr>
							<th><label for="brightness_min">Brightness Minimum</label></th>
							<td><input type="number" id="brightness_min" name="brightness_min" value="<?php echo esc_attr( $settings['brightness_min'] ); ?>" step="0.05" min="0" max="1" /> <span class="description">Minimum brightness for distant slides</span></td>
						</tr>
						<tr>
							<th><label for="opacity_min">Opacity Minimum</label></th>
							<td><input type="number" id="opacity_min" name="opacity_min" value="<?php echo esc_attr( $settings['opacity_min'] ); ?>" step="0.05" min="0" max="1" /> <span class="description">Minimum opacity for distant slides</span></td>
						</tr>
					</table>
				</div>

				<!-- Particles -->
				<div class="innotech-3ds-section">
					<h2>Particles</h2>
					<table class="form-table">
						<tr>
							<th><label for="particle_count">Particle Count</label></th>
							<td><input type="number" id="particle_count" name="particle_count" value="<?php echo esc_attr( $settings['particle_count'] ); ?>" step="10" min="0" max="500" /> <span class="description">Number of background particles</span></td>
						</tr>
						<tr>
							<th><label for="particle_color">Particle Color</label></th>
							<td><input type="color" id="particle_color" name="particle_color" value="<?php echo esc_attr( $settings['particle_color'] ); ?>" /></td>
						</tr>
					</table>
				</div>

				<!-- Appearance -->
				<div class="innotech-3ds-section">
					<h2>Appearance</h2>
					<table class="form-table">
						<tr>
							<th><label for="bg_color">Background Color</label></th>
							<td><input type="color" id="bg_color" name="bg_color" value="<?php echo esc_attr( $settings['bg_color'] ); ?>" /></td>
						</tr>
						<tr>
							<th><label for="slider_height">Slider Height</label></th>
							<td><input type="text" id="slider_height" name="slider_height" value="<?php echo esc_attr( $settings['slider_height'] ); ?>" placeholder="100vh" /> <span class="description">CSS height value (e.g. 100vh, 600px, 80vh)</span></td>
						</tr>
						<tr>
							<th><label for="show_counter">Show Slide Counter</label></th>
							<td><label><input type="checkbox" id="show_counter" name="show_counter" value="1" <?php checked( $settings['show_counter'], '1' ); ?> /> Display the slide number counter (e.g. 01 / 03)</label></td>
						</tr>
						<tr>
							<th><label for="show_arrows">Show Navigation Arrows</label></th>
							<td><label><input type="checkbox" id="show_arrows" name="show_arrows" value="1" <?php checked( $settings['show_arrows'], '1' ); ?> /> Display the left/right navigation arrows</label></td>
						</tr>
					</table>
				</div>

				<p class="submit">
					<input type="submit" name="innotech_3ds_save" class="button-primary" value="Save Settings" />
				</p>
			</form>

			<!-- Link picker modal -->
			<div class="innotech-3ds-linkmodal" id="innotech-3ds-linkmodal" style="display:none;">
				<div class="innotech-3ds-linkmodal-backdrop"></div>
				<div class="innotech-3ds-linkmodal-box">
					<div class="innotech-3ds-linkmodal-head">
						<h3>Select Page or Post</h3>
						<button type="button" class="innotech-3ds-linkmodal-close" aria-label="Close">&times;</button>
					</div>
					<div class="innotech-3ds-linkmodal-search">
						<input type="search" id="innotech-3ds-link-search" placeholder="Search pages and posts…" />
					</div>
					<div class="innotech-3ds-linkmodal-list" id="innotech-3ds-link-list">
						<p class="innotech-3ds-link-empty">Loading…</p>
					</div>
				</div>
			</div>
		</div>
		<?php
	}
}
