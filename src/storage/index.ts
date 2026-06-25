type StorageShape = Record<string, unknown>;

type StorageLike = Pick<
	globalThis.Storage,
	"getItem" | "setItem" | "removeItem" | "clear" | "key" | "length"
>;

export interface TypedStorage<TSchema extends StorageShape> {
	get<TKey extends keyof TSchema>(key: TKey): TSchema[TKey] | undefined;
	set<TKey extends keyof TSchema>(key: TKey, value: TSchema[TKey]): this;
	remove<TKey extends keyof TSchema>(key: TKey): this;
	clear(): this;
	has<TKey extends keyof TSchema>(key: TKey): boolean;
	keys(): Array<keyof TSchema>;
	entries(): Array<[keyof TSchema, TSchema[keyof TSchema]]>;
	snapshot(): Partial<TSchema>;
}

export interface StorageOptions {
	namespace?: string;
}

const memoryStores = new Map<string, Map<string, string>>();

function resolveNamespace(namespace: string | undefined): string {
	return namespace?.trim() || "camado";
}

function resolveStorage(
	storage: StorageLike | undefined,
	namespace: string,
): StorageLike {
	if (storage) {
		return storage;
	}

	const existing = memoryStores.get(namespace);
	if (existing) {
		return createMemoryStorage(existing);
	}

	const store = new Map<string, string>();
	memoryStores.set(namespace, store);
	return createMemoryStorage(store);
}

function createMemoryStorage(store: Map<string, string>): StorageLike {
	return {
		getItem(key) {
			return store.get(key) ?? null;
		},
		setItem(key, value) {
			store.set(key, value);
		},
		removeItem(key) {
			store.delete(key);
		},
		clear() {
			store.clear();
		},
		key(index) {
			return [...store.keys()][index] ?? null;
		},
		get length() {
			return store.size;
		},
	};
}

function encodeValue(value: unknown): string {
	return JSON.stringify(value);
}

function decodeValue<TValue>(value: string | null): TValue | undefined {
	if (value === null) {
		return undefined;
	}

	try {
		return JSON.parse(value) as TValue;
	} catch {
		return value as unknown as TValue;
	}
}

function createTypedStorage<TSchema extends StorageShape>(
	storage: StorageLike,
	namespace: string,
): TypedStorage<TSchema> {
	const prefix = `${namespace}:`;

	return {
		get(key) {
			const raw = storage.getItem(`${prefix}${String(key)}`);
			return decodeValue<TSchema[typeof key]>(raw);
		},
		set(key, value) {
			if (value === undefined) {
				storage.removeItem(`${prefix}${String(key)}`);
				return this;
			}

			storage.setItem(`${prefix}${String(key)}`, encodeValue(value));
			return this;
		},
		remove(key) {
			storage.removeItem(`${prefix}${String(key)}`);
			return this;
		},
		clear() {
			const keys = this.keys();
			for (const key of keys) {
				storage.removeItem(`${prefix}${String(key)}`);
			}
			return this;
		},
		has(key) {
			return storage.getItem(`${prefix}${String(key)}`) !== null;
		},
		keys() {
			const keys: Array<keyof TSchema> = [];
			for (let index = 0; index < storage.length; index += 1) {
				const key = storage.key(index);
				if (!key || !key.startsWith(prefix)) {
					continue;
				}

				keys.push(key.slice(prefix.length) as keyof TSchema);
			}
			return keys;
		},
		entries() {
			return this.keys().map((key) => [
				key,
				this.get(key) as TSchema[keyof TSchema],
			]);
		},
		snapshot() {
			const result: Partial<TSchema> = {};
			for (const key of this.keys()) {
				result[key] = this.get(key) as TSchema[keyof TSchema];
			}
			return result;
		},
	};
}

function resolveWebStorage(name: "local" | "session"): StorageLike | undefined {
	try {
		return name === "local"
			? globalThis.localStorage
			: globalThis.sessionStorage;
	} catch {
		return undefined;
	}
}

export const Storage = {
	local<TSchema extends StorageShape = StorageShape>(
		namespace?: string,
	): TypedStorage<TSchema> {
		const resolvedNamespace = resolveNamespace(namespace);
		return createTypedStorage(
			resolveStorage(resolveWebStorage("local"), `${resolvedNamespace}:local`),
			resolvedNamespace,
		);
	},
	session<TSchema extends StorageShape = StorageShape>(
		namespace?: string,
	): TypedStorage<TSchema> {
		const resolvedNamespace = resolveNamespace(namespace);
		return createTypedStorage(
			resolveStorage(
				resolveWebStorage("session"),
				`${resolvedNamespace}:session`,
			),
			resolvedNamespace,
		);
	},
	memory<TSchema extends StorageShape = StorageShape>(
		namespace?: string,
	): TypedStorage<TSchema> {
		const resolvedNamespace = resolveNamespace(namespace);
		return createTypedStorage(
			resolveStorage(undefined, `${resolvedNamespace}:memory`),
			resolvedNamespace,
		);
	},
} as const;
