import { expect, test } from "vitest";
import { BaseComponent, Children, Component, Property, Self, Slot, type ComponentChildren } from "camado/core";
import { Button, Div, Span } from "camado/html";

@Component({ selector: "camado-matrix-child" })
class MatrixChild extends BaseComponent {
	@Children({ optional: true })
	children?: ComponentChildren;

	protected override render() {
		return Button(Span(this.children));
	}
}

@Component({ selector: "camado-matrix-slot-child" })
class MatrixSlotChild extends BaseComponent {
	@Children({ optional: true })
	children?: ComponentChildren;

	protected override render() {
		return Button(Div(this.children));
	}
}

@Component({ selector: "camado-matrix-parent" })
class MatrixParent extends BaseComponent {
	@Children({ optional: true })
	children?: ComponentChildren;

	@Property({ optional: true })
	content?: ComponentChildren;

	@Slot("footer", { optional: true })
	footer?: ComponentChildren;

	protected override render() {
		return Self(this.children ?? this.content ?? this.footer);
	}
}

void MatrixChild;
void MatrixSlotChild;
void MatrixParent;

test("child projection matrix", async () => {
	const parentWithText = MatrixParent.create({
		children: MatrixChild.create({ children: "Hoa" }),
	} as any);
	const parentWithFragment = MatrixParent.create({
		children: MatrixChild.create({ children: ["A", "B"] }),
	} as any);
	const parentWithComponentContent = MatrixParent.create({
		content: MatrixChild.create({ children: "Hoa" }),
	} as any);
	const parentWithSlot = MatrixParent.create({
		footer: MatrixChild.create({ children: "Footer" }),
	} as any);
	const parentWithNestedSlotChild = MatrixParent.create({
		footer: MatrixSlotChild.create({ children: "Slot" }),
	} as any);

	document.body.append(
		parentWithText,
		parentWithFragment,
		parentWithComponentContent,
		parentWithSlot,
		parentWithNestedSlotChild,
	);

	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));

	const cases = Array.from(document.querySelectorAll("camado-matrix-child, camado-matrix-slot-child"));
	expect(cases.length).toBe(5);

	const [textCase, fragmentCase, componentContentCase, slotCase, nestedSlotCase] = cases;
	expect(textCase?.textContent).toContain("Hoa");
	expect(textCase?.querySelectorAll("button").length).toBe(1);
	expect(textCase?.innerHTML).toBe("<button><span>Hoa</span></button>");

	expect(fragmentCase?.textContent).toContain("AB");
	expect(fragmentCase?.querySelectorAll("button").length).toBe(1);
	expect(fragmentCase?.innerHTML).toBe("<button><span>AB</span></button>");

	expect(componentContentCase?.textContent).toContain("Hoa");
	expect(componentContentCase?.querySelectorAll("button").length).toBe(1);
	expect(componentContentCase?.innerHTML).toBe("<button><span>Hoa</span></button>");

	expect(slotCase?.textContent).toContain("Footer");
	expect(slotCase?.querySelectorAll("button").length).toBe(1);
	expect(slotCase?.innerHTML).toBe("<button><span>Footer</span></button>");

	expect(nestedSlotCase?.textContent).toContain("Slot");
	expect(nestedSlotCase?.querySelectorAll("button").length).toBe(1);
	expect(nestedSlotCase?.innerHTML).toBe("<button><div>Slot</div></button>");

	parentWithText.remove();
	parentWithFragment.remove();
	parentWithComponentContent.remove();
	parentWithSlot.remove();
	parentWithNestedSlotChild.remove();
});
