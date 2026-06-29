import { markQueryField, type QueryFieldSelector } from "./metadata.ts";

export type QuerySelector<TElement extends Element = Element> =
	| string
	| ((host: HTMLElement) => TElement | null);

export type QueriesSelector<TElement extends Element = Element> =
	| string
	| ((host: HTMLElement) => Iterable<TElement> | ArrayLike<TElement>);

export function Query<TElement extends Element = Element>(
	selector: QuerySelector<TElement>,
): PropertyDecorator {
	return (target, key) => {
		markQueryField(target, key, selector as QueryFieldSelector, false);
	};
}

export function Queries<TElement extends Element = Element>(
	selector: QueriesSelector<TElement>,
): PropertyDecorator {
	return (target, key) => {
		markQueryField(target, key, selector as QueryFieldSelector, true);
	};
}
