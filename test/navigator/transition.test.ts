import { expect, test } from "vitest";
import { Div } from "../../src/html/index.ts";
import { Transition } from "../../src/navigator/index.ts";
import { Css } from "../../src/unit/index.ts";

function createMockElement() {
	const attrs = new Map<string, string>();
	const rect = { x: 0, y: 0, width: 0, height: 0 };
	const classList = {
		values: [] as string[],
		add(...classes: string[]) {
			this.values.push(...classes);
		},
		remove(...classes: string[]) {
			this.values = this.values.filter((value) => !classes.includes(value));
		},
		contains(className: string) {
			return this.values.includes(className);
		},
	};
	const children: Array<unknown & { parentNode?: unknown }> = [];
	const attachParent = (node: unknown) => {
		if (typeof node === "object" && node !== null) {
			(node as { parentNode?: unknown }).parentNode = api;
		}
	};
	const api = {
		attrs,
		children,
		classList,
		cloneNode(deep = false) {
			const clone = createMockElement();
			for (const [key, value] of attrs) {
				clone.setAttribute(key, value);
			}
			clone.className = classList.values.join(" ");
			for (const [key, value] of api.style.values as Map<string, string>) {
				clone.style.setProperty(key, value);
			}
			if (deep) {
				children.forEach((child) => {
					if (
						typeof child === "object" &&
						child !== null &&
						"cloneNode" in child
					) {
						clone.append(
							(child as { cloneNode(deep?: boolean): unknown }).cloneNode(true),
						);
					}
				});
			}
			return clone;
		},
		get className() {
			return classList.values.join(" ");
		},
		set className(value: string) {
			classList.values = value.split(/\s+/).filter(Boolean);
		},
		style: {
			values: new Map<string, string>(),
			setProperty(name: string, value: string) {
				this.values.set(name, value);
			},
			removeProperty(name: string) {
				this.values.delete(name);
			},
			getPropertyValue(name: string) {
				return this.values.get(name) ?? "";
			},
		},
		textContent: "",
		getBoundingClientRect() {
			return {
				x: rect.x,
				y: rect.y,
				top: rect.y,
				left: rect.x,
				right: rect.x + rect.width,
				bottom: rect.y + rect.height,
				width: rect.width,
				height: rect.height,
				toJSON() {
					return this;
				},
			} as DOMRect;
		},
		setBoundingClientRect(width: number, height: number) {
			rect.width = width;
			rect.height = height;
		},
		setBoundingClientRectPosition(x: number, y: number) {
			rect.x = x;
			rect.y = y;
		},
		append(...nodes: unknown[]) {
			nodes.forEach(attachParent);
			children.push(...(nodes as Array<unknown & { parentNode?: unknown }>));
		},
		prepend(...nodes: unknown[]) {
			nodes.forEach(attachParent);
			children.unshift(...(nodes as Array<unknown & { parentNode?: unknown }>));
		},
		appendChild(node: unknown) {
			attachParent(node);
			children.push(node as unknown & { parentNode?: unknown });
			return node;
		},
		removeChild(node: unknown) {
			const index = children.indexOf(
				node as unknown & { parentNode?: unknown },
			);
			if (index >= 0) {
				const removed = children.splice(index, 1)[0];
				if (typeof removed === "object" && removed !== null) {
					delete (removed as { parentNode?: unknown }).parentNode;
				}
			}
			return node;
		},
		getAttribute(name: string) {
			return attrs.get(name) ?? null;
		},
		hasAttribute(name: string) {
			return attrs.has(name);
		},
		setAttribute(name: string, value: string) {
			attrs.set(name, value);
		},
		removeAttribute(name: string) {
			attrs.delete(name);
		},
		querySelector(selector: string) {
			const attr = selector.includes("data-transition-placeholder-overlay")
				? "data-transition-placeholder-overlay"
				: selector.includes("data-transition-placeholder")
					? "data-transition-placeholder"
					: null;
			if (!attr) {
				return null;
			}

			const visit = (node: unknown): HTMLElement | null => {
				if (typeof node !== "object" || node === null) {
					return null;
				}

				const element = node as {
					getAttribute?: (name: string) => string | null;
					children?: unknown[];
				};
				if (
					typeof element.getAttribute === "function" &&
					element.getAttribute(attr) === "true"
				) {
					return node as HTMLElement;
				}

				for (const child of element.children ?? []) {
					const found = visit(child);
					if (found) {
						return found;
					}
				}

				return null;
			};

			for (const child of children) {
				const found = visit(child);
				if (found) {
					return found;
				}
			}

			return null;
		},
	};
	return api;
}

test("Transition.name integrates with Camado elements", () => {
	const previousDocument = globalThis.document;
	const element = createMockElement();
	const styleElement = createMockElement();
	const head = createMockElement();
	const doc = {
		head,
		documentElement: head,
		createElement(tagName: string) {
			return tagName === "style" ? styleElement : element;
		},
		createDocumentFragment() {
			return { append() {} } as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeValue: value } as unknown as Text;
		},
		querySelector() {
			return null;
		},
	} as unknown as Document;

	try {
		(globalThis as typeof globalThis & { document: Document }).document = doc;
		Div(Transition.name("card"));

		expect(element.getAttribute("data-transition-name")).toBe("card");
		expect(element.classList.values.length).toBeGreaterThan(0);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("Transition.launch runs the placeholder update", async () => {
	const previousDocument = globalThis.document;
	const start = createMockElement();
	start.setAttribute("id", "card-a");
	const end = createMockElement();
	end.setAttribute("id", "card-detail");
	const byId = new Map<string, HTMLElement>([
		["card-a", start as unknown as HTMLElement],
		["card-detail", end as unknown as HTMLElement],
	]);
	const doc = {
		head: createMockElement(),
		documentElement: createMockElement(),
		createElement(_tagName: string) {
			return createMockElement() as unknown as HTMLElement;
		},
		createDocumentFragment() {
			return { append() {} } as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeValue: value } as unknown as Text;
		},
		getElementById(id: string) {
			return byId.get(id) ?? null;
		},
		querySelectorAll(selector: string) {
			if (!selector.includes("data-transition-name")) {
				return [] as unknown as NodeListOf<HTMLElement>;
			}
			return [start, end] as unknown as NodeListOf<HTMLElement>;
		},
	} as unknown as Document;
	const seenDuringUpdate: string[] = [];

	try {
		(globalThis as typeof globalThis & { document: Document }).document = doc;
		const transition = Transition.launch(
			"card",
			"card-a",
			"card-detail",
			() => {
				seenDuringUpdate.push(start.getAttribute("data-transition-name") ?? "");
			},
			{
				fromPlaceholder: true,
				duration: 14460,
				easing: Css.cubicBezier(0.16, 1, 0.3, 1),
			},
		);

		const transitionStyle = doc.head.children[1] as {
			textContent?: string;
		};
		expect(transitionStyle.textContent).toContain(
			"animation-duration:14460ms;",
		);
		expect(transitionStyle.textContent).toContain(
			"animation-timing-function:cubic-bezier(0.16, 1, 0.3, 1);",
		);

		expect(transition).toBeUndefined();
		await Promise.resolve();
		expect(seenDuringUpdate).toEqual([""]);
		expect(start.getAttribute("data-transition-name")).toBeNull();
		expect(end.getAttribute("data-transition-name")).toBe("card");
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("Transition.bind fails when a bound start is missing", () => {
	const previousDocument = globalThis.document;
	const start = createMockElement();
	start.setAttribute("id", "card-a");
	const missingStart = createMockElement();
	const end = createMockElement();
	end.setAttribute("id", "card-detail");
	const doc = {
		head: createMockElement(),
		documentElement: createMockElement(),
		createElement(_tagName: string) {
			return createMockElement() as unknown as HTMLElement;
		},
		createDocumentFragment() {
			return { append() {} } as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeValue: value } as unknown as Text;
		},
		getElementById(id: string) {
			if (id === "card-a") {
				return start as unknown as HTMLElement;
			}
			if (id === "card-detail") {
				return end as unknown as HTMLElement;
			}
			return null;
		},
		querySelector() {
			return null;
		},
	} as unknown as Document;

	try {
		(globalThis as typeof globalThis & { document: Document }).document = doc;
		expect(() =>
			Transition.bind(
				"card",
				[missingStart as unknown as HTMLElement, "missing-start"],
				"card-detail",
				false,
			),
		).toThrow("ViewTransition targets require IDs");
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("Transition.wrap names the source in placeholder mode before opening", () => {
	const previousDocument = globalThis.document;
	const start = createMockElement();
	const end = createMockElement();
	const doc = {
		head: createMockElement(),
		documentElement: createMockElement(),
		createElement(_tagName: string) {
			return createMockElement() as unknown as HTMLElement;
		},
		createDocumentFragment() {
			return { append() {} } as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeValue: value } as unknown as Text;
		},
		querySelector() {
			return null;
		},
	} as unknown as Document;

	try {
		(globalThis as typeof globalThis & { document: Document }).document = doc;
		const source = Transition.wrap({
			name: "card",
			start: start as unknown as HTMLElement,
			end: end as unknown as HTMLElement,
			condition: false,
			config: { fromPlaceholder: true },
		});

		expect(source).toBe(start as unknown as Element);
		expect(start.getAttribute("data-transition-name")).toBe("card");
		expect(start.style.getPropertyValue("position")).toBe("relative");
		expect(
			start.querySelector('[data-transition-placeholder="true"]'),
		).toBeNull();
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("Transition.wrap keeps source visible while target appears in placeholder mode", () => {
	const previousDocument = globalThis.document;
	const start = createMockElement();
	const end = createMockElement();
	start.setBoundingClientRect(144, 52);
	const doc = {
		head: createMockElement(),
		documentElement: createMockElement(),
		createElement(_tagName: string) {
			return createMockElement() as unknown as HTMLElement;
		},
		createDocumentFragment() {
			return createMockElement() as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeValue: value } as unknown as Text;
		},
		querySelector() {
			return null;
		},
	} as unknown as Document;

	try {
		(globalThis as typeof globalThis & { document: Document }).document = doc;
		Transition.wrap({
			name: "card",
			start: start as unknown as HTMLElement,
			end: end as unknown as HTMLElement,
			condition: false,
			config: { fromPlaceholder: true },
		});
		const target = Transition.wrap({
			name: "card",
			start: start as unknown as HTMLElement,
			end: end as unknown as HTMLElement,
			condition: true,
			config: { fromPlaceholder: true },
		});

		const children = (target as unknown as { children: unknown[] }).children;
		expect(children.length).toBe(2);
		expect((children[0] as { children: unknown[] }).children).toEqual([start]);
		expect(children[1]).toBe(end);
		expect(start.getAttribute("data-transition-name")).toBeNull();
		expect(end.getAttribute("data-transition-name")).toBe("card");
		expect(start.style.getPropertyValue("position")).toBe("relative");
		expect(end.style.getPropertyValue("position")).toBe("");
		expect(
			start.querySelector('[data-transition-placeholder="true"]'),
		).toBeNull();
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("Transition.wrap uses placeholder target when closing", () => {
	const previousDocument = globalThis.document;
	const start = createMockElement();
	const end = createMockElement();
	start.setBoundingClientRect(144, 52);
	const doc = {
		head: createMockElement(),
		documentElement: createMockElement(),
		createElement(_tagName: string) {
			return createMockElement() as unknown as HTMLElement;
		},
		createDocumentFragment() {
			return { append() {} } as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeValue: value } as unknown as Text;
		},
		querySelector() {
			return null;
		},
	} as unknown as Document;

	try {
		(globalThis as typeof globalThis & { document: Document }).document = doc;
		Transition.wrap({
			name: "return-card",
			start: start as unknown as HTMLElement,
			end: end as unknown as HTMLElement,
			condition: false,
			config: { fromPlaceholder: true },
		});
		Transition.wrap({
			name: "return-card",
			start: start as unknown as HTMLElement,
			end: end as unknown as HTMLElement,
			condition: true,
			config: { fromPlaceholder: true },
		});
		const target = Transition.wrap({
			name: "return-card",
			start: start as unknown as HTMLElement,
			end: end as unknown as HTMLElement,
			condition: false,
			config: { fromPlaceholder: true },
		});

		expect(target).toBe(start as unknown as Element);
		expect(start.getAttribute("data-transition-name")).toBeNull();
		expect(end.getAttribute("data-transition-name")).toBeNull();
		const placeholder = start.querySelector(
			'[data-transition-placeholder="true"]',
		);
		expect(placeholder).toBeTruthy();
		expect(placeholder?.getAttribute("data-transition-name")).toBe(
			"return-card",
		);
		expect(start.style.getPropertyValue("position")).toBe("relative");
		expect(end.style.getPropertyValue("position")).toBe("");
		expect(
			(
				placeholder as { style: { getPropertyValue(name: string): string } }
			).style.getPropertyValue("position"),
		).toBe("absolute");
		expect(
			(
				placeholder as { style: { getPropertyValue(name: string): string } }
			).style.getPropertyValue("inset"),
		).toBe("0");
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("Transition.run uses the native View Transition API and cleans up", async () => {
	const previousDocument = globalThis.document;
	const beforeElement = createMockElement();
	const afterElement = createMockElement();
	beforeElement.setAttribute("data-transition-name", "card");
	afterElement.setAttribute("data-transition-name", "card");

	let phase = 0;
	const capture = {
		beforeClass: "",
		afterClass: "",
		beforeViewTransitionClass: "",
		afterViewTransitionClass: "",
		transitionCss: "",
	};

	const doc = {
		head: createMockElement(),
		documentElement: createMockElement(),
		createElement(_tagName: string) {
			return createMockElement() as unknown as HTMLElement;
		},
		createDocumentFragment() {
			return { append() {} } as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeValue: value } as unknown as Text;
		},
		querySelectorAll(selector: string) {
			if (selector.includes("data-transition-placeholder")) {
				return [] as unknown as NodeListOf<HTMLElement>;
			}
			return [
				phase === 0 ? beforeElement : afterElement,
			] as unknown as NodeListOf<HTMLElement>;
		},
		startViewTransition(update: () => void | Promise<void>) {
			const finished = Promise.resolve(update()).then(() => {
				capture.beforeClass = beforeElement.classList.values.join(" ");
				capture.afterClass = afterElement.classList.values.join(" ");
				capture.beforeViewTransitionClass =
					beforeElement.style.getPropertyValue("view-transition-class");
				capture.afterViewTransitionClass = afterElement.style.getPropertyValue(
					"view-transition-class",
				);
				capture.transitionCss =
					(doc.head.children[1] as { textContent?: string }).textContent ?? "";
			});

			return {
				finished,
				ready: finished,
				updateCallbackDone: finished,
			} as unknown as ViewTransition;
		},
	} as unknown as Document;

	try {
		(globalThis as typeof globalThis & { document: Document }).document = doc;
		const seen: string[] = [];
		Transition.wrap({
			name: "card",
			start: createMockElement() as unknown as HTMLElement,
			end: createMockElement() as unknown as HTMLElement,
			condition: false,
			config: {
				fromPlaceholder: true,
				className: "vt-element-animation",
				sharedClassName: "vt-shared",
				openingClassName: "vt-open",
				closingClassName: "vt-close",
				duration: 280,
				easing: "ease-out",
				pseudo: "group",
				pseudoStyle: {
					width: "100%",
					height: "100%",
					overflow: "clip",
					objectPosition: "left top",
					zIndex: 33,
				},
			},
		});
		const transition = Transition.run("card", (nodes) => {
			seen.push(
				nodes.items.card!.firstBefore?.getAttribute("data-transition-name") ??
					"",
			);
			phase = 1;
		});

		expect(transition).toBeDefined();
		await transition?.finished;
		await Promise.resolve();

		expect(seen).toEqual(["card"]);
		expect(capture.beforeClass).toContain("vt-close");
		expect(capture.beforeClass).toContain("vt-shared");
		expect(capture.afterClass).toContain("vt-open");
		expect(capture.afterClass).toContain("vt-shared");
		expect(capture.beforeViewTransitionClass).toBe("vt-close");
		expect(capture.afterViewTransitionClass).toBe("vt-open");
		expect(beforeElement.classList.values).not.toContain("vt-close");
		expect(afterElement.classList.values).not.toContain("vt-open");
		expect(beforeElement.style.getPropertyValue("view-transition-class")).toBe(
			"",
		);
		expect(afterElement.style.getPropertyValue("view-transition-class")).toBe(
			"",
		);
		expect(capture.transitionCss).toContain("width:100%;");
		expect(capture.transitionCss).toContain("height:100%;");
		expect(capture.transitionCss).toContain("overflow:clip;");
		expect(capture.transitionCss).toContain("object-position:left top;");
		expect(capture.transitionCss).toContain("z-index:33;");
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("Transition.run falls back without native support", async () => {
	const previousDocument = globalThis.document;
	const element = createMockElement();
	element.setAttribute("data-transition-name", "card");
	let called = false;

	const doc = {
		head: createMockElement(),
		documentElement: createMockElement(),
		createElement(_tagName: string) {
			return createMockElement() as unknown as HTMLElement;
		},
		createDocumentFragment() {
			return { append() {} } as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeValue: value } as unknown as Text;
		},
		querySelectorAll() {
			return [element] as unknown as NodeListOf<HTMLElement>;
		},
	} as unknown as Document;

	try {
		(globalThis as typeof globalThis & { document: Document }).document = doc;
		const transition = Transition.run("card", () => {
			called = true;
		});

		expect(transition).toBeUndefined();
		await Promise.resolve();
		expect(called).toBe(true);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});
