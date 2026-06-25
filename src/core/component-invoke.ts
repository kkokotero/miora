import {
	appendChildValue,
	createFragment,
	type ChildValue,
} from "./factories.ts";
import { getComponentMetadata } from "./metadata.ts";
import type { BaseComponent } from "./base-component.ts";
import type {
	ComponentChildren,
	ComponentConstructor,
	ComponentElement,
	ComponentInvocationOptions,
} from "./component-types.ts";

export function invokeComponent<TComponent extends BaseComponent>(
	component: ComponentConstructor<TComponent>,
	options: ComponentInvocationOptions<TComponent> = {},
): ComponentElement<TComponent> {
	const metadata = getComponentMetadata(component as Function);
	const selector = metadata?.selector ?? component.name;
	const doc = globalThis.document;

	if (!doc) {
		throw new Error(
			`Camado requires a DOM to invoke ${selector || component.name}`,
		);
	}

	const element = doc.createElement(
		selector || component.name,
	) as ComponentElement<TComponent>;

	const { children, ...directProps } = options;

	Object.assign(element as object, directProps);

	const childValues = toChildArray(children);
	if (childValues.length > 0) {
		applyChildren(element, metadata, childValues);
	}

	return element;
}

function applyChildren<TComponent extends BaseComponent>(
	element: TComponent,
	metadata: ReturnType<typeof getComponentMetadata>,
	children: readonly ChildValue[],
): void {
	const childrenKeys = metadata ? [...metadata.childrenKeys] : [];

	if (childrenKeys.length > 0) {
		const fragment = createFragment(...children);

		childrenKeys.forEach((key, index) => {
			(element as Record<string | symbol, unknown>)[key] =
				index === 0 ? fragment : fragment.cloneNode(true);
		});

		return;
	}

	appendChildValue(element as unknown as ParentNode, children);
}

function toChildArray(value?: ComponentChildren): readonly ChildValue[] {
	if (value === undefined) {
		return [];
	}

	return Array.isArray(value) ? value : [value];
}
