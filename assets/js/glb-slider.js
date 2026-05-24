import * as THREE from "https://esm.sh/three@0.160.0";
import { GLTFLoader } from "https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js";

function showError(container, msg) {
	console.error("[innotech-3ds]", msg);
	const loadingEl = container.querySelector(".innotech-3ds-loading");
	if (!loadingEl) return;
	loadingEl.innerHTML =
		'<div style="color:#ff6b6b;font-family:Arial,sans-serif;font-size:13px;padding:12px;text-align:center;max-width:90%;">' +
		String(msg).replace(/</g, "&lt;") +
		"</div>";
}

function initSlider(container) {
	let cfg;
	try {
		cfg = JSON.parse(container.getAttribute("data-innotech-config") || "{}");
	} catch (e) {
		showError(container, "Bad config JSON: " + e.message);
		return;
	}

	const canvas = container.querySelector(".innotech-3ds-canvas");
	const loadingEl = container.querySelector(".innotech-3ds-loading");
	const titleEl = container.querySelector(".innotech-3ds-title");
	const subtitleEl = container.querySelector(".innotech-3ds-subtitle");
	const learnMoreEl = container.querySelector(".innotech-3ds-learnmore");
	const dotsWrap = container.querySelector(".innotech-3ds-dots");
	const counterCurEl = container.querySelector(".innotech-3ds-current");
	const prevBtn = container.querySelector(".innotech-3ds-prev");
	const nextBtn = container.querySelector(".innotech-3ds-next");

	if (!canvas) {
		showError(container, "Canvas element missing");
		return;
	}

	const MODELS = (cfg.slides || []).filter((s) => s && s.model);
	if (!MODELS.length) {
		showError(container, "No 3D models configured");
		return;
	}

	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: true,
		alpha: true,
	});
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.6;

	const scene = new THREE.Scene();
	scene.background = null;
	if (typeof cfg.bgColor === "number") {
		container.style.backgroundColor =
			"#" + cfg.bgColor.toString(16).padStart(6, "0");
	}

	const pmrem = new THREE.PMREMGenerator(renderer);
	scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

	const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
	const CAM_MIN = 1.5;
	const CAM_MAX = 14;
	let camDist = 5.0;
	let camDistTarget = camDist;
	const camTarget = new THREE.Vector3(0, 0, 0);

	const PITCH_MIN = -Math.PI / 3;
	const PITCH_MAX = Math.PI / 2.5;
	let camPitch = 0.22;
	let camPitchTarget = camPitch;

	function applyCameraTransform() {
		const y = Math.sin(camPitch) * camDist;
		const z = Math.cos(camPitch) * camDist;
		camera.position.set(0, y, z);
		camera.lookAt(camTarget);
	}
	applyCameraTransform();

	scene.add(new THREE.AmbientLight(0xffffff, 0.8));
	const top = new THREE.DirectionalLight(0xffffff, 3.0);
	top.position.set(0, 10, 0);
	scene.add(top);
	const key = new THREE.DirectionalLight(0xffffff, 2.5);
	key.position.set(5, 8, 6);
	scene.add(key);
	const fill = new THREE.DirectionalLight(0xbfd6ff, 0.8);
	fill.position.set(-4, 2, -3);
	scene.add(fill);
	const rim = new THREE.DirectionalLight(0xffffff, 0.6);
	rim.position.set(0, 3, -8);
	scene.add(rim);
	scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 0.6));
	const bottomA = new THREE.DirectionalLight(0xffffff, 1.2);
	bottomA.position.set(0, -10, 0);
	scene.add(bottomA);
	const bottomB = new THREE.DirectionalLight(0xffe6cc, 0.5);
	bottomB.position.set(4, -6, 4);
	scene.add(bottomB);
	const bottomC = new THREE.DirectionalLight(0xccddff, 0.5);
	bottomC.position.set(-4, -6, -4);
	scene.add(bottomC);

	const ring = new THREE.Group();
	scene.add(ring);

	const SLOT_COUNT = Math.max(1, MODELS.length);
	const SLOT_ANGLE = (Math.PI * 2) / SLOT_COUNT;
	const RING_RADIUS = cfg.arcRadius
		? Math.max(1.2, cfg.arcRadius * 0.32)
		: 1.9;
	const MODEL_DISPLAY_SIZE = cfg.cardMax
		? Math.max(0.5, cfg.cardMax * 0.22)
		: 1.0;

	const slots = [];

	function buildCenteredModel(gltfScene, targetSize) {
		gltfScene.updateMatrixWorld(true);
		const box = new THREE.Box3();
		let hasMesh = false;
		gltfScene.traverse((c) => {
			if (c.isMesh && c.geometry) {
				if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
				const b = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
				if (!hasMesh) {
					box.copy(b);
					hasMesh = true;
				} else box.union(b);
			}
		});
		if (!hasMesh) box.setFromObject(gltfScene);

		const sizeVec = box.getSize(new THREE.Vector3());
		const size = sizeVec.length() || 1;
		const center = box.getCenter(new THREE.Vector3());
		const s = targetSize / size;

		gltfScene.position.sub(center);
		const wrap = new THREE.Group();
		wrap.add(gltfScene);
		wrap.scale.setScalar(s);
		return { wrap, baseScale: s };
	}

	const loader = new GLTFLoader();
	let loadedCount = 0;
	let failedCount = 0;

	MODELS.forEach((m, i) => {
		const pivot = new THREE.Group();
		const angle = i * SLOT_ANGLE;
		pivot.position.set(
			Math.sin(angle) * RING_RADIUS,
			0,
			Math.cos(angle) * RING_RADIUS
		);
		pivot.rotation.y = angle;
		ring.add(pivot);

		slots.push({ pivot, model: null, baseScale: 1, angle, meta: m });

		loader.load(
			m.model,
			(gltf) => {
				const { wrap, baseScale } = buildCenteredModel(
					gltf.scene,
					MODEL_DISPLAY_SIZE
				);
				pivot.add(wrap);
				slots[i].model = wrap;
				slots[i].baseScale = baseScale;
				loadedCount++;
				updateActiveScales();
				if (loadedCount + failedCount >= MODELS.length && loadingEl) {
					loadingEl.style.display = "none";
				}
			},
			undefined,
			(err) => {
				failedCount++;
				console.error("[innotech-3ds] load failed:", m.model, err);
				if (loadedCount === 0 && failedCount === MODELS.length) {
					showError(
						container,
						"Failed to load 3D models. Check URLs/CORS. First: " + m.model
					);
				} else if (loadedCount + failedCount >= MODELS.length && loadingEl) {
					loadingEl.style.display = "none";
				}
			}
		);
	});

	if (dotsWrap) {
		MODELS.forEach((m, i) => {
			const dot = document.createElement("button");
			dot.className = "innotech-3ds-dot" + (i === 0 ? " active" : "");
			dot.setAttribute("aria-label", "Focus " + (m.title || ""));
			dot.addEventListener("click", () => snapTo(i));
			dotsWrap.appendChild(dot);
		});
	}

	let activeIdx = 0;
	let ringYaw = 0;
	let targetYaw = 0;
	let dragging = false;
	let lastX = 0;
	let lastY = 0;
	let dragVel = 0;
	let lastDragTime = 0;

	function snapTo(i) {
		activeIdx = ((i % SLOT_COUNT) + SLOT_COUNT) % SLOT_COUNT;
		const desired = -activeIdx * SLOT_ANGLE;
		let diff = desired - ringYaw;
		diff =
			((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) -
			Math.PI;
		targetYaw = ringYaw + diff;
		updateUI();
	}

	function updateUI() {
		const m = MODELS[activeIdx] || {};
		if (titleEl) titleEl.textContent = m.title || "";
		if (subtitleEl) subtitleEl.textContent = m.subtitle || "";
		if (learnMoreEl) {
			if (m.link) {
				learnMoreEl.href = m.link;
				learnMoreEl.style.display = "";
			} else {
				learnMoreEl.style.display = "none";
			}
		}
		if (counterCurEl) {
			counterCurEl.textContent = String(activeIdx + 1).padStart(2, "0");
		}
		if (dotsWrap) {
			[...dotsWrap.children].forEach((d, k) =>
				d.classList.toggle("active", k === activeIdx)
			);
		}
		updateActiveScales();
	}

	function updateActiveScales() {
		slots.forEach((s, i) => {
			if (!s.model) return;
			const target = i === activeIdx ? 1.25 : 0.9;
			s.model.userData.scaleTarget = s.baseScale * target;
		});
	}

	function nearestSlotFromYaw(y) {
		const raw = -y / SLOT_ANGLE;
		const idx = Math.round(raw);
		return ((idx % SLOT_COUNT) + SLOT_COUNT) % SLOT_COUNT;
	}

	if (prevBtn) prevBtn.addEventListener("click", () => snapTo(activeIdx - 1));
	if (nextBtn) nextBtn.addEventListener("click", () => snapTo(activeIdx + 1));
	window.addEventListener("keydown", (e) => {
		if (e.key === "ArrowLeft") snapTo(activeIdx - 1);
		if (e.key === "ArrowRight") snapTo(activeIdx + 1);
	});

	canvas.addEventListener("pointerdown", (e) => {
		dragging = true;
		lastX = e.clientX;
		lastY = e.clientY;
		lastDragTime = performance.now();
		dragVel = 0;
		canvas.setPointerCapture(e.pointerId);
	});
	canvas.addEventListener("pointermove", (e) => {
		if (!dragging) return;
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;
		lastX = e.clientX;
		lastY = e.clientY;
		const now = performance.now();
		const dt = Math.max(1, now - lastDragTime);
		lastDragTime = now;

		const rotSpeed = 0.008 * (cfg.dragSensitivity || 1);
		const pitchSpeed = 0.006;
		ringYaw += dx * rotSpeed;
		targetYaw = ringYaw;
		camPitch = Math.max(
			PITCH_MIN,
			Math.min(PITCH_MAX, camPitch + dy * pitchSpeed)
		);
		camPitchTarget = camPitch;
		dragVel = (dx * rotSpeed) / (dt / 16.67);
	});
	function endDrag() {
		if (!dragging) return;
		dragging = false;
		const idx = nearestSlotFromYaw(ringYaw + dragVel * 6);
		snapTo(idx);
	}
	canvas.addEventListener("pointerup", endDrag);
	canvas.addEventListener("pointercancel", endDrag);
	canvas.addEventListener("pointerleave", endDrag);

	canvas.addEventListener(
		"wheel",
		(e) => {
			e.preventDefault();
			const zoomStep = camDistTarget * 0.12;
			camDistTarget += e.deltaY > 0 ? zoomStep : -zoomStep;
			camDistTarget = Math.max(CAM_MIN, Math.min(CAM_MAX, camDistTarget));
		},
		{ passive: false }
	);

	function resize() {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (!w || !h) return;
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}
	new ResizeObserver(resize).observe(canvas);
	resize();

	updateUI();

	const clock = new THREE.Clock();
	const lerp = cfg.lerpSpeed ? Math.max(0.02, cfg.lerpSpeed) * 8 : 8;
	function animate() {
		requestAnimationFrame(animate);
		const dt = Math.min(clock.getDelta(), 0.05);

		if (!dragging) {
			ringYaw += (targetYaw - ringYaw) * Math.min(1, dt * lerp);
		}
		ring.rotation.y = ringYaw;

		camDist += (camDistTarget - camDist) * Math.min(1, dt * lerp);
		camPitch += (camPitchTarget - camPitch) * Math.min(1, dt * lerp);
		applyCameraTransform();

		slots.forEach((s, i) => {
			if (!s.model) return;
			if (i === activeIdx && !dragging) {
				s.model.rotation.y += dt * 0.4;
			}
			const t = s.model.userData.scaleTarget;
			if (t !== undefined) {
				const cur = s.model.scale.x;
				const next = cur + (t - cur) * Math.min(1, dt * 6);
				s.model.scale.setScalar(next);
			}
		});

		renderer.render(scene, camera);
	}
	animate();
}

function bootAll() {
	document
		.querySelectorAll(".innotech-3ds-container[data-innotech-config]")
		.forEach((c) => {
			if (c.dataset.innotechBooted === "1") return;
			c.dataset.innotechBooted = "1";
			try {
				initSlider(c);
			} catch (e) {
				showError(c, "Init error: " + (e && e.message ? e.message : e));
			}
		});
}

// Watchdog: if module imports never resolved (e.g. CDN blocked), bootAll never ran.
// Mark containers and check after delay.
setTimeout(() => {
	document
		.querySelectorAll(".innotech-3ds-container[data-innotech-config]")
		.forEach((c) => {
			if (c.dataset.innotechBooted !== "1") {
				showError(
					c,
					"Three.js module did not load. Check network/CDN access to esm.sh."
				);
			}
		});
}, 15000);

window.addEventListener("error", (e) => {
	if (e && e.filename && /three/.test(e.filename)) {
		document
			.querySelectorAll(".innotech-3ds-container")
			.forEach((c) =>
				showError(c, "Three.js failed to load: " + e.message)
			);
	}
});

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", bootAll);
} else {
	bootAll();
}
