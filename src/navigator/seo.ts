type SeoMetaIdentity =
	| "name"
	| "property"
	| "charset"
	| "httpEquiv"
	| "itemProp";

export interface SeoMetaOptions {
	name?: string;
	property?: string;
	charset?: string;
	httpEquiv?: string;
	itemProp?: string;
	content?: string;
	media?: string;
}

export interface SeoLinkOptions {
	rel?: string;
	href: string;
	type?: string;
	sizes?: string;
	media?: string;
	as?: string;
	crossOrigin?: "anonymous" | "use-credentials" | "";
	referrerPolicy?: ReferrerPolicy;
}

export interface SeoPageOptions {
	title?: string;
	icon?: string | SeoLinkOptions;
	description?: string;
	canonical?: string;
	metas?: readonly SeoMetaOptions[];
	links?: readonly SeoLinkOptions[];
}

export interface SeoHeadHelpers {
	title(value: string): HTMLTitleElement;
	icon(href: string, options?: Omit<SeoLinkOptions, "href">): HTMLLinkElement;
	meta(options: SeoMetaOptions): HTMLMetaElement;
	link(options: SeoLinkOptions): HTMLLinkElement;
	page(options: SeoPageOptions): void;
}

function requireDocument(): Document {
	const doc = globalThis.document;
	if (!doc) {
		throw new Error("Camado requires a DOM to manage SEO metadata");
	}

	return doc;
}

function getHeadParent(doc: Document): ParentNode & {
	append?: (...items: Array<Node | string>) => void;
	appendChild?: (child: Node) => Node;
} {
	return doc.head ?? doc.documentElement ?? doc;
}

function appendNode(
	parent: ParentNode & {
		append?: (...items: Array<Node | string>) => void;
		appendChild?: (child: Node) => Node;
	},
	node: Node,
): void {
	if (typeof parent.append === "function") {
		parent.append(node);
		return;
	}

	parent.appendChild?.(node);
}

function isElementNode(node: Node): node is Element {
	return node.nodeType === 1;
}

function findHeadElement<T extends Element>(
	parent: ParentNode,
	tagName: string,
	predicate: (element: Element) => boolean,
): T | undefined {
	const childNodes = (parent as { childNodes?: ArrayLike<Node> | null })
		.childNodes;
	if (!childNodes) {
		return undefined;
	}

	for (let index = 0; index < childNodes.length; index += 1) {
		const child = childNodes[index];
		if (!child || !isElementNode(child)) {
			continue;
		}

		if (child.tagName.toLowerCase() !== tagName) {
			continue;
		}

		if (predicate(child)) {
			return child as T;
		}
	}

	return undefined;
}

function setAttr(
	element: Element,
	name: string,
	value: string | undefined,
): void {
	if (value === undefined) {
		return;
	}

	element.setAttribute(name, value);
}

function updateTitle(title: string): HTMLTitleElement {
	const doc = requireDocument();
	const head = getHeadParent(doc);
	let element = findHeadElement<HTMLTitleElement>(head, "title", () => true);
	if (!element) {
		element = doc.createElement("title");
		appendNode(head, element);
	}

	element.textContent = title;
	if ("title" in doc) {
		doc.title = title;
	}

	return element;
}

function updateLink(options: SeoLinkOptions): HTMLLinkElement {
	const doc = requireDocument();
	const head = getHeadParent(doc);
	const rel = options.rel ?? "icon";
	let element = findHeadElement<HTMLLinkElement>(
		head,
		"link",
		(candidate) => candidate.getAttribute("rel") === rel,
	);

	if (!element) {
		element = doc.createElement("link");
		appendNode(head, element);
	}

	element.setAttribute("rel", rel);
	element.setAttribute("href", options.href);
	setAttr(element, "type", options.type);
	setAttr(element, "sizes", options.sizes);
	setAttr(element, "media", options.media);
	setAttr(element, "as", options.as);
	setAttr(element, "crossorigin", options.crossOrigin);
	setAttr(element, "referrerpolicy", options.referrerPolicy);

	return element;
}

function getMetaIdentity(options: SeoMetaOptions): SeoMetaIdentity | undefined {
	if (options.name !== undefined) return "name";
	if (options.property !== undefined) return "property";
	if (options.charset !== undefined) return "charset";
	if (options.httpEquiv !== undefined) return "httpEquiv";
	if (options.itemProp !== undefined) return "itemProp";
	return undefined;
}

function getMetaAttributeName(identity: SeoMetaIdentity): string {
	switch (identity) {
		case "httpEquiv":
			return "http-equiv";
		case "itemProp":
			return "itemprop";
		default:
			return identity;
	}
}

function updateMeta(options: SeoMetaOptions): HTMLMetaElement {
	const doc = requireDocument();
	const head = getHeadParent(doc);
	const identity = getMetaIdentity(options);
	let element = findHeadElement<HTMLMetaElement>(head, "meta", (candidate) => {
		if (!identity) {
			return false;
		}

		const identityAttr = getMetaAttributeName(identity);
		return candidate.getAttribute(identityAttr) === options[identity];
	});

	if (!element) {
		element = doc.createElement("meta");
		appendNode(head, element);
	}

	if (options.charset !== undefined) {
		element.setAttribute("charset", options.charset);
		element.removeAttribute("name");
		element.removeAttribute("property");
		element.removeAttribute("http-equiv");
		element.removeAttribute("itemprop");
		element.removeAttribute("content");
		return element;
	}

	for (const [name, value] of Object.entries({
		name: options.name,
		property: options.property,
		"http-equiv": options.httpEquiv,
		itemprop: options.itemProp,
		media: options.media,
	})) {
		if (value === undefined) {
			element.removeAttribute(name);
			continue;
		}

		element.setAttribute(name, value);
	}

	if (options.content === undefined) {
		element.removeAttribute("content");
	} else {
		element.setAttribute("content", options.content);
	}

	return element;
}

function updatePage(options: SeoPageOptions): void {
	if (options.title !== undefined) {
		updateTitle(options.title);
	}

	if (options.icon !== undefined) {
		if (typeof options.icon === "string") {
			updateLink({ href: options.icon, rel: "icon" });
		} else {
			updateLink({ rel: "icon", ...options.icon });
		}
	}

	if (options.description !== undefined) {
		updateMeta({ name: "description", content: options.description });
	}

	if (options.canonical !== undefined) {
		updateLink({ rel: "canonical", href: options.canonical });
	}

	for (const meta of options.metas ?? []) {
		updateMeta(meta);
	}

	for (const link of options.links ?? []) {
		updateLink(link);
	}
}

export const Seo: SeoHeadHelpers = {
	title: updateTitle,
	icon: (href, options = {}) => updateLink({ rel: "icon", href, ...options }),
	meta: updateMeta,
	link: updateLink,
	page: updatePage,
} as const;
