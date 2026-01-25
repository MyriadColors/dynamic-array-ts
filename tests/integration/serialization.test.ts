import { describe, expect, test } from "bun:test";
import { SerializedDynamicArray } from "../../index";

describe("SerializedDynamicArray Integration", () => {
	test("should push and pop objects correctly", () => {
		const sda = new SerializedDynamicArray();
		const obj1 = { id: 1, name: "Test" };
		const obj2 = { id: 2, tags: ["a", "b"] };

		sda.pushObject(obj1);
		sda.pushObject(obj2);

		expect(sda.length()).toBe(2);
		expect(sda.popObject()).toEqual(obj2);
		expect(sda.popObject()).toEqual(obj1);
		expect(sda.length()).toBe(0);
	});

	test("getObjectAt() should retrieve objects by index", () => {
		const sda = new SerializedDynamicArray();
		const obj1 = { val: "first" };
		const obj2 = { val: "second" };

		sda.pushObject(obj1);
		sda.pushObject(obj2);

		expect(sda.getObjectAt(0)).toEqual(obj1);
		expect(sda.getObjectAt(1)).toEqual(obj2);
	});

	test("should handle complex nested objects and special characters", () => {
		const sda = new SerializedDynamicArray();
		const complexObj = {
			id: 1,
			meta: {
				name: "Special Name 🚀",
				tags: ["webgpu", "typescript", null],
				active: true,
			},
			data: new Array(100).fill(0).map((_, i) => i),
		};

		sda.pushObject(complexObj);
		expect(sda.popObject()).toEqual(complexObj);
	});

	test("clear() should reset everything", () => {
		const sda = new SerializedDynamicArray();
		sda.pushObject({ a: 1 });
		sda.clear();
		expect(sda.length()).toBe(0);
		expect(() => sda.popObject()).toThrow();
	});
});
