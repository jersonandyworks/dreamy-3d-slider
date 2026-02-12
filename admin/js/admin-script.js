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
			"</div>" +
			"</div>" +
			"</div>";

		$("#slides-repeater").append(html);
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
