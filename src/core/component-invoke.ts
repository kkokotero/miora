import {
	appendChildValue,
	createFragment,
	type ChildValue,
} from "./factories.ts";
import { getComponentMetadata } from "./metadata.ts";
import type { BaseComponent } from "./base-component.ts";
import { setComponentOutputCallbacks } from "./output-callbacks.ts";
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
	const childValues = toChildArray(children);
	const outputCallbacks: Record<string, (detail: unknown) => unknown> = {};

	validateRequiredInvocationInputs(
		metadata,
		directProps,
		childValues,
		selector || component.name,
	);

	for (const [key, value] of Object.entries(directProps)) {
		if (metadata?.events.has(key)) {
			if (typeof value === "function") {
				outputCallbacks[key] = value as (detail: unknown) => unknown;
			}
			continue;
		}

		(element as unknown as Record<string, unknown>)[key] = value;
	}

	setComponentOutputCallbacks(element, outputCallbacks);

	if (childValues.length > 0) {
		applyChildren(element, metadata, childValues);
	}

	return element;
}

function validateRequiredInvocationInputs(
	metadata: ReturnType<typeof getComponentMetadata>,
	directProps: Record<string, unknown>,
	childValues: readonly ChildValue[],
	componentName: string,
): void {
	if (!metadata) {
		return;
	}

	for (const key of metadata.propertyKeys) {
		if (typeof key !== "string") {
			continue;
		}

		if (!(key in directProps) || directProps[key] === undefined) {
			if (metadata.propertyRequiredKeys.has(key)) {
				throw new Error(
					`Camado property "${key}" is required for ${componentName}.`,
				);
			}
		}
	}

	for (const [key, slotName] of metadata.slotKeys) {
		if (!(key in directProps) || directProps[key as string] === undefined) {
			if (metadata.slotRequiredKeys.has(key)) {
				throw new Error(
					`Camado slot "${slotName}" is required for ${componentName}.`,
				);
			}
		}
	}

	if (metadata.childrenKeys.size > 0 && childValues.length === 0) {
		const requiredChild = [...metadata.childrenKeys].find((key) =>
			metadata.childrenRequiredKeys.has(key),
		);
		if (requiredChild !== undefined) {
			throw new Error(
				`Camado children "${String(requiredChild)}" is required for ${componentName}.`,
			);
		}
	}
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
