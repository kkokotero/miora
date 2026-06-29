import { markEvent, type EventFieldOptions } from "./metadata.ts";

export function Output(options: EventFieldOptions = {}): MethodDecorator {
	return (
		target: object,
		key: string | symbol,
		descriptor?: PropertyDescriptor,
	) => {
		if (!descriptor || typeof descriptor.value !== "function") {
			return descriptor;
		}

		markEvent(target, key, String(key), options);

		const original = descriptor.value as (...args: unknown[]) => unknown;
		descriptor.value = function (this: unknown, ...args: unknown[]) {
			const result = original.apply(this, args);
			const emitter = this as unknown as {
				emit?: (name: string, detail?: unknown) => boolean;
				dispatchEvent?: (event: Event) => boolean;
			};

			if (typeof emitter.emit === "function") {
				emitter.emit(String(key), result);
			} else if (typeof emitter.dispatchEvent === "function") {
				const event =
					typeof globalThis.CustomEvent === "function"
						? new globalThis.CustomEvent(String(key), {
								bubbles: true,
								composed: true,
								detail: result,
							})
						: ({ type: String(key), detail: result } as unknown as Event);

				emitter.dispatchEvent(event);
			}

			return result;
		};

		return descriptor;
	};
}
