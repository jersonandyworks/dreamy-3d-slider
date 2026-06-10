// Unit tests for attachDragCursor. Run: node tests/drag-cursor.test.mjs
import { attachDragCursor } from "../assets/js/drag-cursor.js";

let pass = 0;
let fail = 0;

function eq(actual, expected, msg) {
	const ok =
		actual === expected ||
		(typeof actual === "string" && actual.trim() === expected.trim());
	if (ok) {
		pass++;
		console.log("  ok  -", msg);
	} else {
		fail++;
		console.log("  FAIL-", msg, "\n        expected:", expected, "\n        actual:  ", actual);
	}
}

function makeDoc() {
	const listeners = {};
	return {
		listeners,
		addEventListener(type, fn) {
			(listeners[type] = listeners[type] || []).push(fn);
		},
		removeEventListener(type, fn) {
			if (!listeners[type]) return;
			listeners[type] = listeners[type].filter((f) => f !== fn);
		},
		fire(type, evt) {
			(listeners[type] || []).forEach((f) => f(evt));
		},
	};
}

function makeStyle() {
	return new Proxy(
		{},
		{
			set(t, k, v) {
				t[k] = v;
				return true;
			},
			get(t, k) {
				return t[k];
			},
		}
	);
}

function makeContainer(rect) {
	return {
		getBoundingClientRect: () => rect,
	};
}

function makeCursor() {
	return { style: makeStyle() };
}

// ── Test 1: pointermove inside container updates transform + opacity ──
{
	const doc = makeDoc();
	const container = makeContainer({
		left: 100,
		top: 50,
		width: 800,
		height: 500,
		right: 900,
		bottom: 550,
	});
	const cursor = makeCursor();
	attachDragCursor(container, cursor, doc);

	doc.fire("pointermove", { clientX: 200, clientY: 150 });

	// Mouse at (200,150) viewport → (100,100) inside container → translate(60,60)
	eq(
		cursor.style.transform,
		"translate(60px, 60px)",
		"transform translate to (x-40, y-40) inside container"
	);
	eq(cursor.style.opacity, "1", "opacity becomes 1 when inside");
}

// ── Test 2: mousemove fallback also moves cursor ──
{
	const doc = makeDoc();
	const container = makeContainer({
		left: 0,
		top: 0,
		width: 400,
		height: 300,
		right: 400,
		bottom: 300,
	});
	const cursor = makeCursor();
	attachDragCursor(container, cursor, doc);

	doc.fire("mousemove", { clientX: 50, clientY: 60 });
	eq(
		cursor.style.transform,
		"translate(10px, 20px)",
		"mousemove also updates transform"
	);
}

// ── Test 3: outside container hides cursor ──
{
	const doc = makeDoc();
	const container = makeContainer({
		left: 0,
		top: 0,
		width: 100,
		height: 100,
		right: 100,
		bottom: 100,
	});
	const cursor = makeCursor();
	attachDragCursor(container, cursor, doc);

	doc.fire("pointermove", { clientX: 50, clientY: 50 });
	eq(cursor.style.opacity, "1", "inside makes visible");

	doc.fire("pointermove", { clientX: 500, clientY: 500 });
	eq(cursor.style.opacity, "0", "outside hides cursor");
}

// ── Test 4: initial styles set ──
{
	const doc = makeDoc();
	const container = makeContainer({
		left: 0,
		top: 0,
		width: 100,
		height: 100,
		right: 100,
		bottom: 100,
	});
	const cursor = makeCursor();
	attachDragCursor(container, cursor, doc);

	eq(cursor.style.position, "absolute", "position absolute set");
	eq(cursor.style.pointerEvents, "none", "pointer-events none set");
	eq(cursor.style.opacity, "0", "initial opacity 0");
	eq(cursor.style.left, "0px", "initial left 0");
	eq(cursor.style.top, "0px", "initial top 0");
}

// ── Test 5: container transform offset honored via rect ──
{
	// Container visually shifted up (translateY(-175px)). rect.top reflects shifted position.
	const doc = makeDoc();
	const container = makeContainer({
		left: 0,
		top: -175,
		width: 800,
		height: 600,
		right: 800,
		bottom: 425,
	});
	const cursor = makeCursor();
	attachDragCursor(container, cursor, doc);

	doc.fire("pointermove", { clientX: 400, clientY: 100 });
	// inside-relative: x=400, y=275 → translate(360, 235)
	eq(
		cursor.style.transform,
		"translate(360px, 235px)",
		"transformed-container offset handled correctly"
	);
}

// ── Test 6: detach removes listeners ──
{
	const doc = makeDoc();
	const container = makeContainer({
		left: 0,
		top: 0,
		width: 100,
		height: 100,
		right: 100,
		bottom: 100,
	});
	const cursor = makeCursor();
	const h = attachDragCursor(container, cursor, doc);
	h.detach();

	const beforeOpacity = cursor.style.opacity;
	doc.fire("pointermove", { clientX: 50, clientY: 50 });
	eq(
		cursor.style.opacity,
		beforeOpacity,
		"after detach, listener no longer fires"
	);
}

// ── Test 7: bad inputs return no-op handle ──
{
	const h1 = attachDragCursor(null, null, makeDoc());
	eq(typeof h1.detach, "function", "null inputs return no-op handle");

	const h2 = attachDragCursor(makeContainer({}), null, makeDoc());
	eq(typeof h2.detach, "function", "missing cursor returns no-op handle");
}

// ── Test 8: event without coords is ignored ──
{
	const doc = makeDoc();
	const container = makeContainer({
		left: 0,
		top: 0,
		width: 100,
		height: 100,
		right: 100,
		bottom: 100,
	});
	const cursor = makeCursor();
	attachDragCursor(container, cursor, doc);
	const initialTransform = cursor.style.transform;
	doc.fire("pointermove", {});
	eq(
		cursor.style.transform,
		initialTransform,
		"event without clientX/Y leaves transform untouched"
	);
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
