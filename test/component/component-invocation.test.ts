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

@Component({ selector: "ustro-invoke-test" })
class InvocationTest extends BaseComponent {
	@Property()
	label = "default";

	@Children()
	content?: ComponentChildren;

	@Slot("footer")
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
