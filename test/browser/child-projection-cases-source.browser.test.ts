import { beforeEach, expect, test } from "vitest";
import { BaseComponent, Children, Component, Property, Self, Slot, type ComponentChildren } from "../../src/core/index.ts";
import { Button, Div, Span } from "../../src/html/index.ts";

@Component({ selector: "camado-case-child-src" })
class CaseChildSrc extends BaseComponent {
	@Children({ optional: true })
	children?: ComponentChildren;

	protected override render() {
		return Button(Span(this.children));
	}
}

@Component({ selector: "camado-case-slot-child-src" })
class CaseSlotChildSrc extends BaseComponent {
	@Children({ optional: true })
	children?: ComponentChildren;

	protected override render() {
		return Button(Div(this.children));
	}
}

@Component({ selector: "camado-case-parent-src" })
class CaseParentSrc extends BaseComponent {
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

void CaseChildSrc;
void CaseSlotChildSrc;
void CaseParentSrc;

beforeEach(() => {
	document.body.replaceChildren();
});

async function settle() {
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

test("projects text children", async () => {
	const parent = CaseParentSrc.create({ children: CaseChildSrc.create({ children: "Hoa" }) } as any);
	document.body.append(parent);
	await settle();

	const child = document.querySelector("camado-case-child-src");
	expect(child?.innerHTML).toBe("<button><span>Hoa</span></button>");
	parent.remove();
});

test("projects array children", async () => {
	const parent = CaseParentSrc.create({ children: CaseChildSrc.create({ children: ["A", "B"] }) } as any);
	document.body.append(parent);
	await settle();

	const child = document.querySelector("camado-case-child-src");
	expect(child?.innerHTML).toBe("<button><span>AB</span></button>");
	parent.remove();
});

test("projects component content", async () => {
	const parent = CaseParentSrc.create({ content: CaseChildSrc.create({ children: "Hoa" }) } as any);
	document.body.append(parent);
	await settle();

	const child = document.querySelector("camado-case-child-src");
	expect(child?.innerHTML).toBe("<button><span>Hoa</span></button>");
	parent.remove();
});

test("projects slot content", async () => {
	const parent = CaseParentSrc.create({ footer: CaseChildSrc.create({ children: "Footer" }) } as any);
	document.body.append(parent);
	await settle();

	const child = document.querySelector("camado-case-child-src");
	expect(child?.innerHTML).toBe("<button><span>Footer</span></button>");
	parent.remove();
});

test("projects nested slot child", async () => {
	const parent = CaseParentSrc.create({ footer: CaseSlotChildSrc.create({ children: "Slot" }) } as any);
	document.body.append(parent);
	await settle();

	const child = document.querySelector("camado-case-slot-child-src");
	expect(child?.innerHTML).toBe("<button><div>Slot</div></button>");
	parent.remove();
});
