import type { BinderConstructor } from "./binder.ts";

export type ComponentSelector = string;
export type ComponentFieldKey = string | symbol;

export interface ComponentMetadata {
	selector?: ComponentSelector;
	reactiveKeys: Set<ComponentFieldKey>;
	reactivePersistentKeys: Set<ComponentFieldKey>;
	reactiveInitializers: Map<ComponentFieldKey, string>;
	inputKeys: Set<ComponentFieldKey>;
	propertyKeys: Set<ComponentFieldKey>;
	propertyOptionalKeys: Set<ComponentFieldKey>;
	childrenKeys: Set<ComponentFieldKey>;
	childrenOptionalKeys: Set<ComponentFieldKey>;
	slotKeys: Map<ComponentFieldKey, string>;
	slotOptionalKeys: Set<ComponentFieldKey>;
	watchers: Map<ComponentFieldKey, Set<ComponentFieldKey>>;
	events: Map<ComponentFieldKey, string>;
	binders: Map<ComponentFieldKey, BinderConstructor<any>>;
	mountHooks: Set<ComponentFieldKey>;
	destroyHooks: Set<ComponentFieldKey>;
	delayHooks: Map<ComponentFieldKey, number>;
	intervalHooks: Map<ComponentFieldKey, number>;
}

export type FieldChangeObserver = (
	key: ComponentFieldKey,
	next: unknown,
	previous: unknown,
) => void;

const componentMetadataByConstructor = new WeakMap<
	Function,
	ComponentMetadata
>();

function createComponentMetadata(): ComponentMetadata {
	return {
		reactiveKeys: new Set<ComponentFieldKey>(),
		reactivePersistentKeys: new Set<ComponentFieldKey>(),
		reactiveInitializers: new Map<ComponentFieldKey, string>(),
		inputKeys: new Set<ComponentFieldKey>(),
		propertyKeys: new Set<ComponentFieldKey>(),
		propertyOptionalKeys: new Set<ComponentFieldKey>(),
		childrenKeys: new Set<ComponentFieldKey>(),
		childrenOptionalKeys: new Set<ComponentFieldKey>(),
		slotKeys: new Map<ComponentFieldKey, string>(),
		slotOptionalKeys: new Set<ComponentFieldKey>(),
		watchers: new Map<ComponentFieldKey, Set<ComponentFieldKey>>(),
		events: new Map<ComponentFieldKey, string>(),
		binders: new Map<ComponentFieldKey, BinderConstructor<any>>(),
		mountHooks: new Set<ComponentFieldKey>(),
		destroyHooks: new Set<ComponentFieldKey>(),
		delayHooks: new Map<ComponentFieldKey, number>(),
		intervalHooks: new Map<ComponentFieldKey, number>(),
	};
}

export function getComponentMetadata(
	ctor: Function,
): ComponentMetadata | undefined {
	return componentMetadataByConstructor.get(ctor);
}

export function getOrCreateComponentMetadata(
	ctor: Function,
): ComponentMetadata {
	const current = componentMetadataByConstructor.get(ctor);

	if (current) {
		return current;
	}

	const created = createComponentMetadata();
	componentMetadataByConstructor.set(ctor, created);
	return created;
}

export function setComponentSelector(ctor: Function, selector: string): void {
	getOrCreateComponentMetadata(ctor).selector = selector;
}

export interface ReactiveFieldOptions {
	persistent?: boolean;
}

export function markReactiveField(
	target: object,
	key: ComponentFieldKey,
	options: ReactiveFieldOptions = {},
): void {
	const metadata = getOrCreateComponentMetadata(target.constructor as Function);
	metadata.reactiveKeys.add(key);
	if (options.persistent) {
		metadata.reactivePersistentKeys.add(key);
	}
	const initializer = getFieldInitializerSource(
		target.constructor as Function,
		key,
	);
	if (initializer) {
		metadata.reactiveInitializers.set(key, initializer);
	}
}

export interface InputFieldOptions {
	optional?: boolean;
}

export function markInputField(
	target: object,
	key: ComponentFieldKey,
	options: InputFieldOptions = {},
): void {
	const metadata = getOrCreateComponentMetadata(target.constructor as Function);
	metadata.inputKeys.add(key);
	if (options.optional) {
		metadata.propertyOptionalKeys.add(key);
	}
}

export interface PropertyFieldOptions {
	optional?: boolean;
}

export function markPropertyField(
	target: object,
	key: ComponentFieldKey,
	options: PropertyFieldOptions = {},
): void {
	const metadata = getOrCreateComponentMetadata(target.constructor as Function);
	metadata.propertyKeys.add(key);
	if (options.optional) {
		metadata.propertyOptionalKeys.add(key);
	}
}

export interface ChildrenFieldOptions {
	optional?: boolean;
}

export function markChildrenField(
	target: object,
	key: ComponentFieldKey,
	options: ChildrenFieldOptions = {},
): void {
	const metadata = getOrCreateComponentMetadata(target.constructor as Function);
	metadata.childrenKeys.add(key);
	if (options.optional) {
		metadata.childrenOptionalKeys.add(key);
	}
}

export interface SlotFieldOptions {
	optional?: boolean;
}

export function markSlotField(
	target: object,
	key: ComponentFieldKey,
	name: string,
	options: SlotFieldOptions = {},
): void {
	const metadata = getOrCreateComponentMetadata(target.constructor as Function);
	metadata.slotKeys.set(key, name);
	if (options.optional) {
		metadata.slotOptionalKeys.add(key);
	}
}

export function markWatch(
	target: object,
	sourceKey: ComponentFieldKey,
	methodKey: ComponentFieldKey,
): void {
	const metadata = getOrCreateComponentMetadata(target.constructor as Function);
	const watchers =
		metadata.watchers.get(sourceKey) ?? new Set<ComponentFieldKey>();
	watchers.add(methodKey);
	metadata.watchers.set(sourceKey, watchers);
}

export function markEvent(
	target: object,
	methodKey: ComponentFieldKey,
	eventName: string,
): void {
	getOrCreateComponentMetadata(target.constructor as Function).events.set(
		methodKey,
		eventName,
	);
}

export function markBinder(
	target: object,
	key: ComponentFieldKey,
	binder: BinderConstructor<any>,
): void {
	getOrCreateComponentMetadata(target.constructor as Function).binders.set(
		key,
		binder,
	);
}

export function markMountHook(
	target: object,
	methodKey: ComponentFieldKey,
): void {
	getOrCreateComponentMetadata(target.constructor as Function).mountHooks.add(
		methodKey,
	);
}

export function markDestroyHook(
	target: object,
	methodKey: ComponentFieldKey,
): void {
	getOrCreateComponentMetadata(target.constructor as Function).destroyHooks.add(
		methodKey,
	);
}

export function markDelayHook(
	target: object,
	methodKey: ComponentFieldKey,
	delayMs: number,
): void {
	getOrCreateComponentMetadata(target.constructor as Function).delayHooks.set(
		methodKey,
		delayMs,
	);
}

export function markIntervalHook(
	target: object,
	methodKey: ComponentFieldKey,
	intervalMs: number,
): void {
	getOrCreateComponentMetadata(
		target.constructor as Function,
	).intervalHooks.set(methodKey, intervalMs);
}

export function installTrackedFields(
	instance: Record<string | symbol, unknown>,
	onChange: FieldChangeObserver,
): void {
	const metadata = getComponentMetadata(instance.constructor as Function);

	if (
		!metadata ||
		(metadata.reactiveKeys.size === 0 && metadata.propertyKeys.size === 0)
	) {
		return;
	}

	const persistentKeys = metadata.reactivePersistentKeys;
	const initializers = metadata.reactiveInitializers;
	const storagePrefix = getPersistentStoragePrefix(
		metadata,
		instance.constructor as Function,
	);

	const installField = (key: ComponentFieldKey): void => {
		const persistent = persistentKeys.has(key);
		const existing = Object.getOwnPropertyDescriptor(instance, key);
		let value =
			existing && "value" in existing
				? existing.value
				: Reflect.get(instance, key);

		if (persistent) {
			const stored = readStoredFieldValue(storagePrefix, key);
			if (stored !== undefined) {
				value = stored;
			}
		} else {
			const initializer = initializers.get(key);
			if (initializer) {
				const derived = evaluateInitializer(instance, initializer);
				if (derived !== undefined) {
					value = derived;
				}
			}
		}

		Reflect.deleteProperty(instance, key);

		Object.defineProperty(instance, key, {
			configurable: true,
			enumerable: true,
			get() {
				return value;
			},
			set(next: unknown) {
				const previous = value;

				if (Object.is(previous, next)) {
					return;
				}

				value = next;
				if (persistent) {
					writeStoredFieldValue(storagePrefix, key, next);
				}
				onChange(key, next, previous);
			},
		});

		if (persistent) {
			writeStoredFieldValue(storagePrefix, key, value);
		}
	};

	for (const key of metadata.reactiveKeys) {
		installField(key);
	}

	for (const key of metadata.propertyKeys) {
		if (metadata.reactiveKeys.has(key)) {
			continue;
		}

		installField(key);
	}
}

export function dispatchWatchers(
	instance: Record<string | symbol, unknown>,
	key: ComponentFieldKey,
	next: unknown,
	previous: unknown,
): void {
	const metadata = getComponentMetadata(instance.constructor as Function);
	const watcherKeys = metadata?.watchers.get(key);

	if (!watcherKeys || watcherKeys.size === 0) {
		return;
	}

	for (const watcherKey of watcherKeys) {
		const watcher = instance[watcherKey];

		if (typeof watcher !== "function") {
			continue;
		}

		watcher.call(instance, next, previous, key);
	}
}

function getPersistentStoragePrefix(
	metadata: ComponentMetadata,
	ctor: Function,
): string {
	return `camado:persist:${metadata.selector ?? ctor.name}`;
}

function readStoredFieldValue(prefix: string, key: ComponentFieldKey): unknown {
	if (
		typeof key !== "string" ||
		typeof globalThis.localStorage === "undefined"
	) {
		return undefined;
	}

	try {
		const raw = globalThis.localStorage.getItem(`${prefix}:${key}`);
		if (raw === null) {
			return undefined;
		}

		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

function writeStoredFieldValue(
	prefix: string,
	key: ComponentFieldKey,
	value: unknown,
): void {
	if (
		typeof key !== "string" ||
		typeof globalThis.localStorage === "undefined"
	) {
		return;
	}

	try {
		globalThis.localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value));
	} catch {
		// ignore storage failures
	}
}

function evaluateInitializer(
	instance: Record<string | symbol, unknown>,
	initializer: string,
): unknown {
	try {
		const expression = initializer.replace(/\bthis\b/g, "instance");
		return Function("instance", `return (${expression});`)(instance);
	} catch {
		return undefined;
	}
}

function getFieldInitializerSource(
	ctor: Function,
	key: ComponentFieldKey,
): string | undefined {
	if (typeof key !== "string") {
		return undefined;
	}

	const source = ctor.toString();
	const pattern = new RegExp(
		String.raw`this\.${escapeRegExp(key)}\s*=\s*([^;\n]+)`,
	);
	const match = source.match(pattern);
	return match?.[1]?.trim();
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getEventName(
	instance: Record<string | symbol, unknown>,
	methodKey: ComponentFieldKey,
): string | undefined {
	return getComponentMetadata(instance.constructor as Function)?.events.get(
		methodKey,
	);
}
