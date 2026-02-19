/**
 * threeDslider.js (WordPress Plugin Version)
 * ═══════════════════════════════════════════════════════════════
 * Interactive 3D Carousel Slider built with Three.js
 * Reads configuration from window.innotech3DSConfig
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
	"use strict";

	/* ─────────────────────────────────────────────────────────
	 * 1. CONFIGURATION (from WordPress admin)
	 * ───────────────────────────────────────────────────────── */

	var cfg = window.innotech3DSConfig || {};

	var SLIDES_DATA = cfg.slides || [];
	var CARD_MAX = parseFloat(cfg.cardMax) || 4.5;
	var CORNER_R = parseFloat(cfg.cornerRadius) || 0.06;
	var ARC_RADIUS = parseFloat(cfg.arcRadius) || 6;
	var ARC_ANGLE = parseFloat(cfg.arcAngle) || 0.8;
	var LERP = parseFloat(cfg.lerpSpeed) || 0.08;
	var DRAG_SENSITIVITY = parseFloat(cfg.dragSensitivity) || 0.25;
	var SNAP_THRESHOLD = parseFloat(cfg.snapThreshold) || 0.08;
	var WHEEL_COOLDOWN = parseInt(cfg.wheelCooldown, 10) || 400;
	var BLUR_MULT = parseFloat(cfg.blurMultiplier) || 0.8;
	var BRIGHT_MIN = parseFloat(cfg.brightnessMin) || 0.45;
	var OPACITY_MIN = parseFloat(cfg.opacityMin) || 0.6;
	var P_COUNT = parseInt(cfg.particleCount, 10) || 100;
	var P_COLOR = cfg.particleColor || 0x0080c7;
	var BG_COLOR = cfg.bgColor || 0x020813;
	var DRAG_CURSOR_URL = cfg.dragCursorUrl || "";
	var CONTAINER_ID = cfg.containerId || "innotech-3ds-container-1";

	if (SLIDES_DATA.length === 0) return;

	/* ─────────────────────────────────────────────────────────
	 * 2. SHADERS
	 * ───────────────────────────────────────────────────────── */

	var VERT =
		"varying vec2 vUv;\n" +
		"void main() {\n" +
		"	vUv = uv;\n" +
		"	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n" +
		"}";

	var FRAG =
		"precision highp float;\n" +
		"uniform sampler2D uTexture;\n" +
		"uniform float uBlur;\n" +
		"uniform float uOpacity;\n" +
		"uniform float uBrightness;\n" +
		"uniform float uGlow;\n" +
		"uniform float uCornerR;\n" +
		"varying vec2 vUv;\n" +
		"float sdRoundBox(vec2 p, vec2 half_size, float r) {\n" +
		"	vec2 q = abs(p) - half_size + r;\n" +
		"	return length(max(q, 0.0)) - r;\n" +
		"}\n" +
		"void main() {\n" +
		"	vec4 color;\n" +
		"	if (uBlur < 0.1) {\n" +
		"		color = texture2D(uTexture, vUv);\n" +
		"	} else {\n" +
		"		float rad = uBlur * 0.004;\n" +
		"		vec4 sum = vec4(0.0);\n" +
		"		float tw = 0.0;\n" +
		"		for (float ox = -2.0; ox <= 2.0; ox += 1.0) {\n" +
		"			for (float oy = -2.0; oy <= 2.0; oy += 1.0) {\n" +
		"				float w = exp(-(ox * ox + oy * oy) / 3.0);\n" +
		"				vec2 uv = clamp(vUv + vec2(ox, oy) * rad, 0.0, 1.0);\n" +
		"				sum += texture2D(uTexture, uv) * w;\n" +
		"				tw += w;\n" +
		"			}\n" +
		"		}\n" +
		"		color = sum / tw;\n" +
		"	}\n" +
		"	color.rgb *= uBrightness;\n" +
		"	float eDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));\n" +
		"	float gMask = smoothstep(0.05, 0.0, eDist);\n" +
		"	color.rgb += vec3(0.0, 0.502, 0.78) * gMask * uGlow * 0.35;\n" +
		"	float d = sdRoundBox(vUv - 0.5, vec2(0.5), uCornerR);\n" +
		"	float mask = 1.0 - smoothstep(-0.003, 0.003, d);\n" +
		"	color.a *= uOpacity * mask;\n" +
		"	gl_FragColor = color;\n" +
		"}";

	/* ─────────────────────────────────────────────────────────
	 * 3. DOM REFERENCES
	 * ───────────────────────────────────────────────────────── */

	var container = document.getElementById(CONTAINER_ID);
	if (!container) return;

	var canvas = container.querySelector(".innotech-3ds-canvas");
	var titleEl = container.querySelector(".innotech-3ds-title");
	var subtitleEl = container.querySelector(".innotech-3ds-subtitle");
	var dotsEl = container.querySelector(".innotech-3ds-dots");
	var counterCur = container.querySelector(".innotech-3ds-current");
	var counterTot = container.querySelector(".innotech-3ds-total");
	var dragCursor = container.querySelector(".innotech-3ds-drag-cursor");
	var prevBtn = container.querySelector(".innotech-3ds-prev");
	var nextBtn = container.querySelector(".innotech-3ds-next");
	var loadingEl = container.querySelector(".innotech-3ds-loading");

	/* ─────────────────────────────────────────────────────────
	 * 4. THREE.JS SCENE
	 * ───────────────────────────────────────────────────────── */

	var scene = new THREE.Scene();
	scene.background = null;

	var camera = new THREE.PerspectiveCamera(
		50,
		container.clientWidth / container.clientHeight,
		0.1,
		100,
	);
	camera.position.set(0, 0.8, 10);
	camera.lookAt(0, 0, 0);

	var renderer = new THREE.WebGLRenderer({
		canvas: canvas,
		antialias: true,
		alpha: true,
	});
	renderer.setClearColor(0x000000, 0);
	renderer.setSize(container.clientWidth, container.clientHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	scene.add(new THREE.AmbientLight(0xffffff, 0.5));

	/* ─────────────────────────────────────────────────────────
	 * 5. BACKGROUND PARTICLES
	 * ───────────────────────────────────────────────────────── */

	var pGeo = new THREE.BufferGeometry();
	var pPos = new Float32Array(P_COUNT * 3);

	for (var i = 0; i < P_COUNT; i++) {
		pPos[i * 3] = (Math.random() - 0.5) * 35;
		pPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
		pPos[i * 3 + 2] = (Math.random() - 0.5) * 25 - 5;
	}

	pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));

	var pMat = new THREE.PointsMaterial({
		color: P_COLOR,
		size: 0.06,
		transparent: true,
		opacity: 0.35,
		sizeAttenuation: true,
	});

	var particles = new THREE.Points(pGeo, pMat);
	scene.add(particles);

	/* ─────────────────────────────────────────────────────────
	 * 6. SLIDE CREATION
	 * ───────────────────────────────────────────────────────── */

	var slides = [];
	var currentIndex = 0;
	var dragOffsetVal = 0;
	var loadedCount = 0;

	function makeSlideMesh(texture, idx) {
		var imgW = texture.image.width || 1;
		var imgH = texture.image.height || 1;
		var aspect = imgW / imgH;
		var cardW, cardH;
		if (aspect >= 1) {
			cardW = CARD_MAX;
			cardH = CARD_MAX / aspect;
		} else {
			cardH = CARD_MAX;
			cardW = CARD_MAX * aspect;
		}
		var geo = new THREE.PlaneGeometry(cardW, cardH);
		var mat = new THREE.ShaderMaterial({
			uniforms: {
				uTexture: { value: texture },
				uBlur: { value: 0.0 },
				uOpacity: { value: 0.0 },
				uBrightness: { value: 1.0 },
				uGlow: { value: 0.0 },
				uCornerR: { value: CORNER_R },
			},
			vertexShader: VERT,
			fragmentShader: FRAG,
			transparent: true,
			depthWrite: false,
		});

		var mesh = new THREE.Mesh(geo, mat);
		scene.add(mesh);

		return {
			mesh: mesh,
			mat: mat,
			idx: idx,
			x: (idx - 1) * 4,
			y: 0,
			z: -6,
			ry: (idx - 1) * ARC_ANGLE,
			scl: 0.7,
			blur: 1,
			bright: 0.4,
			opacity: 0,
			glow: 0,
			tx: 0,
			ty: 0,
			tz: 0,
			try_: 0,
			tscl: 1,
			tblur: 0,
			tbright: 1,
			topacity: 1,
			tglow: 0,
		};
	}

	var loader = new THREE.TextureLoader();

	SLIDES_DATA.forEach(function (data, i) {
		loader.load(data.image, function (tex) {
			tex.colorSpace = THREE.SRGBColorSpace;
			tex.minFilter = THREE.LinearMipmapLinearFilter;
			tex.magFilter = THREE.LinearFilter;

			slides[i] = makeSlideMesh(tex, i);
			loadedCount++;

			if (loadedCount === SLIDES_DATA.length) {
				onReady();
			}
		});
	});

	/* ─────────────────────────────────────────────────────────
	 * 7. CAROUSEL LAYOUT
	 * ───────────────────────────────────────────────────────── */

	function computeTargets() {
		var n = slides.length;

		for (var i = 0; i < n; i++) {
			var s = slides[i];
			if (!s) continue;

			var offset = s.idx - currentIndex + dragOffsetVal;

			while (offset > n / 2) offset -= n;
			while (offset < -n / 2) offset += n;

			var absOff = Math.abs(offset);

			var angle = offset * ARC_ANGLE;

			s.tx = Math.sin(angle) * ARC_RADIUS;
			s.ty = 0;
			s.tz = (Math.cos(angle) - 1) * ARC_RADIUS;
			s.try_ = angle;

			s.tscl = Math.max(0.3, 1.0 - absOff * 0.35);
			s.tblur = Math.min(absOff * BLUR_MULT, 2.0);
			s.tbright = Math.max(BRIGHT_MIN, 1.0 - absOff * 0.3);
			s.topacity = Math.max(OPACITY_MIN, 1.0 - absOff * 0.2);
			s.tglow = absOff < 0.2 ? 1.0 - absOff * 5 : 0;
		}
	}

	/* ─────────────────────────────────────────────────────────
	 * 8. ANIMATION LOOP
	 * ───────────────────────────────────────────────────────── */

	function lerp(a, b, t) {
		return a + (b - a) * t;
	}

	function animate() {
		requestAnimationFrame(animate);

		var dt = LERP;

		for (var i = 0; i < slides.length; i++) {
			var s = slides[i];
			if (!s) continue;

			s.x = lerp(s.x, s.tx, dt);
			s.y = lerp(s.y, s.ty, dt);
			s.z = lerp(s.z, s.tz, dt);
			s.ry = lerp(s.ry, s.try_, dt);
			s.scl = lerp(s.scl, s.tscl, dt);
			s.blur = lerp(s.blur, s.tblur, dt);
			s.bright = lerp(s.bright, s.tbright, dt);
			s.opacity = lerp(s.opacity, s.topacity, dt);
			s.glow = lerp(s.glow, s.tglow, dt);

			s.mesh.position.set(s.x, s.y, s.z);
			s.mesh.rotation.y = s.ry;
			s.mesh.scale.setScalar(s.scl);

			s.mat.uniforms.uBlur.value = s.blur;
			s.mat.uniforms.uBrightness.value = s.bright;
			s.mat.uniforms.uOpacity.value = s.opacity;
			s.mat.uniforms.uGlow.value = s.glow;

			s.mesh.renderOrder = Math.round(-s.z * 100);
		}

		var time = performance.now() * 0.0001;
		particles.rotation.y = time * 0.5;
		particles.rotation.x = Math.sin(time * 0.8) * 0.08;

		// Drag cursor smooth follow / return
		var dcSpeed = mouseInside ? DC_FOLLOW : DC_RETURN;
		var targetX = mouseInside ? cursorX : 0.5;
		var targetY = mouseInside ? cursorY : 0.5;
		dcX = lerp(dcX, targetX, dcSpeed);
		dcY = lerp(dcY, targetY, dcSpeed);
		if (dragCursor) {
			dragCursor.style.left = dcX * 100 + "%";
			dragCursor.style.top = dcY * 100 + "%";
		}

		renderer.render(scene, camera);
	}

	/* ─────────────────────────────────────────────────────────
	 * 9. DRAG HANDLING
	 * ───────────────────────────────────────────────────────── */

	var isDragging = false;
	var startX = 0;
	var currentXPos = 0;

	var mouseInside = false;
	var cursorX = 0.5;
	var cursorY = 0.5;
	var dcX = 0.5;
	var dcY = 0.5;
	var DC_FOLLOW = 0.08;
	var DC_RETURN = 0.04;

	container.addEventListener("mouseenter", function () {
		mouseInside = true;
	});
	container.addEventListener("mouseleave", function () {
		mouseInside = false;
	});
	container.addEventListener("mousemove", function (e) {
		var rect = container.getBoundingClientRect();
		cursorX = (e.clientX - rect.left) / rect.width;
		cursorY = (e.clientY - rect.top) / rect.height;
	});

	function onPointerDown(x) {
		isDragging = true;
		startX = x;
		currentXPos = x;
		container.classList.add("dragging");
	}

	function onPointerMove(x) {
		if (!isDragging) return;
		currentXPos = x;
		var delta = currentXPos - startX;
		dragOffsetVal = -delta / (container.clientWidth * DRAG_SENSITIVITY);
		computeTargets();
	}

	function onPointerUp() {
		if (!isDragging) return;
		isDragging = false;
		container.classList.remove("dragging");

		var delta = currentXPos - startX;
		var threshold = container.clientWidth * SNAP_THRESHOLD;

		if (delta < -threshold) {
			goTo(currentIndex + 1);
		} else if (delta > threshold) {
			goTo(currentIndex - 1);
		}

		dragOffsetVal = 0;
		computeTargets();
	}

	canvas.addEventListener("mousedown", function (e) {
		e.preventDefault();
		onPointerDown(e.clientX);
	});
	window.addEventListener("mousemove", function (e) {
		onPointerMove(e.clientX);
	});
	window.addEventListener("mouseup", onPointerUp);

	canvas.addEventListener(
		"touchstart",
		function (e) {
			e.preventDefault();
			onPointerDown(e.touches[0].clientX);
		},
		{ passive: false },
	);

	window.addEventListener(
		"touchmove",
		function (e) {
			if (isDragging && e.touches.length > 0) {
				onPointerMove(e.touches[0].clientX);
			}
		},
		{ passive: true },
	);

	window.addEventListener("touchend", onPointerUp);

	/* ─────────────────────────────────────────────────────────
	 * 10. NAVIGATION
	 * ───────────────────────────────────────────────────────── */

	function goTo(index) {
		var n = SLIDES_DATA.length;
		currentIndex = ((index % n) + n) % n;
		dragOffsetVal = 0;
		computeTargets();
		updateUI();
	}

	if (prevBtn) {
		prevBtn.addEventListener("click", function () {
			goTo(currentIndex - 1);
		});
	}
	if (nextBtn) {
		nextBtn.addEventListener("click", function () {
			goTo(currentIndex + 1);
		});
	}

	window.addEventListener("keydown", function (e) {
		if (e.key === "ArrowLeft") goTo(currentIndex - 1);
		if (e.key === "ArrowRight") goTo(currentIndex + 1);
	});

	var lastWheel = 0;
	canvas.addEventListener(
		"wheel",
		function (e) {
			e.preventDefault();
			var now = Date.now();
			if (now - lastWheel < WHEEL_COOLDOWN) return;
			lastWheel = now;
			if (e.deltaY > 0 || e.deltaX > 0) goTo(currentIndex + 1);
			else goTo(currentIndex - 1);
		},
		{ passive: false },
	);

	function createDots() {
		if (!dotsEl) return;
		dotsEl.innerHTML = "";
		SLIDES_DATA.forEach(function (_, i) {
			var dot = document.createElement("button");
			dot.className = "innotech-3ds-dot" + (i === 0 ? " active" : "");
			dot.setAttribute("aria-label", "Go to slide " + (i + 1));
			dot.addEventListener("click", function () {
				goTo(i);
			});
			dotsEl.appendChild(dot);
		});
	}

	function updateUI() {
		if (dotsEl) {
			var dots = dotsEl.querySelectorAll(".innotech-3ds-dot");
			for (var i = 0; i < dots.length; i++) {
				if (i === currentIndex) {
					dots[i].classList.add("active");
				} else {
					dots[i].classList.remove("active");
				}
			}
		}

		if (counterCur) {
			counterCur.textContent = String(currentIndex + 1).padStart(2, "0");
		}

		if (titleEl) {
			titleEl.style.opacity = "0";
			titleEl.style.transform = "translateY(12px)";
		}
		if (subtitleEl) {
			subtitleEl.style.opacity = "0";
			subtitleEl.style.transform = "translateY(8px)";
		}

		setTimeout(function () {
			if (titleEl) {
				titleEl.textContent = SLIDES_DATA[currentIndex].title;
				titleEl.style.opacity = "1";
				titleEl.style.transform = "translateY(0)";
			}
			if (subtitleEl) {
				setTimeout(function () {
					subtitleEl.textContent = SLIDES_DATA[currentIndex].subtitle;
					subtitleEl.style.opacity = "1";
					subtitleEl.style.transform = "translateY(0)";
				}, 80);
			}
		}, 250);
	}

	/* ─────────────────────────────────────────────────────────
	 * 11. RESPONSIVE RESIZE
	 * ───────────────────────────────────────────────────────── */

	function onResize() {
		var w = container.clientWidth;
		var h = container.clientHeight;
		var aspect = w / h;

		camera.fov = aspect < 1 ? 65 : 50;
		camera.aspect = aspect;
		camera.updateProjectionMatrix();
		renderer.setSize(w, h);
	}

	window.addEventListener("resize", onResize);

	/* ─────────────────────────────────────────────────────────
	 * 12. BOOTSTRAP
	 * ───────────────────────────────────────────────────────── */

	function onReady() {
		computeTargets();
		createDots();

		if (counterTot) {
			counterTot.textContent = String(SLIDES_DATA.length).padStart(2, "0");
		}
		if (titleEl) {
			titleEl.textContent = SLIDES_DATA[0].title;
			titleEl.style.opacity = "1";
		}
		if (subtitleEl) {
			subtitleEl.textContent = SLIDES_DATA[0].subtitle;
			subtitleEl.style.opacity = "1";
		}

		if (loadingEl) {
			loadingEl.style.opacity = "0";
			setTimeout(function () {
				loadingEl.style.display = "none";
			}, 600);
		}

		animate();
	}
})();
