import { expect, test } from "vitest";
import {
	BaseComponent,
	Children,
	Component,
	Property,
	Slot,
	type ComponentChildren,
} from "../../src/core/index.ts";
import { Text } from "../../src/html/index.ts";

@Component({ selector: "camado-invoke-test" })
class InvocationTest extends BaseComponent {
	@Property({ optional: false })
	label = "default";

	@Children({ optional: false })
	content?: ComponentChildren;

	@Slot("footer", { optional: false })
	footer?: ComponentChildren;

	protected override render() {
		return null;
	}
}

test("Component invocation applies props, children, and slot fields", () => {
	const previousDocument = globalThis.document;

	const fragment = {
		nodes: [] as unknown[],
		append: (...nodes: unknown[]) => {
			fragment.nodes.push(...nodes);
		},
		cloneNode: () => ({
			nodes: [...fragment.nodes],
			append: (...nodes: unknown[]) => {
				fragment.nodes.push(...nodes);
			},
			cloneNode: () => fragment,
		}),
	};

	try {
		(globalThis as typeof globalThis & { document: Document }).document = {
			createElement(tagName: string) {
				const element = {
					tagName,
					appended: [] as unknown[],
					append: (...nodes: unknown[]) => {
						element.appended.push(...nodes);
					},
				};
				return element as unknown as HTMLElement;
			},
			createDocumentFragment() {
				return fragment as unknown as DocumentFragment;
			},
			createTextNode(value: string) {
				return { nodeValue: value } as unknown as Text;
			},
		} as unknown as Document;

		const invocation = InvocationTest.component();
		const element = invocation({
			label: "hello",
			children: Text("child"),
			footer: Text("slot"),
		});

		expect(element.label).toBe("hello");
		expect(element.content).toBeDefined();
		expect(element.footer).toBeDefined();

		const factory = InvocationTest.component();
		const elementFromFactory = factory({
			label: "factory",
			children: Text("child"),
			footer: Text("slot"),
		});

		expect(elementFromFactory.label).toBe("factory");
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});


test("Component invocation throws when required props or projected content are missing", () => {
	const previousDocument = globalThis.document;
	(globalThis as typeof globalThis & { document: Document }).document = {
		createElement(tagName: string) {
			return {
				tagName,
				append() {},
				replaceChildren() {},
			} as unknown as HTMLElement;
		},
		createDocumentFragment() {
			return { childNodes: [], append() {}, cloneNode: () => ({ childNodes: [] }) } as unknown as DocumentFragment;
		},
		createTextNode(value: string) {
			return { nodeType: 3, textContent: value } as unknown as Text;
		},
	} as unknown as Document;

	try {
		const invocation = InvocationTest.component();

		expect(() => invocation({} as any)).toThrow(
			'Camado property "label" is required for camado-invoke-test.',
		);
		expect(() =>
			invocation({ label: "ok" } as any),
		).toThrow(
			'Camado slot "footer" is required for camado-invoke-test.',
		);
		expect(() =>
			invocation({ label: "ok", footer: Text("slot") } as any),
		).toThrow(
			'Camado children "content" is required for camado-invoke-test.',
		);
		expect(() =>
			invocation({ label: "ok", children: Text("child") } as any),
		).toThrow(
			'Camado slot "footer" is required for camado-invoke-test.',
		);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});
