import { expect, test } from "vitest";
import { BaseComponent, Component, prepare } from "../../src/core/index.ts";

@Component({ selector: "ustro-prepare-a" })
class PrepareA extends BaseComponent {
	protected override render() {
		return document.createTextNode("a");
	}
}

@Component({ selector: "ustro-prepare-b" })
class PrepareB extends BaseComponent {
	protected override render() {
		return document.createTextNode("b");
	}
}

test("prepare returns a manifest for constructors and factories", () => {
	const manifest = prepare(PrepareA, PrepareB.component());

	expect(manifest.components.map((entry) => entry.selector)).toEqual([
		"ustro-prepare-a",
		"ustro-prepare-b",
	]);
	expect(manifest.selectors["ustro-prepare-a"]).toBe(PrepareA);
	expect(manifest.selectors["ustro-prepare-b"]).toBe(PrepareB);
});
