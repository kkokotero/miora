import { expect, test } from "vitest";
import { Validator } from "../../src/validator/index.ts";

test("validator exposes common string helpers", () => {
	expect(Validator.string().url().parse("https://example.com")).toBe(
		"https://example.com",
	);
	expect(
		Validator.string().uuid().parse("123e4567-e89b-12d3-a456-426614174000"),
	).toBe("123e4567-e89b-12d3-a456-426614174000");
	expect(
		Validator.string().startsWith("ca").includes("am").parse("camado"),
	).toBe("camado");
	expect(Validator.string().endsWith("on").parse("neon")).toBe("neon");
	expect(Validator.string().oneOf(["red", "green"]).parse("green")).toBe(
		"green",
	);
});

test("validator exposes common number and date helpers", () => {
	expect(Validator.number().finite().int().between(10, 20).parse(12)).toBe(12);
	expect(Validator.number().positive().parse(1)).toBe(1);
	expect(Validator.number().nonnegative().parse(0)).toBe(0);

	const date = Validator.date()
		.between(
			new Date("2025-01-01T00:00:00.000Z"),
			new Date("2025-12-31T23:59:59.999Z"),
		)
		.parse("2025-06-01T00:00:00.000Z");

	expect(date).toBeInstanceOf(Date);
	expect(date.toISOString()).toBe("2025-06-01T00:00:00.000Z");
});

test("validator exposes boolean helpers", () => {
	expect(Validator.boolean().truthy().parse(true)).toBe(true);
	expect(Validator.boolean().falsy().parse(false)).toBe(false);
});
