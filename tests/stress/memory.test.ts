import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Memory & Capacity Stress Tests", () => {
	test("Should strictly respect maxCapacity if provided", () => {
		const maxCapacity = 20;
		const arr = new DynamicArray(10, maxCapacity);
		
		// Fill to max
		for (let i = 0; i < 20; i++) {
			arr.push(i);
		}
		expect(arr.length).toBe(20);
		expect(arr.capacity).toBeLessThanOrEqual(maxCapacity);
		
		// Attempt to push beyond maxCapacity
		let threw = false;
		try {
			arr.push(21);
		} catch (e) {
			threw = true;
			expect(e).toBeInstanceOf(RangeError);
		}
		
		if (!threw) {
			// If it didn't throw, capacity should still be restricted
			expect(arr.capacity).toBeLessThanOrEqual(maxCapacity);
		}
	});

	test("Should clamp negative initial capacity to 1 (current behavior)", () => {
		const arr = new DynamicArray(-1);
		expect(arr.capacity).toBe(1);
	});

	test("Should throw RangeError for impossibly large initial capacity", () => {
		// 2**53 - 1 is the max safe integer in JS. 
		// ArrayBuffer usually has a smaller limit.
		const TOO_LARGE = Number.MAX_SAFE_INTEGER;
		expect(() => new DynamicArray(TOO_LARGE)).toThrow(RangeError);
	});

	test("Should handle large but safe allocations", () => {
		// 100MB allocation
		const SIZE = 100 * 1024 * 1024;
		const arr = new DynamicArray(1);
		arr.reserve(SIZE);
		expect(arr.capacity).toBe(SIZE);
		expect(arr.buffer.byteLength).toBe(SIZE);
		
		// Basic sanity check that it still works
		arr.push(42);
		expect(arr.get(0)).toBe(42);
		expect(arr.length).toBe(1);
	});

	test("Constructor should throw if initialCapacity > maxCapacity", () => {
		expect(() => new DynamicArray(100, 50)).toThrow(RangeError);
	});
});
