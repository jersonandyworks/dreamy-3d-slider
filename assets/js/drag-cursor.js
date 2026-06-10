// Pure, testable drag-cursor follower.
// Listens on doc for pointer/mouse moves, positions cursorEl inside container.

export function attachDragCursor(container, cursorEl, doc) {
	if (!container || !cursorEl) {
		return { detach: () => {} };
	}
	doc = doc || (typeof document !== "undefined" ? document : null);
	if (!doc) return { detach: () => {} };

	cursorEl.style.left = "0px";
	cursorEl.style.top = "0px";
	cursorEl.style.position = "absolute";
	cursorEl.style.pointerEvents = "none";
	cursorEl.style.transform = "translate(-9999px, -9999px)";
	cursorEl.style.opacity = "0";

	const HALF = 40;

	const move = (e) => {
		if (typeof e.clientX !== "number" || typeof e.clientY !== "number") return;
		const rect = container.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
		if (inside) {
			cursorEl.style.transform =
				"translate(" + (x - HALF) + "px, " + (y - HALF) + "px)";
			cursorEl.style.opacity = "1";
		} else {
			cursorEl.style.opacity = "0";
		}
	};

	doc.addEventListener("pointermove", move);
	doc.addEventListener("mousemove", move);

	return {
		detach() {
			doc.removeEventListener("pointermove", move);
			doc.removeEventListener("mousemove", move);
		},
	};
}
