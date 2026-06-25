import { expect, test } from "vitest";
import { Navigator } from "../../src/navigator/index.ts";

class MockNode {
	childNodes: any[] = [];
	parentNode: any = null;
	append(...nodes: any[]): void {
		for (const node of nodes) {
			if (typeof node === "string") {
				this.append(new MockText(node));
				continue;
			}

			node.parentNode = this;
			this.childNodes.push(node);
		}
	}
}

class MockText extends MockNode {
	nodeType = 3 as const;
	constructor(public data: string) {
		super();
	}
	get textContent(): string {
		return this.data;
	}
	set textContent(value: string) {
		this.data = value;
	}
}

class MockElement extends MockNode {
	nodeType = 1 as const;
	tagName: string;
	#attributes = new Map<string, string>();
	constructor(tagName: string) {
		super();
		this.tagName = tagName.toUpperCase();
	}
	setAttribute(name: string, value: string): void {
		this.#attributes.set(name, value);
	}
	getAttribute(name: string): string | null {
		return this.#attributes.get(name) ?? null;
	}
	removeAttribute(name: string): void {
		this.#attributes.delete(name);
	}
	get textContent(): string {
		return this.childNodes.map((node) => node.textContent ?? "").join("");
	}
	set textContent(value: string) {
		this.childNodes = [new MockText(value)];
	}
}

class MockHead extends MockElement {
	constructor() {
		super("head");
	}
}

function createDoc() {
	const head = new MockHead();
	const doc: any = {
		head,
		documentElement: head,
		title: "",
		createElement(tagName: string) {
			return new MockElement(tagName);
		},
	};
	return { doc, head };
}

test("Navigator.seo updates title, icon, metas, and links idempotently", () => {
	const previousDocument = globalThis.document;
	const { doc, head } = createDoc();
	(globalThis as any).document = doc;

	try {
		Navigator.seo.page({
			title: "Camado App",
			icon: "/favicon.svg",
			description: "Fast UI library",
			canonical: "https://example.com",
			metas: [{ property: "og:title", content: "Camado App" }],
			links: [{ rel: "preload", href: "/fonts/inter.woff2", as: "font" }],
		});

		Navigator.seo.page({
			title: "Camado App",
			icon: "/favicon.svg",
			description: "Fast UI library",
			canonical: "https://example.com",
			metas: [{ property: "og:title", content: "Camado App" }],
			links: [{ rel: "preload", href: "/fonts/inter.woff2", as: "font" }],
		});

		expect(doc.title).toBe("Camado App");
		expect(
			head.childNodes.filter((node: any) => node.tagName === "TITLE"),
		).toHaveLength(1);
		expect(
			head.childNodes.filter((node: any) => node.tagName === "LINK"),
		).toHaveLength(3);
		expect(
			head.childNodes.filter((node: any) => node.tagName === "META"),
		).toHaveLength(2);
		expect(
			(
				head.childNodes.find(
					(node: any) =>
						node.tagName === "LINK" && node.getAttribute("rel") === "icon",
				) as any
			).getAttribute("href"),
		).toBe("/favicon.svg");
		expect(
			(
				head.childNodes.find(
					(node: any) =>
						node.tagName === "META" &&
						node.getAttribute("property") === "og:title",
				) as any
			).getAttribute("content"),
		).toBe("Camado App");
	} finally {
		(globalThis as any).document = previousDocument;
	}
});
