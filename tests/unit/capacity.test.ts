import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Capacity Management", () => {
	test("should grow capacity automatically when needed", () => {
		const arr = new DynamicArray(2);
		expect(arr.capacity).toBe(2);
		arr.push(1, 2);
		expect(arr.capacity).toBe(2);
		arr.push(3);
		// Growth factor is 2, so 2 * 2 = 4
		expect(arr.capacity).toBe(4);
		expect(arr.length).toBe(3);
	});

	test("should shrink capacity automatically when significantly under-utilized", () => {
		// MIN_SHRINK_CAPACITY is 10, so we need a larger start to see shrinking
		const arr = new DynamicArray(20);
		for (let i = 0; i < 20; i++) arr.push(i);
		expect(arr.capacity).toBe(20);

		// Remove elements until length < 25% of capacity (20 * 0.25 = 5)
		for (let i = 0; i < 16; i++) arr.pop();

		expect(arr.length).toBe(4);
		// Should have shrunk: 20 / 2 = 10
		expect(arr.capacity).toBe(10);
	});

	test("reserve() should increase capacity without changing length", () => {
		const arr = new DynamicArray(5);
		arr.push(1, 2, 3);
		arr.reserve(20);
		expect(arr.capacity).toBe(20);
		expect(arr.length).toBe(3);
		expect(arr.toArray()).toEqual([1, 2, 3]);
	});

	test("shrinkToFit() should reduce capacity to match length", () => {
		const arr = new DynamicArray(100);
		arr.push(1, 2, 3);
		arr.shrinkToFit();
		expect(arr.capacity).toBe(3);
		expect(arr.length).toBe(3);
	});

	test("truncate() should trigger shrink if necessary", () => {
		const arr = new DynamicArray(40);
		for (let i = 0; i < 40; i++) arr.push(i);

		arr.truncate(5);
		expect(arr.length).toBe(5);
		expect(arr.capacity).toBeLessThan(40);
	});

	test("truncate() should throw on invalid length", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		expect(() => arr.truncate(5)).toThrow(RangeError);
		expect(() => arr.truncate(-1)).toThrow(RangeError);
	});

	test("clear() should reset length and optionally shrink", () => {
		const initial = 10;
		const arr = new DynamicArray(initial);
		arr.reserve(20);
		expect(arr.capacity).toBe(20);

		arr.push(1, 2, 3);
		arr.clear(false);
		expect(arr.length).toBe(0);
		expect(arr.capacity).toBe(20);

		arr.push(1, 2, 3);
		arr.clear(true);
		expect(arr.length).toBe(0);
		expect(arr.capacity).toBe(initial);
	});

	test("maxCapacity should be respected", () => {
		expect(() => new DynamicArray(100, 50)).toThrow(RangeError);

		const arr = new DynamicArray(5, 10);
		arr.push(1, 2, 3, 4, 5);
		arr.push(6);
		expect(arr.capacity).toBeLessThanOrEqual(10);
	});
});
