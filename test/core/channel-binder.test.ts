import { expect, test } from "vitest";
import {
	Bind,
	BaseBinder,
	BaseComponent,
	Channel,
	Component,
} from "../../src/core/index.ts";
import type { BinderContext } from "../../src/core/binder.ts";
import { Reactive, Watch } from "../../src/reactive/index.ts";

const customElementsRegistry = new Map<string, CustomElementConstructor>();
Object.defineProperty(globalThis, "customElements", {
	configurable: true,
	value: {
		define(name: string, ctor: CustomElementConstructor) {
			customElementsRegistry.set(name, ctor);
		},
		get(name: string) {
			return customElementsRegistry.get(name);
		},
	} as unknown as CustomElementRegistry,
});

function createTestDocument(): Document {
	return {
		createElement(tagName: string) {
			const ctor = customElementsRegistry.get(tagName);
			if (ctor) {
				return new ctor() as unknown as HTMLElement;
			}

			return {
				tagName,
				dispatchEvent() {
					return true;
				},
				replaceChildren() {},
				append() {},
			} as unknown as HTMLElement;
		},
	} as Document;
}

const waitForBackground = async (steps = 1) => {
	for (let index = 0; index < steps; index += 1) {
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	}
};

test("Channel emits typed payloads to listeners", async () => {
	const channel = new Channel<{ ping: number; done: string }>();
	const seen: Array<[string, unknown]> = [];

	const off = channel.on("ping", (detail) => {
		seen.push(["ping", detail]);
	});

	expect(channel.emit("ping", 1)).toBe(true);
	expect(seen).toEqual([]);
	await waitForBackground(2);
	off();
	expect(channel.emit("ping", 2)).toBe(false);
	await waitForBackground(2);
	expect(seen).toEqual([["ping", 1]]);
});

let binds = 0;
let unbinds = 0;
let connects = 0;
let disconnects = 0;
let invalidations = 0;
let watchHits = 0;

class CounterBinder extends BaseBinder {
	protected override bind(_context: BinderContext): void {
		binds += 1;
	}

	protected override unbind(_context: BinderContext): void {
		unbinds += 1;
	}

	protected override onConnect(): void {
		connects += 1;
	}

	protected override onDisconnect(): void {
		disconnects += 1;
	}
}

class ReactiveCounterBinder extends BaseBinder {
	@Reactive()
	count = 0;

	protected override invalidate(
		sourceKey?: string | symbol,
		next?: unknown,
		previous?: unknown,
	): void {
		invalidations += 1;
		super.invalidate(sourceKey, next, previous);
	}
}

@Component({ selector: "camado-test-bound" })
class TestBoundComponent extends BaseComponent {
	@Bind(CounterBinder)
	bind!: CounterBinder;

	protected override render() {
		return null;
	}
}

test("Bind connects and disconnects binders with the component lifecycle", async () => {
	const previousDocument = globalThis.document;
	(globalThis as typeof globalThis & { document: Document }).document =
		createTestDocument();

	try {
		const component = TestBoundComponent.create();
		component.connectedCallback();
		await Promise.resolve();
		await Promise.resolve();

		expect(component.bind).toBe(CounterBinder.instance);
		expect(binds).toBe(1);
		expect(connects).toBe(1);
		expect(disconnects).toBe(0);

		component.disconnectedCallback();
		expect(unbinds).toBe(1);
		expect(disconnects).toBe(1);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

@Component({ selector: "camado-test-reactive-bound" })
class TestReactiveBoundComponent extends BaseComponent {
	@Bind(ReactiveCounterBinder)
	binder!: ReactiveCounterBinder;

	@Watch.of((self) => self.binder.count)
	handleBinderCountChange() {
		watchHits += 1;
	}

	protected override render() {
		return null;
	}
}

test("Reactive fields inside binders invalidate on change", async () => {
	const previousDocument = globalThis.document;
	(globalThis as typeof globalThis & { document: Document }).document =
		createTestDocument();

	try {
		const component = TestReactiveBoundComponent.create();
		component.connectedCallback();
		await Promise.resolve();
		await Promise.resolve();

		component.binder.count += 1;
		expect(invalidations).toBe(1);
		expect(watchHits).toBe(1);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});
