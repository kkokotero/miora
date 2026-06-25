import { afterAll, expect, test } from "vitest";

class MockNode {
	nodeType = 0;
	parentNode: any = null;
	childNodes: any[] = [];

	append(...nodes: any[]): void {
		for (const node of nodes) {
			if (typeof node === "string") {
				this.append(new MockText(node));
				continue;
			}

			if (node?.nodeType === 11) {
				this.append(...node.childNodes);
				continue;
			}

			node.parentNode = this;
			this.childNodes.push(node);
		}
	}

	replaceChildren(...nodes: any[]): void {
		for (const child of [...this.childNodes]) {
			child.parentNode = null;
		}
		this.childNodes = [];
		this.append(...nodes);
	}

	replaceChild(newNode: any, oldNode: any): void {
		const index = this.childNodes.indexOf(oldNode);
		if (index === -1) return;
		newNode.parentNode = this;
		oldNode.parentNode = null;
		this.childNodes.splice(index, 1, newNode);
	}

	insertBefore(newNode: any, anchor: any | null): void {
		if (anchor === null) {
			this.append(newNode);
			return;
		}

		const index = this.childNodes.indexOf(anchor);
		if (index === -1) {
			this.append(newNode);
			return;
		}

		if (newNode.parentNode === this) {
			const currentIndex = this.childNodes.indexOf(newNode);
			if (currentIndex !== -1) {
				this.childNodes.splice(currentIndex, 1);
			}
		} else if (newNode.parentNode) {
			newNode.parentNode.removeChild(newNode);
		}

		newNode.parentNode = this;
		this.childNodes.splice(index, 0, newNode);
	}

	removeChild(node: any): void {
		const index = this.childNodes.indexOf(node);
		if (index === -1) return;
		node.parentNode = null;
		this.childNodes.splice(index, 1);
	}

	get nextSibling(): any | null {
		if (!this.parentNode) return null;
		const index = this.parentNode.childNodes.indexOf(this);
		return this.parentNode.childNodes[index + 1] ?? null;
	}
}

class MockText extends MockNode {
	override nodeType = 3 as const;
	data: string;

	constructor(value: string) {
		super();
		this.data = value;
	}

	get textContent(): string {
		return this.data;
	}

	set textContent(value: string) {
		this.data = value;
	}
}

class MockDocumentFragment extends MockNode {
	override nodeType = 11 as const;
}

class MockHTMLElement extends MockNode {
	override nodeType = 1 as const;
	tagName = "";
	namespaceURI = "http://www.w3.org/1999/xhtml";
	style = {
		cssText: "",
		setProperty: (_name: string, value: string) => {
			this.style.cssText = value;
		},
	};
	classList = {
		values: [] as string[],
		add: (...classes: string[]) => {
			this.classList.values.push(...classes);
		},
	};
	#attributes = new Map<string, string>();
	#listeners = new Map<string, Array<EventListenerOrEventListenerObject>>();

	getAttributeNames(): string[] {
		return [...this.#attributes.keys()];
	}

	getAttribute(name: string): string | null {
		return this.#attributes.get(name) ?? null;
	}

	setAttribute(name: string, value: string): void {
		this.#attributes.set(name, value);
	}

	removeAttribute(name: string): void {
		this.#attributes.delete(name);
	}

	addEventListener(
		name: string,
		listener: EventListenerOrEventListenerObject,
	): void {
		const current = this.#listeners.get(name) ?? [];
		current.push(listener);
		this.#listeners.set(name, current);
	}

	removeEventListener(
		name: string,
		listener: EventListenerOrEventListenerObject,
	): void {
		const current = this.#listeners.get(name) ?? [];
		this.#listeners.set(
			name,
			current.filter((entry) => entry !== listener),
		);
	}

	dispatchEvent(event: any): boolean {
		for (const listener of this.#listeners.get(event.type) ?? []) {
			if (typeof listener === "function") {
				listener(event);
			} else {
				listener.handleEvent(event);
			}
		}

		return true;
	}
}

class MockElement extends MockHTMLElement {
	constructor(tagName: string) {
		super();
		this.tagName = tagName;
	}
}

function extractText(node: any): string {
	if (!node) {
		return "";
	}

	if (node.nodeType === 3) {
		return node.data ?? node.textContent ?? "";
	}

	return (node.childNodes ?? [])
		.map((child: any) => extractText(child))
		.join("");
}

const registry = new Map<string, any>();
const previousNode = Object.getOwnPropertyDescriptor(globalThis, "Node");
const previousElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
const previousHTMLElement = Object.getOwnPropertyDescriptor(
	globalThis,
	"HTMLElement",
);
const previousSVGElement = Object.getOwnPropertyDescriptor(
	globalThis,
	"SVGElement",
);
const previousDocument = Object.getOwnPropertyDescriptor(
	globalThis,
	"document",
);
const previousCustomElements = Object.getOwnPropertyDescriptor(
	globalThis,
	"customElements",
);

Object.defineProperty(globalThis, "Node", {
	configurable: true,
	value: MockNode,
});
Object.defineProperty(globalThis, "Element", {
	configurable: true,
	value: MockElement,
});
Object.defineProperty(globalThis, "HTMLElement", {
	configurable: true,
	value: MockHTMLElement,
});
Object.defineProperty(globalThis, "SVGElement", {
	configurable: true,
	value: MockElement,
});
Object.defineProperty(globalThis, "document", {
	configurable: true,
	value: {
		head: new MockElement("head"),
		documentElement: new MockElement("html"),
		createElement(tagName: string) {
			const Ctor = registry.get(tagName);
			if (Ctor) {
				return new Ctor();
			}
			return new MockElement(tagName);
		},
		createDocumentFragment() {
			return new MockDocumentFragment();
		},
		createTextNode(value: string) {
			return new MockText(value);
		},
		querySelector() {
			return null;
		},
	},
});
Object.defineProperty(globalThis, "customElements", {
	configurable: true,
	value: {
		define(name: string, ctor: any) {
			registry.set(name, ctor);
		},
		get(name: string) {
			return registry.get(name);
		},
	},
});

const { BaseComponent, Children, Component, Property, Slot, createNodeRef } =
	await import("../../src/core/index.ts");
const { Reactive } = await import("../../src/reactive/index.ts");
const { patchRender } = await import("../../src/core/patch.ts");
const { Attribute, Event: EventToken } = await import(
	"../../src/modifiers/index.ts"
);
const { Button, Div, Span, Text } = await import("../../src/html/index.ts");

@Component({ selector: "ustro-dom-hydration" })
class DomHydrationComponent extends BaseComponent {
	@Property()
	start = 0;

	@Reactive()
	tick = 0;

	@Children()
	content?: any;

	@Slot("footer")
	footer?: any;

	bump() {
		this.tick += 1;
	}

	protected override render() {
		return Div(
			Span(Text(`Start: ${this.start} Tick: ${this.tick}`)),
			this.content,
			this.footer,
		);
	}
}

void DomHydrationComponent;

test("custom elements hydrate attrs, children, and slots from light DOM", async () => {
	const HostCtor = customElements.get("ustro-dom-hydration") as new () => any;
	const host = new HostCtor() as any;
	host.setAttribute("start", "10");
	host.append(new MockText("App-level child content"));
	const footer = new MockElement("span") as any;
	footer.setAttribute("slot", "footer");
	footer.append(new MockText("Footer slot content"));
	host.append(footer);

	host.connectedCallback();
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(host.start).toBe(10);
	expect(extractText(host)).toContain("Start: 10 Tick: 0");
	expect(extractText(host.content)).toContain("App-level child content");
	expect(extractText(host.footer)).toContain("Footer slot content");

	host.bump();
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));

	expect(host.tick).toBe(1);
	expect(extractText(host)).toContain("Tick: 1");
	expect(extractText(host.content)).toContain("App-level child content");
	expect(extractText(host.footer)).toContain("Footer slot content");

	host.content = new MockText("Updated child content");
	host.footer = new MockText("Updated footer content");
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 10));
	await Promise.resolve();

	expect(host.content).toBeDefined();
	expect(host.footer).toBeDefined();
});

@Component({ selector: "ustro-dom-patch" })
class DomPatchComponent extends BaseComponent {
	@Property()
	label = "one";

	@Property()
	active = false;

	protected override render() {
		return Div(
			Attribute.class(this.active ? "active" : "idle"),
			Span(Text(this.label)),
		);
	}
}

test("granular DOM patch preserves element identity and updates text/attrs", async () => {
	const host = DomPatchComponent.create() as any;
	host.children = [];
	Object.defineProperty(host, "childNodes", {
		configurable: true,
		get: () => host.children,
	});
	host.append = (...nodes: any[]) => {
		for (const node of nodes) {
			node.parentNode = host;
			host.children.push(node);
		}
	};
	host.replaceChildren = (...nodes: any[]) => {
		for (const child of [...host.children]) {
			child.parentNode = null;
		}
		host.children = [];
		host.append(...nodes);
	};
	host.replaceChild = (newNode: any, oldNode: any) => {
		const index = host.children.indexOf(oldNode);
		if (index === -1) return;
		newNode.parentNode = host;
		oldNode.parentNode = null;
		host.children.splice(index, 1, newNode);
	};
	host.removeChild = (node: any) => {
		const index = host.children.indexOf(node);
		if (index === -1) return;
		node.parentNode = null;
		host.children.splice(index, 1);
	};
	host.connectedCallback();
	await Promise.resolve();
	await Promise.resolve();

	const root = host.children[0] as any;
	const labelSpan = root.childNodes[0] as any;
	const labelText = labelSpan.childNodes[0] as any;

	expect(root.getAttribute("class")).toBe("idle");
	expect(labelText.textContent).toBe("one");

	host.label = "two";
	host.active = true;
	await Promise.resolve();
	await Promise.resolve();

	expect(host.children[0]).toBe(root);
	expect(root.childNodes[0]).toBe(labelSpan);
	expect((labelSpan.childNodes[0] as any).textContent).toBe("two");
	expect(root.getAttribute("class")).toBe("active");
});

test("granular DOM patch reorders keyed children without replacing them", () => {
	const root = new MockElement("root") as any;
	const first = Span(Text("a")) as any;
	first.key = "a";
	const second = Span(Text("b")) as any;
	second.key = "b";

	patchRender(root, Div(first, second));
	const list = root.childNodes[0] as any;
	const initialFirst = list.childNodes[0] as any;
	const initialSecond = list.childNodes[1] as any;

	patchRender(root, Div(second, first));

	expect(list.childNodes[0]).toBe(initialSecond);
	expect(list.childNodes[1]).toBe(initialFirst);
	expect((list.childNodes[0] as any).childNodes[0].textContent).toBe("b");
	expect((list.childNodes[1] as any).childNodes[0].textContent).toBe("a");
});

test("granular DOM patch falls back without keys and handles mixed moves", () => {
	const root = new MockElement("root") as any;

	patchRender(root, Div(Span(Text("a")), Span(Text("b")), Span(Text("c"))));

	patchRender(
		root,
		Div(Span(Text("c")), Span(Text("x")), Span(Text("a")), Span(Text("d"))),
	);

	const list = root.childNodes[0] as any;
	expect(list.childNodes.length).toBe(4);
	expect(
		list.childNodes.map((node: any) => node.childNodes[0].textContent),
	).toEqual(["c", "x", "a", "d"]);
});

test("granular DOM patch fast-replaces large unkeyed child lists", () => {
	const root = new MockElement("root") as any;
	const initial = Array.from({ length: 300 }, (_, index) =>
		Span(Text(`a${index}`)),
	);

	patchRender(root, Div(...initial));

	const list = root.childNodes[0] as any;
	const previousReplaceChildren = list.replaceChildren;
	let replaceChildrenCalls = 0;
	list.replaceChildren = (...nodes: any[]) => {
		replaceChildrenCalls += 1;
		return previousReplaceChildren.apply(list, nodes);
	};

	const next = Array.from({ length: 300 }, (_, index) =>
		Span(Text(`b${index}`)),
	);

	patchRender(root, Div(...next));

	expect(replaceChildrenCalls).toBe(1);
	expect(list.childNodes.length).toBe(300);
	expect((list.childNodes[0] as any).childNodes[0].textContent).toBe("b0");
});

test("granular DOM patch updates swapped listeners in place", () => {
	const root = new MockElement("root") as any;
	const hits: string[] = [];
	const first = () => hits.push("first");
	const second = () => hits.push("second");

	patchRender(root, Button(EventToken.click(first), Text("save")));
	const button = root.childNodes[0] as any;
	button.dispatchEvent({ type: "click" });

	patchRender(root, Button(EventToken.click(second), Text("save")));
	button.dispatchEvent({ type: "click" });

	expect(hits).toEqual(["first", "second"]);
});

test("granular DOM patch keeps refs on moved nodes", () => {
	const root = new MockElement("root") as any;
	const ref = createNodeRef<any>();
	const first = Span(ref, Text("a")) as any;
	first.key = "a";
	const second = Span(Text("b")) as any;
	second.key = "b";

	patchRender(root, Div(first, second));
	const captured = ref.current;

	patchRender(root, Div(second, first));

	expect(ref.current).toBe(captured);
	expect((ref.current as any).childNodes[0].textContent).toBe("a");
});

afterAll(() => {
	if (previousNode) {
		Object.defineProperty(globalThis, "Node", previousNode);
	}
	if (previousElement) {
		Object.defineProperty(globalThis, "Element", previousElement);
	}
	if (previousHTMLElement) {
		Object.defineProperty(globalThis, "HTMLElement", previousHTMLElement);
	}
	if (previousSVGElement) {
		Object.defineProperty(globalThis, "SVGElement", previousSVGElement);
	}
	if (previousDocument) {
		Object.defineProperty(globalThis, "document", previousDocument);
	}
	if (previousCustomElements) {
		Object.defineProperty(globalThis, "customElements", previousCustomElements);
	}
});
