import type { PrimitiveChild } from "./dom.ts";
import type { NodeRef } from "./node.ts";
import { tryHandleChildValue } from "./child-handlers.ts";
import type { ControlToken } from "../control/index.ts";
import type { StyleBuilder } from "../modifiers/style-builder.ts";
import type { FormFieldState } from "../validator/index.ts";

export interface ModifierToken {
	readonly kind: "modifier";
	readonly attributes: Readonly<
		Record<string, string | boolean | number | bigint | null | undefined>
	>;
}

export interface EventToken {
	readonly kind: "event";
	readonly listeners: Readonly<
		Record<string, EventListenerOrEventListenerObject>
	>;
}

export interface ObserverInvocationConfig extends IntersectionObserverInit {
	margin?: string;
	once?: boolean;
}

export interface ObserverCallbackBinding {
	kind:
		| "visible"
		| "hidden"
		| "enterTop"
		| "enterBottom"
		| "enterLeft"
		| "enterRight"
		| "exitTop"
		| "exitBottom"
		| "exitLeft"
		| "exitRight";
	handler: (entry: IntersectionObserverEntry) => void;
	config?: ObserverInvocationConfig;
}

export interface ObserverCallbacks {
	visible?: ObserverCallbackBinding;
	hidden?: ObserverCallbackBinding;
	enterTop?: ObserverCallbackBinding;
	enterBottom?: ObserverCallbackBinding;
	enterLeft?: ObserverCallbackBinding;
	enterRight?: ObserverCallbackBinding;
	exitTop?: ObserverCallbackBinding;
	exitBottom?: ObserverCallbackBinding;
	exitLeft?: ObserverCallbackBinding;
	exitRight?: ObserverCallbackBinding;
}

export interface ObserverToken {
	readonly kind: "observer";
	readonly callbacks: ObserverCallbacks;
	readonly options: IntersectionObserverInit;
	readonly isOnce: boolean;
}

export type ChildValue =
	| PrimitiveChild
	| Node
	| NodeRef
	| StyleBuilder
	| ModifierToken
	| EventToken
	| ObserverToken
	| FormFieldState<unknown>
	| ControlToken
	| readonly ChildValue[];

export interface ElementFactoryOptions {
	readonly namespace?: "html" | "svg";
}

const nodeRefsByTarget = new WeakMap<Node, NodeRef[]>();
const eventListenersByTarget = new WeakMap<
	Node,
	Readonly<Record<string, EventListenerOrEventListenerObject>>
>();
const observerTokensByTarget = new WeakMap<Node, ObserverToken>();

function isNodeRef(value: unknown): value is NodeRef {
	return typeof value === "object" && value !== null && "current" in value;
}

function registerNodeRef(target: Node, ref: NodeRef): void {
	const current = nodeRefsByTarget.get(target) ?? [];
	current.push(ref);
	nodeRefsByTarget.set(target, current);
}

export function createElementFactory(
	tagName: string,
	options: ElementFactoryOptions = {},
) {
	return (...children: readonly ChildValue[]): HTMLElement | SVGElement => {
		const owner = globalThis.document;

		if (!owner) {
			throw new Error(`Camado requires a DOM to create ${tagName}`);
		}

		const element =
			options.namespace === "svg"
				? owner.createElementNS("http://www.w3.org/2000/svg", tagName)
				: owner.createElement(tagName);

		for (const child of children) {
			appendChildValue(element, child);
		}

		return element;
	};
}

export function appendChildValue(target: ParentNode, value: ChildValue): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			appendChildValue(target, item);
		}
		return;
	}

	if (value === null || value === undefined) {
		return;
	}

	if (typeof Node !== "undefined" && value instanceof Node) {
		target.append(value);
		return;
	}

	if (isNodeRef(value)) {
		if (typeof Node !== "undefined" && target instanceof Node) {
			value.current = target;
			registerNodeRef(target, value);
		} else {
			value.current = null;
		}
		return;
	}

	if (tryHandleChildValue(target, value)) {
		return;
	}

	if (typeof target.append === "function") {
		target.append(String(value));
		return;
	}

	const textFactory = document.createTextNode;
	if (typeof textFactory === "function") {
		target.append(textFactory.call(document, String(value)));
	}
}

export function createFragment(
	...children: readonly ChildValue[]
): DocumentFragment {
	const fragment = document.createDocumentFragment();

	for (const child of children) {
		appendChildValue(fragment, child);
	}

	return fragment;
}

export function getEventListeners(
	target: Node,
): Readonly<Record<string, EventListenerOrEventListenerObject>> | undefined {
	return eventListenersByTarget.get(target);
}

export function setEventListeners(
	target: Node,
	listeners:
		| Readonly<Record<string, EventListenerOrEventListenerObject>>
		| undefined,
): void {
	if (listeners === undefined) {
		eventListenersByTarget.delete(target);
		return;
	}

	eventListenersByTarget.set(target, listeners);
}

export function getNodeRefs(target: Node): readonly NodeRef[] | undefined {
	return nodeRefsByTarget.get(target);
}

export function setNodeRefs(
	target: Node,
	nodeRefs: readonly NodeRef[] | undefined,
): void {
	if (nodeRefs === undefined) {
		nodeRefsByTarget.delete(target);
		return;
	}

	nodeRefsByTarget.set(target, [...nodeRefs]);
}

export function clearNodeRefs(target: Node): void {
	const refs = nodeRefsByTarget.get(target);
	if (refs) {
		for (const ref of refs) {
			ref.current = null;
		}
	}
	nodeRefsByTarget.delete(target);
}

export function getObserverToken(target: Node): ObserverToken | undefined {
	return observerTokensByTarget.get(target);
}

export function setObserverBindings(
	target: Node,
	token: ObserverToken | undefined,
): void {
	if (token === undefined) {
		observerTokensByTarget.delete(target);
		return;
	}

	observerTokensByTarget.set(target, token);
}

export function clearObserverBindings(target: Node): void {
	observerTokensByTarget.delete(target);
}
