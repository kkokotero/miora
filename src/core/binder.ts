import type { BaseComponent } from "./base-component.ts";
import { scheduleConcurrentBackgroundJob } from "./background.ts";
import { dispatchWatchers, installTrackedFields } from "./metadata.ts";
import type { ComponentFieldKey } from "./metadata.ts";
import { Channel } from "./channel.ts";

export interface BinderContext {
	component: BaseComponent;
	host: HTMLElement;
	key: ComponentFieldKey;
}

export type BinderConstructor<
	TEvents extends Record<string, unknown> = Record<string, unknown>,
	TBinder extends BaseBinder<TEvents> = BaseBinder<TEvents>,
> = new () => TBinder;

const binderInstances = new WeakMap<BinderConstructor<any>, BaseBinder<any>>();

export function getBinderInstance<
	TEvents extends Record<string, unknown> = Record<string, unknown>,
	TBinder extends BaseBinder<TEvents> = BaseBinder<TEvents>,
>(binder: BinderConstructor<TEvents, TBinder>): TBinder {
	let instance = binderInstances.get(binder);
	if (!instance) {
		instance = new binder();
		binderInstances.set(binder, instance);
	}

	return instance as TBinder;
}

export function ensureBinderInstanceProperty(
	binder: BinderConstructor<any>,
): void {
	if (Object.hasOwn(binder, "instance")) {
		return;
	}

	Object.defineProperty(binder, "instance", {
		configurable: true,
		enumerable: false,
		get() {
			return getBinderInstance(binder);
		},
	});
}

export abstract class BaseBinder<
	TEvents extends Record<string, unknown> = Record<string, unknown>,
> {
	readonly channel = new Channel<TEvents>();
	#contexts = new Map<BaseComponent, BinderContext>();
	#invalidateQueued = false;
	#prepared = false;

	static get instance(): BaseBinder<any> {
		return getBinderInstance(BaseBinder as unknown as BinderConstructor<any>);
	}

	connect(context: BinderContext): void {
		if (this.#contexts.has(context.component)) {
			return;
		}

		this.#prepare();

		const wasEmpty = this.#contexts.size === 0;
		this.#contexts.set(context.component, context);
		this.bind(context);
		if (wasEmpty) {
			this.onConnect(context);
		}
	}

	disconnect(context: BinderContext): void {
		if (!this.#contexts.has(context.component)) {
			return;
		}

		const wasLast = this.#contexts.size === 1;
		this.#contexts.delete(context.component);
		this.unbind(context);
		if (wasLast) {
			this.onDisconnect(context);
		}
	}

	protected invalidate(
		sourceKey?: ComponentFieldKey,
		next?: unknown,
		previous?: unknown,
	): void {
		if (this.#invalidateQueued) {
			return;
		}

		const contexts = [...this.#contexts.values()];
		if (contexts.length === 0) {
			return;
		}

		if (sourceKey !== undefined) {
			for (const context of contexts) {
				dispatchWatchers(
					context.component as unknown as Record<string | symbol, unknown>,
					`${String(context.key)}.${String(sourceKey)}`,
					next,
					previous,
				);
			}
		}

		this.#invalidateQueued = true;
		for (const context of contexts) {
			scheduleConcurrentBackgroundJob(() => {
				context.component.__requestUpdate();
			});
		}
		this.#invalidateQueued = false;
	}

	#prepare(): void {
		if (this.#prepared) {
			return;
		}

		installTrackedFields(
			this as Record<string | symbol, unknown>,
			(key, next, previous) => this.invalidate(key, next, previous),
		);

		this.#prepared = true;
	}

	protected bind(_context: BinderContext): void {}

	protected unbind(_context: BinderContext): void {}

	protected onConnect(_context: BinderContext): void {}

	protected onDisconnect(_context: BinderContext): void {}
}
