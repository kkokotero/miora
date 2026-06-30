import { expect, test } from "vitest";
import { BaseComponent, Children, Component, Self, type ComponentChildren } from "camado/core";
import { Button } from "camado/html";

@Component({ selector: "camado-child-projection" })
class ChildProjection extends BaseComponent {
	@Children({ optional: true })
	children?: ComponentChildren;

	protected override render() {
		return Button(this.children);
	}
}

@Component({ selector: "camado-parent-projection" })
class ParentProjection extends BaseComponent {
	@Children({ optional: true })
	children?: ComponentChildren;

	protected override render() {
		return Self(this.children);
	}
}

void ChildProjection;
void ParentProjection;

test("projected child components keep their own projected children", async () => {
	const parent = ParentProjection.create({
		children: ChildProjection.create({ children: "Hoa" }),
	} as any);

	document.body.append(parent);
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));

	const child = document.querySelector("camado-child-projection");
	expect(child?.textContent).toBe("Hoa");
	expect(child?.querySelectorAll("button").length).toBe(1);
	expect(child?.innerHTML).toBe("<button>Hoa</button>");

	parent.remove();
});
