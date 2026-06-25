import { expect, test } from "vitest";
import {
	BaseComponent,
	Component,
	Delay,
	Interval,
	OnDestroy,
	OnMount,
	Output,
	Property,
	getComponentMetadata,
} from "../../src/core/index.ts";
import { Event, Reactive, Watch } from "../../src/reactive/index.ts";

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

			const listeners = new Map<string, Array<(event: Event) => void>>();
			return {
				tagName,
				addEventListener(type: string, listener: (event: Event) => void) {
					const current = listeners.get(type) ?? [];
					current.push(listener);
					listeners.set(type, current);
				},
				dispatchEvent(event: Event) {
					for (const listener of listeners.get(event.type) ?? []) {
						listener(event);
					}
					return true;
				},
				replaceChildren() {},
				append() {},
			} as unknown as HTMLElement;
		},
	} as Document;
}

@Component({ selector: "ustro-test-counter" })
class TestCounter extends BaseComponent {
	@Reactive()
	count = 0;

	@Property()
	label = "Count";

	mounted = 0;
	updated = 0;
	changes: Array<[unknown, unknown]> = [];

	protected override render() {
		return `${this.label}: ${this.count}`;
	}

	protected override onMount() {
		this.mounted += 1;
	}

	protected override onUpdate() {
		this.updated += 1;
	}

	@Watch("count")
	handleCountChange(next: unknown, previous: unknown) {
		this.changes.push([previous, next]);
	}
}

@Component({ selector: "ustro-test-event" })
class TestEvent extends BaseComponent {
	protected override render() {
		return null;
	}

	@Event("save")
	save() {
		return { ok: true };
	}
}

@Component({ selector: "ustro-test-event-input" })
class TestEventInput extends BaseComponent {
	protected override render() {
		return null;
	}

	@Output("formSubmitted")
	emitSaved() {
		return { ok: true };
	}
}

@Component({ selector: "ustro-test-derived" })
class TestDerivedReactive extends BaseComponent {
	@Property()
	start = 0;

	@Reactive()
	count = this.start;

	protected override render() {
		return `${this.count}`;
	}
}

@Component({ selector: "ustro-test-loop-guard" })
class TestLoopGuard extends BaseComponent {
	@Reactive()
	count = 0;

	updates = 0;

	protected override render() {
		return `${this.count}`;
	}

	protected override onUpdate() {
		this.updates += 1;

		if (this.updates === 1) {
			this.count += 1;
			this.count += 1;
		}
	}
}

@Component({ selector: "ustro-test-lifecycle" })
class TestLifecycleHooks extends BaseComponent {
	mounted = 0;
	destroyed = 0;
	delayed = 0;
	intervals = 0;

	protected override render() {
		return null;
	}

	@OnMount()
	handleMount() {
		this.mounted += 1;
	}

	@OnDestroy()
	handleDestroy() {
		this.destroyed += 1;
	}

	@Delay(5)
	handleDelay() {
		this.delayed += 1;
	}

	@Interval(5)
	handleInterval() {
		this.intervals += 1;
	}
}

test("Reactive fields register as tracked metadata", () => {
	const metadata = getComponentMetadata(TestDerivedReactive);

	expect(metadata?.reactiveKeys.has("count")).toBe(true);
	expect(metadata?.selector).toBe("ustro-test-derived");
});

test("BaseComponent tracks reactive fields and lifecycle hooks", async () => {
	const previousDocument = globalThis.document;
	(globalThis as typeof globalThis & { document: Document }).document =
		createTestDocument();

	try {
		const counter = TestCounter.create();

		counter.connectedCallback();
		await Promise.resolve();
		await Promise.resolve();

		expect(counter.mounted).toBe(1);
		expect(counter.updated).toBe(0);
		expect(counter.count).toBe(0);

		counter.count = 1;
		await Promise.resolve();
		await Promise.resolve();

		expect(counter.changes).toEqual([[0, 1]]);
		expect(counter.updated).toBe(1);
		expect(counter.label).toBe("Count");

		counter.label = "Total";
		await Promise.resolve();
		await Promise.resolve();

		expect(counter.updated).toBe(2);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("@Input passes only the emitted payload to input callbacks", () => {
	const previousDocument = globalThis.document;
	(globalThis as typeof globalThis & { document: Document }).document =
		createTestDocument();

	try {
		const eventHost = TestEventInput.create({
			formSubmitted: (detail: { ok: true }) => {
				expect(detail).toEqual({ ok: true });
			},
		});

		const result = eventHost.emitSaved();

		expect(result).toEqual({ ok: true });
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("BaseComponent collapses recursive update bursts into one follow-up pass", async () => {
	const previousDocument = globalThis.document;
	(globalThis as typeof globalThis & { document: Document }).document =
		createTestDocument();

	try {
		const loop = TestLoopGuard.create();
		loop.connectedCallback();
		await Promise.resolve();
		await Promise.resolve();

		loop.count = 1;
		await Promise.resolve();
		await Promise.resolve();

		expect(loop.updates).toBe(2);
		expect(loop.count).toBe(3);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("BaseComponent lifecycle decorators run and clean up timers", async () => {
	const previousDocument = globalThis.document;
	(globalThis as typeof globalThis & { document: Document }).document =
		createTestDocument();

	try {
		const component = TestLifecycleHooks.create();
		component.connectedCallback();
		await Promise.resolve();
		await Promise.resolve();
		await new Promise((resolve) => setTimeout(resolve, 25));

		expect(component.mounted).toBe(1);
		expect(component.delayed).toBe(1);
		expect(component.intervals).toBeGreaterThanOrEqual(1);

		const intervalsBeforeDisconnect = component.intervals;
		component.disconnectedCallback();

		expect(component.destroyed).toBe(1);
		await new Promise((resolve) => setTimeout(resolve, 25));
		expect(component.intervals).toBe(intervalsBeforeDisconnect);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});

test("Reactive fields can persist across browser restarts", async () => {
	const previousDocument = globalThis.document;
	const previousStorage = (
		globalThis as typeof globalThis & {
			localStorage?: Storage;
		}
	).localStorage;
	const storage = new Map<string, string>();

	(globalThis as typeof globalThis & { document: Document }).document =
		createTestDocument();
	(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => {
			storage.set(key, value);
		},
		removeItem: (key: string) => {
			storage.delete(key);
		},
		clear: () => {
			storage.clear();
		},
		key: (index: number) => [...storage.keys()][index] ?? null,
		get length() {
			return storage.size;
		},
	};

	@Component({ selector: "ustro-test-persistent" })
	class TestPersistentCounter extends BaseComponent {
		@Reactive({ persistent: true })
		count = 1;

		protected override render() {
			return `${this.count}`;
		}
	}

	try {
		const first = TestPersistentCounter.create();
		first.connectedCallback();
		first.count = 7;
		await Promise.resolve();
		await Promise.resolve();

		const second = TestPersistentCounter.create();
		second.connectedCallback();

		expect(second.count).toBe(7);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
		(
			globalThis as typeof globalThis & { localStorage?: Storage }
		).localStorage = previousStorage;
	}
});

test("@Event dispatches a custom event when the method runs", () => {
	const previousDocument = globalThis.document;
	(globalThis as typeof globalThis & { document: Document }).document =
		createTestDocument();

	try {
		const eventHost = TestEvent.create();
		const dispatched: Array<{ name: string; detail: unknown }> = [];

		eventHost.addEventListener("save", (event) => {
			dispatched.push({
				name: event.type,
				detail: (event as CustomEvent).detail,
			});
		});

		const result = eventHost.save();

		expect(result).toEqual({ ok: true });
		expect(dispatched).toEqual([{ name: "save", detail: { ok: true } }]);
	} finally {
		(globalThis as typeof globalThis & { document: Document }).document =
			previousDocument as Document;
	}
});
