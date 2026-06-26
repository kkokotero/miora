import { expect, test } from "vitest";
import { Component, getComponentMetadata } from "../../src/core/index.ts";
import { Watch } from "../../src/reactive/index.ts";

@Component({ selector: "camado-watch-test" })
class WatchTestComponent {
	@Watch("count")
	onCountChange() {}

	@Watch("count")
	onCountChangeAgain() {}

	@Watch.of((self) => self.label)
	onLabelChange() {}
}

test("Watch decorator registers source keys and methods", () => {
	const metadata = getComponentMetadata(WatchTestComponent);

	expect(metadata?.watchers.get("count")).toEqual(
		new Set(["onCountChange", "onCountChangeAgain"]),
	);
	expect(metadata?.watchers.get("label")).toEqual(new Set(["onLabelChange"]));
});
