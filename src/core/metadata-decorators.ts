import {
	getComponentMetadata,
	getOrCreateComponentMetadata,
	type ComponentFieldKey,
} from "./metadata.ts";

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

type MemoizedMethodState = {
	hasValue: boolean;
	value: unknown;
	warnedReactiveAccess: boolean;
};

const memoizedMethodCache = new WeakMap<
	object,
	Map<PropertyKey, MemoizedMethodState>
>();

function createReactiveAccessProxy(
	instance: object,
	reactiveKeys: ReadonlySet<ComponentFieldKey>,
	onReactiveAccess: (key: ComponentFieldKey) => void,
): object {
	return new Proxy(instance, {
		get(target, property, receiver) {
			if (reactiveKeys.has(property)) {
				onReactiveAccess(property);
			}

			const value = Reflect.get(target, property, receiver);
			if (typeof value === "function") {
				return value.bind(target);
			}

			return value;
		},
	});
}

function warnOnReactiveAccess(
	methodKey: PropertyKey,
	accessedKeys: readonly ComponentFieldKey[],
): void {
	if (accessedKeys.length === 0) {
		return;
	}

	const methodName = String(methodKey);
	const keyList = accessedKeys.map(String).join(", ");
	globalThis.console?.warn?.(
		`Camado @Static(${methodName}) accessed reactive state (${keyList}); the result will be cached and may go stale.`,
	);
}

function cacheMethodResult(
	methodKey: PropertyKey,
	original: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
	return function memoizedMethod(this: object, ...args: unknown[]) {
		const instance = this as object;
		let methods = memoizedMethodCache.get(instance);
		if (!methods) {
			methods = new Map<PropertyKey, MemoizedMethodState>();
			memoizedMethodCache.set(instance, methods);
		}

		const cached = methods.get(methodKey);
		if (cached?.hasValue) {
			return cached.value;
		}

		const metadata = getComponentMetadata(instance.constructor as Function);
		const reactiveKeys = metadata?.reactiveKeys ?? new Set<ComponentFieldKey>();
		const accessedReactiveKeys: ComponentFieldKey[] = [];
		const trackedThis =
			reactiveKeys.size > 0
				? createReactiveAccessProxy(instance, reactiveKeys, (key) => {
						if (!accessedReactiveKeys.includes(key)) {
							accessedReactiveKeys.push(key);
						}
					})
				: instance;

		const value = original.apply(trackedThis, args);
		if (accessedReactiveKeys.length > 0) {
			warnOnReactiveAccess(methodKey, accessedReactiveKeys);
		}

		methods.set(methodKey, {
			hasValue: true,
			value,
			warnedReactiveAccess: accessedReactiveKeys.length > 0,
		});
		return value;
	};
}

export function Static(): MethodDecorator {
	return (_target, propertyKey, descriptor) => {
		if (!descriptor || typeof descriptor.value !== "function") {
			return descriptor;
		}

		descriptor.value = cacheMethodResult(
			propertyKey,
			descriptor.value as (...args: unknown[]) => unknown,
		) as typeof descriptor.value;
		return descriptor;
	};
}
