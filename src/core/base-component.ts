import { createRuntimeContext } from "../core/runtime.ts";
import {
	dispatchWatchers,
	getComponentMetadata,
	installHostFields,
	installQueryFields,
	installTrackedFields,
} from "../core/metadata.ts";
import {
	getBinderInstance,
	type BaseBinder,
	type BinderContext,
} from "./binder.ts";
import { patchRender } from "./patch.ts";
import { setCurrentRenderTarget } from "./render-context.ts";
import type { SelfToken } from "./self.ts";
import type {
	ComponentConstructor,
	ComponentElement,
	ComponentFactory,
	ComponentInvocationOptions,
} from "./component-types.ts";
import { getComponentOutputCallbacks } from "./output-callbacks.ts";
import { invokeComponent } from "./component-invoke.ts";

export type RenderValue =
	| Node
	| string
	| number
	| bigint
	| boolean
	| null
	| undefined
	| SelfToken
	| RenderValue[];

function createComponentElement<TComponent extends BaseComponent>(
	this: ComponentConstructor<TComponent>,
	options?: ComponentInvocationOptions<TComponent>,
): ComponentElement<TComponent> {
	return invokeComponent(
		this as unknown as ComponentConstructor<TComponent>,
		options,
	);
}

function createComponentFactory<TComponent extends BaseComponent>(
	this: ComponentConstructor<TComponent>,
): ComponentFactory<TComponent> & {
	ctor: ComponentConstructor<TComponent>;
} {
	const ctor = this as unknown as ComponentConstructor<TComponent>;
	const factory = (options?: ComponentInvocationOptions<TComponent>) =>
		invokeComponent(ctor, options);

	return Object.assign(factory, { ctor });
}

export abstract class BaseComponent {
	#runtime = createRuntimeContext();
	#host?: HTMLElement;
	#prepared = false;
	#connected = false;
	#mounted = false;
	#updateQueued = false;
	#updateInProgress = false;
	#updateRequestedDuringRun = false;
	#hydrationPending = false;
	#timeoutIds = new Set<ReturnType<typeof setTimeout>>();
	#intervalIds = new Set<ReturnType<typeof setInterval>>();
	#binders: Array<{ binder: BaseBinder; context: BinderContext }> = [];

	constructor() {}

	static create: <TComponent extends BaseComponent>(
		this: ComponentConstructor<TComponent>,
		options?: ComponentInvocationOptions<TComponent>,
	) => ComponentElement<TComponent>;

	static component: <TComponent extends BaseComponent>(
		this: ComponentConstructor<TComponent>,
	) => ComponentFactory<TComponent> & {
		ctor: ComponentConstructor<TComponent>;
	};

	__attachHost(host: HTMLElement): void {
		this.#host = host;
	}

	__connect(): void {
		this.#connected = true;
		void this.#prepare();
		this.#connectBinders();

		if (this.#hydrationPending) {
			this.#hydrationPending = false;
			void this.#performUpdate();
			return;
		}

		void this.#performUpdate();
	}

	__markHydrated(): void {
		this.#hydrationPending = true;
	}

	__requestUpdate(): void {
		this.requestUpdate();
	}

	__disconnect(): void {
		this.#connected = false;
		this.#clearLifecycleTimers();
		this.#disconnectBinders();
		this.onUnmount();
		this.#runLifecycleHooks("destroy");
		this.#mounted = false;
	}

	protected abstract render(): RenderValue;

	protected onMount(): void {}

	protected onUpdate(): void {}

	protected onUnmount(): void {}

	#runLifecycleHooks(phase: "mount" | "destroy"): void {
		const metadata = this.componentMetadata;
		if (!metadata) {
			return;
		}

		if (phase === "mount") {
			for (const key of metadata.mountHooks) {
				this.#invokeLifecycleMethod(key);
			}

			for (const [key, delayMs] of metadata.delayHooks) {
				const timerId = setTimeout(() => {
					this.#timeoutIds.delete(timerId);
					if (this.#connected) {
						this.#invokeLifecycleMethod(key);
					}
				}, delayMs);
				this.#timeoutIds.add(timerId);
			}

			for (const [key, intervalMs] of metadata.intervalHooks) {
				const timerId = setInterval(() => {
					if (this.#connected) {
						this.#invokeLifecycleMethod(key);
					}
				}, intervalMs);
				this.#intervalIds.add(timerId);
			}
			return;
		}

		for (const key of metadata.destroyHooks) {
			this.#invokeLifecycleMethod(key);
		}
	}

	#clearLifecycleTimers(): void {
		for (const timerId of this.#timeoutIds) {
			clearTimeout(timerId);
		}
		this.#timeoutIds.clear();

		for (const timerId of this.#intervalIds) {
			clearInterval(timerId);
		}
		this.#intervalIds.clear();
	}

	#invokeLifecycleMethod(methodKey: string | symbol): void {
		const instance = this as Record<string | symbol, unknown>;
		const method = instance[methodKey];
		if (typeof method !== "function") {
			return;
		}

		(method as () => unknown).call(this);
	}

	protected emit<TDetail = unknown>(
		name: string,
		detail?: TDetail,
		init?: Omit<CustomEventInit, "detail">,
	): boolean {
		const dispatcher = this.#host as unknown as {
			dispatchEvent?: (event: Event) => boolean;
		};

		if (typeof dispatcher?.dispatchEvent !== "function") {
			return false;
		}

		const event =
			typeof globalThis.CustomEvent === "function"
				? new globalThis.CustomEvent(name, {
						bubbles: true,
						composed: true,
						detail,
						...init,
					})
				: ({ type: name, detail, ...init } as unknown as Event);

		const result = dispatcher.dispatchEvent(event);
		const directHandler = getComponentOutputCallbacks(this.#host)?.[name];
		if (typeof directHandler === "function") {
			directHandler(detail as TDetail);
		}

		return result;
	}

	protected requestUpdate(): void {
		if (this.#updateInProgress) {
			this.#updateRequestedDuringRun = true;
			return;
		}

		if (this.#updateQueued) {
			return;
		}

		this.#updateQueued = true;
		this.#runtime.scheduler.schedule(() => {
			this.#updateQueued = false;
			void this.#performUpdate();
		});
	}

	#prepare(): void {
		if (this.#prepared) {
			return;
		}

		installTrackedFields(
			this as Record<string | symbol, unknown>,
			(key, next, previous) => {
				dispatchWatchers(
					this as Record<string | symbol, unknown>,
					key,
					next,
					previous,
				);
				this.requestUpdate();
			},
		);
		installHostFields(this as Record<string | symbol, unknown>);
		installQueryFields(this as Record<string | symbol, unknown>);

		this.#prepared = true;
	}

	#connectBinders(): void {
		const metadata = this.componentMetadata;
		if (!metadata || metadata.binders.size === 0) {
			return;
		}

		const host = this.#host;
		if (!host) {
			return;
		}

		this.#binders = [];
		const attached = new Set<BaseBinder>();

		for (const [key, BinderCtor] of metadata.binders) {
			const binder = getBinderInstance(BinderCtor);
			(this as Record<string | symbol, unknown>)[key] = binder;
			const context: BinderContext = { component: this, host, key };
			if (!attached.has(binder)) {
				attached.add(binder);
				binder.connect(context);
				this.#binders.push({ binder, context });
			}
		}
	}

	#disconnectBinders(): void {
		for (const { binder, context } of this.#binders) {
			binder.disconnect(context);
		}
		this.#binders = [];
	}

	async #performUpdate(): Promise<void> {
		if (!this.#connected) {
			return;
		}

		if (!this.#prepared) {
			this.#prepare();
		}

		this.#updateInProgress = true;

		try {
			setCurrentRenderTarget(this as unknown as { requestUpdate(): void });
			patchRender(this.#host, this.render());

			if (this.#mounted) {
				this.onUpdate();
			} else {
				this.#mounted = true;
				this.onMount();
				this.#runLifecycleHooks("mount");
			}
		} finally {
			setCurrentRenderTarget(null);
			this.#updateInProgress = false;
		}

		if (this.#updateRequestedDuringRun) {
			this.#updateRequestedDuringRun = false;
			this.requestUpdate();
		}
	}

	protected get isMounted(): boolean {
		return this.#mounted;
	}

	protected get hostElement(): HTMLElement | undefined {
		return this.#host;
	}

	protected get runtime(): ReturnType<typeof createRuntimeContext> {
		return this.#runtime;
	}

	protected get componentMetadata() {
		return getComponentMetadata(this.constructor as Function);
	}
}

Object.assign(BaseComponent, {
	create: createComponentElement,
	component: createComponentFactory,
});
