import {
	appendChildValue,
	createFragment,
	type ChildValue,
} from "./factories.ts";
import { getComponentMetadata } from "./metadata.ts";
import type { BaseComponent } from "./base-component.ts";
import type { ComponentConstructor } from "./component-types.ts";

const componentInstanceSymbol = Symbol.for("camado.componentInstance");
const componentHostKeysSymbol = Symbol.for("camado.componentHostKeys");
const componentHydratedSymbol = Symbol.for("camado.componentHydrated");
const componentProjectedSymbol = Symbol.for("camado.componentProjected");

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
		for (const child of this.children) {
			if (typeof child === "object" && child !== null) {
				Reflect.set(
					child as unknown as Record<string | symbol, unknown>,
					"parentNode",
					null,
				);
				Reflect.set(
					child as unknown as Record<string | symbol, unknown>,
					"parentElement",
					null,
				);
			}
		}

		this.children = [];
		this.append(...nodes);
	}

	append(...nodes: Array<Node | string>): void {
		for (const node of nodes) {
			if (typeof node === "object" && node !== null) {
				Reflect.set(
					node as unknown as Record<string | symbol, unknown>,
					"parentNode",
					this,
				);
				Reflect.set(
					node as unknown as Record<string | symbol, unknown>,
					"parentElement",
					this,
				);
			}
			this.children.push(node);
		}
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

		if (typeof node === "object" && node !== null) {
			Reflect.set(
				node as unknown as Record<string | symbol, unknown>,
				"parentNode",
				this,
			);
			Reflect.set(
				node as unknown as Record<string | symbol, unknown>,
				"parentElement",
				this,
			);
		}
		this.children.splice(index, 0, node);
	}

	querySelector(selector: string): unknown {
		return queryAll(this, selector, true)[0] ?? null;
	}

	querySelectorAll(selector: string): unknown[] {
		return queryAll(this, selector, false);
	}

	closest(selector: string): unknown {
		let current: unknown = this;
		while (current) {
			if (matchesSelector(current, selector)) {
				return current;
			}

			current =
				Reflect.get(
					current as unknown as Record<string | symbol, unknown>,
					"parentElement",
				) ??
				Reflect.get(
					current as unknown as Record<string | symbol, unknown>,
					"parentNode",
				);
		}

		return null;
	}

	matches(selector: string): boolean {
		return matchesSelector(this, selector);
	}
}

function queryAll(
	root: unknown,
	selector: string,
	firstOnly: boolean,
): unknown[] {
	const result: unknown[] = [];
	const visit = (node: unknown): boolean => {
		if (matchesSelector(node, selector)) {
			result.push(node);
			if (firstOnly) {
				return true;
			}
		}

		for (const child of getChildren(node)) {
			if (visit(child) && firstOnly) {
				return true;
			}
		}

		return false;
	};

	visit(root);
	return result;
}

function getChildren(value: unknown): unknown[] {
	if (!value || typeof value !== "object") {
		return [];
	}

	const children = Reflect.get(
		value as unknown as Record<string | symbol, unknown>,
		"children",
	);
	if (Array.isArray(children)) {
		return children;
	}

	const childNodes = Reflect.get(
		value as unknown as Record<string | symbol, unknown>,
		"childNodes",
	);
	if (Array.isArray(childNodes)) {
		return childNodes;
	}

	return [];
}

function matchesSelector(value: unknown, selector: string): boolean {
	if (!value || typeof value !== "object") {
		return false;
	}

	const trimmed = selector.trim();
	if (!trimmed) {
		return false;
	}

	if (trimmed.startsWith("#")) {
		return getAttribute(value, "id") === trimmed.slice(1);
	}

	if (trimmed.startsWith(".")) {
		return hasClass(value, trimmed.slice(1));
	}

	return getTagName(value) === trimmed.toUpperCase();
}

function getTagName(value: unknown): string | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const tagName = Reflect.get(
		value as unknown as Record<string | symbol, unknown>,
		"tagName",
	);
	return typeof tagName === "string" ? tagName.toUpperCase() : undefined;
}

function getAttribute(value: unknown, name: string): string | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const getter = Reflect.get(
		value as unknown as Record<string | symbol, unknown>,
		"getAttribute",
	);
	if (typeof getter === "function") {
		return getter.call(value, name) as string | null;
	}

	const direct = Reflect.get(
		value as unknown as Record<string | symbol, unknown>,
		name,
	);
	return typeof direct === "string" ? direct : null;
}

function hasClass(value: unknown, className: string): boolean {
	if (!value || typeof value !== "object") {
		return false;
	}

	const classList = Reflect.get(
		value as unknown as Record<string | symbol, unknown>,
		"classList",
	);
	if (classList && typeof classList === "object") {
		const contains = Reflect.get(
			classList as unknown as Record<string | symbol, unknown>,
			"contains",
		);
		if (typeof contains === "function") {
			return Boolean(contains.call(classList, className));
		}

		const values = Reflect.get(
			classList as unknown as Record<string | symbol, unknown>,
			"values",
		);
		if (Array.isArray(values)) {
			return values.includes(className);
		}
	}

	const classAttr =
		getAttribute(value, "class") ?? getAttribute(value, "className");
	return (
		typeof classAttr === "string" && classAttr.split(/\s+/).includes(className)
	);
}

function getHostElementBase(): typeof HTMLElement | typeof FallbackHostElement {
	return globalThis.HTMLElement ?? FallbackHostElement;
}

type ComponentHostInstance<TComponent extends BaseComponent> = HTMLElement & {
	[componentInstanceSymbol]: TComponent;
};

function collectHostKeys(ctor: Function): Array<string | symbol> {
	const keys = new Set<string | symbol>();
	let current: Function | undefined = ctor;

	while (current && current !== Object) {
		const metadata = getComponentMetadata(current);
		if (metadata) {
			for (const key of metadata.propertyKeys) keys.add(key);
			for (const key of metadata.reactiveKeys) keys.add(key);
			for (const key of metadata.childrenKeys) keys.add(key);
			for (const key of metadata.hostKeys) keys.add(key);
			for (const key of metadata.queryKeys.keys()) keys.add(key);
			for (const key of metadata.slotKeys.keys()) keys.add(key);
			for (const key of metadata.binders.keys()) keys.add(key);
		}

		const parent = Object.getPrototypeOf(current.prototype)?.constructor;
		if (!parent || parent === current || parent === Object) {
			break;
		}
		current = parent as Function;
	}

	return [...keys];
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

	let hydrated = false;
	if (metadata.propertyKeys.size > 0) {
		hydrated = hydratePropsFromAttributes(host, instance, metadata) || hydrated;
	}

	if (metadata.childrenKeys.size > 0 || metadata.slotKeys.size > 0) {
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
			if (metadata.propertyRequiredKeys.has(key)) {
				throw new Error(
					`Camado property "${key}" is required for ${describeComponent(metadata, instance)}.`,
				);
			}
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
	const children = childNodes ? Array.from(childNodes) : [];

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

	const missingRequired: string[] = [];
	for (const [key, slotName] of slotEntries) {
		const nodes = slotBuckets.get(slotName);
		if (!nodes || nodes.length === 0) {
			if (metadata.slotRequiredKeys.has(key)) {
				missingRequired.push(`slot "${slotName}"`);
			}
			continue;
		}

		if (!hasFragmentBackedField(instance, key)) {
			defineFragmentBackedField(instance, key, createFragment(...nodes), () =>
				instance.__requestUpdate(),
			);
		}
	}

	const childKeys = [...metadata.childrenKeys];
	if (childKeys.length === 0) {
		if (missingRequired.length > 0) {
			throw new Error(
				`Camado ${missingRequired.join(" and ")} is required for ${describeComponent(metadata, instance)}.`,
			);
		}
		return slotEntries.length > 0;
	}

	if (remainingNodes.length === 0) {
		for (const key of childKeys) {
			if (metadata.childrenRequiredKeys.has(key)) {
				missingRequired.push(`children "${String(key)}"`);
			}
		}
		if (missingRequired.length > 0) {
			throw new Error(
				`Camado ${missingRequired.join(" and ")} is required for ${describeComponent(metadata, instance)}.`,
			);
		}
		return slotEntries.length > 0;
	}

	const fragment = createFragment(...remainingNodes);
	for (const key of childKeys) {
		if (hasFragmentBackedField(instance, key)) {
			continue;
		}
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

function hasFragmentBackedField(
	instance: object,
	key: string | symbol,
): boolean {
	const descriptor = Object.getOwnPropertyDescriptor(instance, key);
	return Boolean(
		descriptor &&
			typeof descriptor.get === "function" &&
			typeof descriptor.set === "function",
	);
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
	if (isComponentHostElement(value)) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => cloneChildValue(entry));
	}

	if (isFragmentNode(value)) {
		const fragment = document.createDocumentFragment();
		for (let index = 0; index < value.childNodes.length; index += 1) {
			appendChildValue(fragment, cloneChildValue(value.childNodes[index]));
		}
		return fragment;
	}

	if (isNodeValue(value)) {
		if (isPreservedCustomElement(value)) {
			return value;
		}

		if (value.nodeType === 3) {
			return document.createTextNode(value.textContent ?? "");
		}

		if (typeof value.cloneNode === "function") {
			return value.cloneNode(true);
		}
	}

	return value;
}

function isPreservedCustomElement(node: Node): boolean {
	if (node.nodeType !== 1) {
		return false;
	}

	if (!isComponentHostElement(node)) {
		if (typeof customElements === "undefined") {
			return false;
		}

		return (
			customElements.get((node as Element).tagName.toLowerCase()) !== undefined
		);
	}

	const instance = Reflect.get(
		node as unknown as Record<string | symbol, unknown>,
		componentInstanceSymbol,
	) as BaseComponent | undefined;
	const hostElement = Reflect.get(
		instance as unknown as object,
		"hostElement",
	) as HTMLElement | undefined;

	return hostElement === node;
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

function describeComponent(
	metadata: NonNullable<ReturnType<typeof getComponentMetadata>>,
	instance: object,
): string {
	return metadata.selector ?? (instance.constructor as Function).name;
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
	const hostKeys = collectHostKeys(component as Function);
	const HostElementBase = getHostElementBase();

	class CamadoComponentHost extends HostElementBase {
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

						Reflect.set(
							instance as Record<string | symbol, unknown>,
							key,
							next,
						);
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
		Object.defineProperty(CamadoComponentHost.prototype, key, {
			configurable: true,
			enumerable: true,
			get(this: ComponentHostInstance<TComponent>) {
				return this[componentInstanceSymbol][key as keyof TComponent];
			},
			set(this: ComponentHostInstance<TComponent>, next: unknown) {
				Reflect.set(
					this[componentInstanceSymbol] as Record<string | symbol, unknown>,
					key,
					next,
				);
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

		Object.defineProperty(CamadoComponentHost.prototype, key, {
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
		CamadoComponentHost as unknown as CustomElementConstructor,
	);
}
