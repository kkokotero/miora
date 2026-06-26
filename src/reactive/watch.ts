import { markWatch } from "../core/metadata.ts";

type WatchSelector = (source: any) => unknown;

function resolveWatchSourceKey(selector: WatchSelector): string {
	const path: string[] = [];
	const proxy = new Proxy(() => {}, {
		get(_target, property) {
			if (typeof property !== "string") {
				return proxy;
			}

			path.push(property);
			return proxy;
		},
	});

	try {
		selector(proxy);
	} catch {
		// ignore accessor errors; only the accessed path matters
	}

	return path[path.length - 1] ?? "";
}

export function Watch(sourceKey: string): MethodDecorator;
export function Watch(selector: WatchSelector): MethodDecorator;
export function Watch(source: string | WatchSelector): MethodDecorator {
	const sourceKey =
		typeof source === "string" ? source : resolveWatchSourceKey(source);

	return (target, key) => {
		markWatch(target, sourceKey, key);
	};
}

export namespace Watch {
	export function of(selector: WatchSelector): MethodDecorator {
		return Watch(selector);
	}
}
