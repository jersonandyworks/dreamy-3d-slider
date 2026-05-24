(function ($) {
	"use strict";

	// Copy shortcode to clipboard
	$("#copy-shortcode").on("click", function () {
		var text = $("#innotech-shortcode").text();
		navigator.clipboard.writeText(text).then(function () {
			var btn = $("#copy-shortcode");
			btn.text("Copied!");
			setTimeout(function () {
				btn.text("Copy");
			}, 1500);
		});
	});

	// WP Media uploader for slide images
	$(document).on("click", ".upload-image", function (e) {
		e.preventDefault();
		var slideItem = $(this).closest(".slide-item");
		var frame = wp.media({
			title: "Select Slide Image",
			button: { text: "Use this image" },
			multiple: false,
		});

		frame.on("select", function () {
			var attachment = frame.state().get("selection").first().toJSON();
			slideItem.find(".slide-image-url").val(attachment.url);
			slideItem
				.find(".image-preview")
				.html('<img src="' + attachment.url + '" alt="Preview" />');
			slideItem.find(".remove-image").show();
		});

		frame.open();
	});

	// Remove image
	$(document).on("click", ".remove-image", function (e) {
		e.preventDefault();
		var slideItem = $(this).closest(".slide-item");
		slideItem.find(".slide-image-url").val("");
		slideItem.find(".image-preview").html("");
		$(this).hide();
	});

	// WP Media uploader for GLB 3D models
	$(document).on("click", ".upload-model", function (e) {
		e.preventDefault();
		var slideItem = $(this).closest(".slide-item");
		var frame = wp.media({
			title: "Select 3D Model (.glb)",
			button: { text: "Use this model" },
			multiple: false,
			library: { type: ["model/gltf-binary", "application/octet-stream"] },
		});

		frame.on("select", function () {
			var attachment = frame.state().get("selection").first().toJSON();
			var url = attachment.url || "";
			var name = url.split("/").pop();
			if (!/\.glb$/i.test(name)) {
				alert("Please select a .glb file.");
				return;
			}
			slideItem.find(".slide-model-url").val(url);
			slideItem.find(".model-preview").text(name);
			slideItem.find(".remove-model").show();
		});

		frame.open();
	});

	// Remove 3D model
	$(document).on("click", ".remove-model", function (e) {
		e.preventDefault();
		var slideItem = $(this).closest(".slide-item");
		slideItem.find(".slide-model-url").val("");
		slideItem
			.find(".model-preview")
			.html("<em>No 3D model — default will be used</em>");
		$(this).hide();
	});

	// Remove slide
	$(document).on("click", ".remove-slide", function () {
		var count = $(".slide-item").length;
		if (count <= 1) {
			alert("You must have at least 1 slide.");
			return;
		}
		$(this).closest(".slide-item").remove();
		reindexSlides();
	});

	// Add slide
	$("#add-slide").on("click", function () {
		var count = $(".slide-item").length;
		if (count >= 6) {
			alert("Maximum 6 slides allowed.");
			return;
		}

		var idx = count;
		var html =
			'<div class="slide-item" data-index="' +
			idx +
			'">' +
			'<div class="slide-header">' +
			'<span class="slide-label">Slide ' +
			(idx + 1) +
			"</span>" +
			'<button type="button" class="button remove-slide" title="Remove slide">&times;</button>' +
			"</div>" +
			'<div class="slide-fields">' +
			'<div class="slide-image-field">' +
			'<div class="image-preview"></div>' +
			'<input type="hidden" name="slides[' +
			idx +
			'][image_url]" class="slide-image-url" value="" />' +
			'<button type="button" class="button upload-image">Upload Image</button>' +
			'<button type="button" class="button remove-image" style="display:none">Remove</button>' +
			"</div>" +
			'<div class="slide-model-field">' +
			'<div class="model-preview"><em>No 3D model — default will be used</em></div>' +
			'<input type="hidden" name="slides[' +
			idx +
			'][model_url]" class="slide-model-url" value="" />' +
			'<button type="button" class="button upload-model">Upload 3D Model (.glb)</button>' +
			'<button type="button" class="button remove-model" style="display:none">Remove</button>' +
			"</div>" +
			'<div class="slide-text-fields">' +
			"<label>Title" +
			'<input type="text" name="slides[' +
			idx +
			'][title]" value="" placeholder="Slide title" />' +
			"</label>" +
			"<label>Subtitle" +
			'<input type="text" name="slides[' +
			idx +
			'][subtitle]" value="" placeholder="Slide subtitle" />' +
			"</label>" +
			"<label>Learn More Link <small>(optional)</small>" +
			'<span class="slide-link-wrap">' +
			'<input type="url" class="slide-link-url" name="slides[' +
			idx +
			'][link_url]" value="" placeholder="https://… or pick a page/post" />' +
			'<button type="button" class="button link-picker-btn" title="Choose page or post" aria-label="Choose page or post"><span class="dashicons dashicons-admin-links"></span></button>' +
			"</span>" +
			"</label>" +
			"</div>" +
			"</div>" +
			"</div>";

		$("#slides-repeater").append(html);
	});

	// ── Link picker modal ──────────────────────────────────────
	var $modal = null;
	var $list = null;
	var $search = null;
	var targetInput = null;
	var searchTimer = null;

	function getModal() {
		if (!$modal) {
			$modal = $("#innotech-3ds-linkmodal");
			$list = $("#innotech-3ds-link-list");
			$search = $("#innotech-3ds-link-search");
		}
		return $modal;
	}

	function openModal(input) {
		targetInput = input;
		getModal().show();
		$search.val("").trigger("focus");
		fetchLinks("");
	}

	function closeModal() {
		if ($modal) $modal.hide();
		targetInput = null;
	}

	function fetchLinks(term) {
		if (typeof innotech3DSAdmin === "undefined") {
			$list.html(
				'<p class="innotech-3ds-link-empty">Config missing.</p>'
			);
			return;
		}
		$list.html('<p class="innotech-3ds-link-empty">Loading…</p>');
		$.ajax({
			url: innotech3DSAdmin.ajaxUrl,
			method: "GET",
			data: {
				action: "innotech_3ds_get_links",
				nonce: innotech3DSAdmin.nonce,
				search: term,
			},
		})
			.done(function (resp) {
				if (!resp || !resp.success || !resp.data || !resp.data.length) {
					$list.html(
						'<p class="innotech-3ds-link-empty">No pages or posts found.</p>'
					);
					return;
				}
				var html = "";
				resp.data.forEach(function (item) {
					html +=
						'<button type="button" class="innotech-3ds-link-item" data-url="' +
						$("<div>").text(item.url).html() +
						'">' +
						'<span class="innotech-3ds-link-title">' +
						$("<div>").text(item.title).html() +
						"</span>" +
						'<span class="innotech-3ds-link-type">' +
						item.type +
						"</span>" +
						"</button>";
				});
				$list.html(html);
			})
			.fail(function () {
				$list.html(
					'<p class="innotech-3ds-link-empty">Request failed.</p>'
				);
			});
	}

	$(document).on("click", ".link-picker-btn", function (e) {
		e.preventDefault();
		var input = $(this)
			.closest(".slide-link-wrap")
			.find(".slide-link-url")
			.get(0);
		openModal(input);
	});

	$(document).on(
		"click",
		".innotech-3ds-linkmodal-close, .innotech-3ds-linkmodal-backdrop",
		function () {
			closeModal();
		}
	);

	$(document).on("click", ".innotech-3ds-link-item", function () {
		var url = $(this).attr("data-url");
		if (targetInput) $(targetInput).val(url);
		closeModal();
	});

	$(document).on("input", "#innotech-3ds-link-search", function () {
		var term = $(this).val();
		clearTimeout(searchTimer);
		searchTimer = setTimeout(function () {
			fetchLinks(term);
		}, 300);
	});

	$(document).on("keydown", function (e) {
		if (e.key === "Escape" && $modal && $modal.is(":visible")) closeModal();
	});

	function reindexSlides() {
		$(".slide-item").each(function (i) {
			$(this).attr("data-index", i);
			$(this)
				.find(".slide-label")
				.text("Slide " + (i + 1));
			$(this)
				.find(".slide-image-url")
				.attr("name", "slides[" + i + "][image_url]");
			$(this)
				.find(".slide-model-url")
				.attr("name", "slides[" + i + "][model_url]");
			$(this)
				.find(".slide-link-url")
				.attr("name", "slides[" + i + "][link_url]");
			$(this)
				.find('input[type="text"]')
				.each(function () {
					var name = $(this).attr("name");
					if (name) {
						name = name.replace(
							/slides\[\d+\]/,
							"slides[" + i + "]"
						);
						$(this).attr("name", name);
					}
				});
		});
	}
})(jQuery);
