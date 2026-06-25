import type { BaseComponent } from "./base-component.ts";
import type {
	ComponentConstructor,
	ComponentFactory,
	ComponentInvocationOptions,
} from "./component-types.ts";

export function mount<TComponent extends BaseComponent>(
	target: ParentNode,
	component:
		| ComponentFactory<TComponent>
		| (ComponentConstructor<TComponent> & {
				create?: ComponentFactory<TComponent>;
		  }),
	options?: ComponentInvocationOptions<TComponent>,
): TComponent {
	const element =
		"create" in component
			? component.create?.(options)
			: (component as ComponentFactory<TComponent>)(options);

	if (!element) {
		throw new Error("Ustro mount() could not create an element");
	}

	target.append(element);
	return element;
}
