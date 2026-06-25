import {
	appendChildValue,
	createFragment,
	type ChildValue,
} from "./factories.ts";
import { getComponentMetadata } from "./metadata.ts";
import type { BaseComponent } from "./base-component.ts";
import type { ComponentConstructor } from "./component-types.ts";

const componentInstanceSymbol = Symbol("ustro.componentInstance");
const componentHostKeysSymbol = Symbol("ustro.componentHostKeys");
const componentHydratedSymbol = Symbol("ustro.componentHydrated");
const componentProjectedSymbol = Symbol("ustro.componentProjected");

export function isComponentHostElement(
	value: unknown,
): value is HTMLElement & { [componentInstanceSymbol]: BaseComponent } {
	return (
		typeof value === "object" &&
		value !== null &&
		componentInstanceSymbol in value
	);
}

export function getComponentHostKeys(
	value: unknown,
): Array<string | symbol> | undefined {
	if (!isComponentHostElement(value)) {
		return undefined;
	}

	return Reflect.get(value, componentHostKeysSymbol) as
		| Array<string | symbol>
		| undefined;
}

export function isComponentHostHydrated(value: unknown): boolean {
	return (
		isComponentHostElement(value) &&
		Reflect.get(value, componentHydratedSymbol) === true
	);
}

export function isComponentHostProjected(value: unknown): boolean {
	return (
		isComponentHostElement(value) &&
		Reflect.get(value, componentProjectedSymbol) === true
	);
}

class FallbackHostElement {
	#listeners = new Map<string, Array<(event: Event) => void>>();
	children: unknown[] = [];

	addEventListener(type: string, listener: (event: Event) => void): void {
		const current = this.#listeners.get(type) ?? [];
		current.push(listener);
		this.#listeners.set(type, current);
	}

	removeEventListener(type: string, listener: (event: Event) => void): void {
		const current = this.#listeners.get(type);
		if (!current) {
			return;
		}

		this.#listeners.set(
			type,
			current.filter((entry) => entry !== listener),
		);
	}

	dispatchEvent(event: Event): boolean {
		for (const listener of this.#listeners.get(event.type) ?? []) {
			listener(event);
		}

		return true;
	}

	replaceChildren(...nodes: Array<Node | string>): void {
		this.children = [...nodes];
	}

	append(...nodes: Array<Node | string>): void {
		this.children.push(...nodes);
	}

	insertBefore(node: Node | string, anchor: Node | string | null): void {
		if (anchor === null) {
			this.children.push(node);
			return;
		}

		const index = this.children.indexOf(anchor);
		if (index === -1) {
			this.children.push(node);
			return;
		}

		this.children.splice(index, 0, node);
	}
}

function getHostElementBase(): typeof HTMLElement | typeof FallbackHostElement {
	return globalThis.HTMLElement ?? FallbackHostElement;
}

type ComponentHostInstance<TComponent extends BaseComponent> = HTMLElement & {
	[componentInstanceSymbol]: TComponent;
};

function collectHostKeys(
	metadata: ReturnType<typeof getComponentMetadata>,
): Array<string | symbol> {
	if (!metadata) {
		return [];
	}

	return [
		...metadata.propertyKeys,
		...metadata.reactiveKeys,
		...metadata.childrenKeys,
		...metadata.slotKeys.keys(),
	];
}

function hydrateHostFromLightDom<TComponent extends BaseComponent>(
	host: ComponentHostInstance<TComponent>,
	instance: TComponent,
	metadata: NonNullable<ReturnType<typeof getComponentMetadata>>,
): boolean {
	if (
		metadata.propertyKeys.size === 0 &&
		metadata.childrenKeys.size === 0 &&
		metadata.slotKeys.size === 0
	) {
		return false;
	}

	const childNodes = (host as { childNodes?: ArrayLike<Node> | null })
		.childNodes;
	const hasChildren = !!childNodes && childNodes.length > 0;
	const hasAttributes =
		typeof host.hasAttributes === "function" ? host.hasAttributes() : true;

	if (!hasChildren && !hasAttributes) {
		return false;
	}

	let hydrated = false;
	if (metadata.propertyKeys.size > 0 && hasAttributes) {
		hydrated = hydratePropsFromAttributes(host, instance, metadata) || hydrated;
	}

	if (
		hasChildren &&
		(metadata.childrenKeys.size > 0 || metadata.slotKeys.size > 0)
	) {
		hydrated =
			hydrateChildrenFromLightDom(host, instance, metadata) || hydrated;
	}

	return hydrated;
}

function hydratePropsFromAttributes<TComponent extends BaseComponent>(
	host: ComponentHostInstance<TComponent>,
	instance: TComponent,
	metadata: NonNullable<ReturnType<typeof getComponentMetadata>>,
): boolean {
	let hydrated = false;
	for (const key of metadata.propertyKeys) {
		if (typeof key !== "string") {
			continue;
		}

		const raw = readAttributeForKey(host, key);
		if (raw === undefined) {
			continue;
		}

		const current = instance[key as keyof TComponent];
		instance[key as keyof TComponent] = coerceHydratedValue(
			current,
			raw,
		) as TComponent[keyof TComponent];
		hydrated = true;
	}

	return hydrated;
}

function hydrateChildrenFromLightDom<TComponent extends BaseComponent>(
	host: ComponentHostInstance<TComponent>,
	instance: TComponent,
	metadata: NonNullable<ReturnType<typeof getComponentMetadata>>,
): boolean {
	const childNodes = (host as { childNodes?: ArrayLike<Node> | null })
		.childNodes;
	if (!childNodes || childNodes.length === 0) {
		return false;
	}

	const children = Array.from(childNodes);

	const slotEntries = [...metadata.slotKeys.entries()];
	const slotNames = new Set(metadata.slotKeys.values());
	const slotBuckets = new Map<string, Node[]>();
	const remainingNodes: Node[] = [];

	for (const node of children) {
		const slotName = getLightDomSlotName(node);
		if (slotName !== null && slotNames.has(slotName)) {
			const bucket = slotBuckets.get(slotName) ?? [];
			bucket.push(node);
			slotBuckets.set(slotName, bucket);
			continue;
		}

		remainingNodes.push(node);
	}

	for (const [key, slotName] of slotEntries) {
		const nodes = slotBuckets.get(slotName);
		if (!nodes || nodes.length === 0) {
			continue;
		}

		defineFragmentBackedField(instance, key, createFragment(...nodes), () =>
			instance.__requestUpdate(),
		);
	}

	const childKeys = [...metadata.childrenKeys];
	if (childKeys.length === 0) {
		return slotEntries.length > 0;
	}

	const fragment = createFragment(...remainingNodes);
	for (const key of childKeys) {
		defineFragmentBackedField(instance, key, fragment, () =>
			instance.__requestUpdate(),
		);
	}

	return slotEntries.length > 0 || childKeys.length > 0;
}

export function defineFragmentBackedField<TComponent extends BaseComponent>(
	instance: TComponent,
	key: string | symbol,
	fragment: DocumentFragment,
	onChange?: () => void,
): void {
	let current = collectFragmentBackingValues(fragment);

	Object.defineProperty(instance, key, {
		configurable: true,
		enumerable: true,
		get: () => {
			const fragment = createFragment();
			for (const child of current) {
				appendChildValue(fragment, cloneChildValue(child));
			}
			return fragment;
		},
		set: (next: unknown) => {
			current = collectFragmentBackingValues(next);
			onChange?.();
		},
	});
}

function collectFragmentBackingValues(
	value: unknown,
	result: ChildValue[] = [],
): ChildValue[] {
	if (value === undefined || value === null) {
		return result;
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			collectFragmentBackingValues(entry, result);
		}
		return result;
	}

	if (isFragmentNode(value)) {
		for (let index = 0; index < value.childNodes.length; index += 1) {
			collectFragmentBackingValues(value.childNodes[index], result);
		}
		return result;
	}

	result.push(value as ChildValue);
	return result;
}

function cloneChildValue(value: ChildValue): ChildValue {
	if (Array.isArray(value)) {
		return value.map((entry) => cloneChildValue(entry));
	}

	if (isNodeValue(value)) {
		return cloneNodeLike(value);
	}

	return value;
}

function cloneNodeLike(node: Node): Node {
	if (typeof node.cloneNode === "function") {
		return node.cloneNode(true);
	}

	if (node.nodeType === 3) {
		return document.createTextNode(node.textContent ?? "");
	}

	return node;
}

function isFragmentNode(value: unknown): value is DocumentFragment {
	return (
		typeof value === "object" &&
		value !== null &&
		"nodeType" in value &&
		(value as Node).nodeType === 11
	);
}

function isNodeValue(value: unknown): value is Node {
	return typeof value === "object" && value !== null && "nodeType" in value;
}

function readAttributeForKey(
	host: HTMLElement,
	key: string,
): string | undefined {
	const candidates = [key, toKebabCase(key)];

	for (const candidate of candidates) {
		if (
			typeof host.hasAttribute === "function" &&
			host.hasAttribute(candidate)
		) {
			return host.getAttribute(candidate) ?? "";
		}

		const value = host.getAttribute?.(candidate);
		if (value !== null && value !== undefined) {
			return value;
		}
	}

	return undefined;
}

function coerceHydratedValue(current: unknown, raw: string): unknown {
	if (typeof current === "boolean") {
		return raw === "" || raw === "true" || raw === "1";
	}

	if (typeof current === "number") {
		const value = Number(raw);
		return Number.isNaN(value) ? current : value;
	}

	if (typeof current === "bigint") {
		try {
			return BigInt(raw);
		} catch {
			return current;
		}
	}

	return raw;
}

function getLightDomSlotName(node: Node): string | null {
	if (node.nodeType !== 1) {
		return null;
	}

	return (node as Element).getAttribute("slot");
}

function toKebabCase(value: string): string {
	return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

export function defineComponentHost<TComponent extends BaseComponent>(
	component: ComponentConstructor<TComponent>,
	selector: string,
): void {
	const customElementsApi = globalThis.customElements;

	if (!customElementsApi || customElementsApi.get(selector)) {
		return;
	}

	const metadata = getComponentMetadata(component as Function);
	const hostKeys = collectHostKeys(metadata);
	const HostElementBase = getHostElementBase();

	class UstroComponentHost extends HostElementBase {
		declare [componentInstanceSymbol]: TComponent;

		constructor() {
			super();

			const instance = new (component as new () => TComponent)();
			this[componentInstanceSymbol] = instance;
			Reflect.set(this, componentHostKeysSymbol, hostKeys);
			Reflect.set(
				this,
				componentProjectedSymbol,
				Boolean(
					metadata &&
						(metadata.childrenKeys.size > 0 || metadata.slotKeys.size > 0),
				),
			);
			instance.__attachHost(this as unknown as HTMLElement);

			for (const key of Reflect.ownKeys(instance)) {
				Object.defineProperty(this, key, {
					configurable: true,
					enumerable: true,
					get: () => instance[key as keyof TComponent],
					set: (next: unknown) => {
						if (
							metadata &&
							(typeof key === "string" || typeof key === "symbol") &&
							(metadata.childrenKeys.has(key) || metadata.slotKeys.has(key))
						) {
							defineFragmentBackedField(
								instance,
								key,
								createFragment(...collectFragmentBackingValues(next)),
							);
							return;
						}

						instance[key as keyof TComponent] =
							next as TComponent[keyof TComponent];
					},
				});
			}
		}

		connectedCallback(): void {
			if (!Reflect.get(this, componentHydratedSymbol) && metadata) {
				const hydrated = hydrateHostFromLightDom(
					this as unknown as ComponentHostInstance<TComponent>,
					this[componentInstanceSymbol],
					metadata,
				);

				Reflect.set(this, componentHydratedSymbol, hydrated);

				if (hydrated) {
					this[componentInstanceSymbol].__markHydrated();
				}
			}

			this[componentInstanceSymbol].__connect();
		}

		disconnectedCallback(): void {
			this[componentInstanceSymbol].__disconnect();
		}
	}

	for (const key of hostKeys) {
		Object.defineProperty(UstroComponentHost.prototype, key, {
			configurable: true,
			enumerable: true,
			get(this: ComponentHostInstance<TComponent>) {
				return this[componentInstanceSymbol][key as keyof TComponent];
			},
			set(this: ComponentHostInstance<TComponent>, next: unknown) {
				this[componentInstanceSymbol][key as keyof TComponent] =
					next as TComponent[keyof TComponent];
			},
		});
	}

	const prototype = component.prototype as Record<string | symbol, unknown>;

	for (const key of Reflect.ownKeys(prototype)) {
		if (key === "constructor") {
			continue;
		}

		const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
		if (!descriptor || typeof descriptor.value !== "function") {
			continue;
		}

		Object.defineProperty(UstroComponentHost.prototype, key, {
			configurable: true,
			writable: true,
			value(this: ComponentHostInstance<TComponent>, ...args: unknown[]) {
				const instance = this[componentInstanceSymbol] as unknown as Record<
					string | symbol,
					(...callArgs: unknown[]) => unknown
				>;
				const method = instance[key];

				if (typeof method !== "function") {
					return undefined;
				}

				return method.apply(instance, args);
			},
		});
	}

	customElementsApi.define(
		selector,
		UstroComponentHost as unknown as CustomElementConstructor,
	);
}
