import { expect, test } from "vitest";
import { BaseComponent, Children, Component, Query } from "camado/core";
import { P } from "camado/html";
import type { ComponentChildren } from "camado/core";

@Component({ selector: "pamda-theme-provider" })
class ThemeProviderComponent extends BaseComponent {
	@Children()
	content?: ComponentChildren;

	["pamda-theme"] = "dark";

	protected override render() {
		return this.content as any;
	}
}

@Component({ selector: "header-component" })
class HeaderComponent extends BaseComponent {
	@Query(
		(self) => (self.closest("pamda-theme-provider") as any)?.["pamda-theme"],
	)
	protected theme!: string;

	protected override render() {
		return P(JSON.stringify(this.theme));
	}
}

test("querying the nearest provider theme works in a real browser", async () => {
	const provider = ThemeProviderComponent.create({
		children: HeaderComponent.create(),
	} as any);
	document.body.append(provider);

	await Promise.resolve();
	await Promise.resolve();

	expect(document.body.textContent).toContain('"dark"');
	provider.remove();
});
