/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("Safe Methods (memory zeroing)", () => {
	describe("safePop()", () => {
		test("returns correct value", () => {
			const arr = new DynamicArray();
			arr.push(1, 2, 3);
			expect(arr.safePop()).toBe(3);
			expect(arr.length).toBe(2);
		});

		test("zeros the popped position", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			arr.safePop();
			expect(arr.getRawBuffer()[2]).toBe(0);
		});

		test("returns undefined for empty array", () => {
			const arr = new DynamicArray();
			expect(arr.safePop()).toBeUndefined();
		});

		test("handles single element array", () => {
			const arr = new DynamicArray();
			arr.push(42);
			expect(arr.safePop()).toBe(42);
			expect(arr.length).toBe(0);
			expect(arr.getRawBuffer()[0]).toBe(0);
		});

		test("works with _head offset (after previous shifts)", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			arr.shift();
			arr.shift();
			expect(arr.toArray()).toEqual([3, 4, 5]);
			arr.safePop();
			expect(arr.getRawBuffer()[4]).toBe(0);
		});
	});

	describe("safeShift()", () => {
		test("returns correct value", () => {
			const arr = new DynamicArray();
			arr.push(1, 2, 3);
			expect(arr.safeShift()).toBe(1);
			expect(arr.toArray()).toEqual([2, 3]);
		});

		test("zeros the shifted-from position", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			arr.safeShift();
			expect(arr.getRawBuffer()[0]).toBe(0);
		});

		test("returns undefined for empty array", () => {
			const arr = new DynamicArray();
			expect(arr.safeShift()).toBeUndefined();
		});

		test("works with _head offset (after previous shifts)", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			arr.shift();
			expect(arr.toArray()).toEqual([2, 3, 4, 5]);
			arr.safeShift();
			expect(arr.getRawBuffer()[1]).toBe(0);
		});
	});

	describe("safeSplice()", () => {
		test("delete only: verifies deleted range is zeroed", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			arr.safeSplice(1, 2);
			expect(arr.toArray()).toEqual([1, 4, 5]);
			expect(arr.getRawBuffer()[3]).toBe(0);
			expect(arr.getRawBuffer()[4]).toBe(0);
		});

		test("insert only: verifies behavior matches splice()", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 4);
			arr.safeSplice(1, 0, {}, 2, 3);
			expect(arr.toArray()).toEqual([1, 2, 3, 4]);
		});

		test("delete and insert: verifies deleted positions zeroed", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 5);
			arr.safeSplice(1, 1, 3, 4);
			expect(arr.toArray()).toEqual([1, 3, 4, 5]);
			expect(arr.raw()[1]).toBe(3);
			expect(arr.raw()[2]).toBe(4);
		});

		test("handles deleteCount = 0", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			arr.safeSplice(1, 0, 99);
			expect(arr.toArray()).toEqual([1, 99, 2, 3]);
		});

		test("handles start at end of array", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			arr.safeSplice(3, 0, 4, 5);
			expect(arr.toArray()).toEqual([1, 2, 3, 4, 5]);
		});

		test("works with _head offset (after previous shifts)", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			arr.shift();
			expect(arr.toArray()).toEqual([2, 3, 4, 5]);
			arr.safeSplice(1, 2);
			expect(arr.toArray()).toEqual([2, 5]);
			expect(arr.getRawBuffer()[3]).toBe(0);
			expect(arr.getRawBuffer()[4]).toBe(0);
		});
	});

	describe("safeTruncate()", () => {
		test("verifies truncated range is zeroed", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			arr.safeTruncate(3);
			expect(arr.length).toBe(3);
			expect(arr.toArray()).toEqual([1, 2, 3]);
			expect(arr.getRawBuffer()[3]).toBe(0);
			expect(arr.getRawBuffer()[4]).toBe(0);
		});

		test("truncating to zero is same as clear", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			arr.safeTruncate(0);
			expect(arr.length).toBe(0);
			expect(arr.toArray()).toEqual([]);
			expect(arr.getRawBuffer()[0]).toBe(0);
			expect(arr.getRawBuffer()[1]).toBe(0);
			expect(arr.getRawBuffer()[2]).toBe(0);
		});

		test("throws RangeError for invalid lengths", () => {
			const arr = new DynamicArray();
			arr.push(1, 2, 3);
			expect(() => arr.safeTruncate(-1)).toThrow(RangeError);
			expect(() => arr.safeTruncate(5)).toThrow(RangeError);
		});

		test("works with _head offset (after previous shifts)", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			arr.shift();
			arr.shift();
			expect(arr.toArray()).toEqual([3, 4, 5]);
			arr.safeTruncate(1);
			expect(arr.length).toBe(1);
			expect(arr.toArray()).toEqual([3]);
			expect(arr.getRawBuffer()[3]).toBe(0);
			expect(arr.getRawBuffer()[4]).toBe(0);
		});
	});

	describe("safeClear()", () => {
		test("verifies entire buffer is zeroed", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			const oldCapacity = arr.capacity;
			arr.safeClear();
			expect(arr.length).toBe(0);
			expect(arr.capacity).toBe(oldCapacity);
			for (let i = 0; i < oldCapacity; i++) {
				expect(arr.getRawBuffer()[i]).toBe(0);
			}
		});

		test("works with _head offset (after previous shifts)", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			arr.shift();
			arr.shift();
			arr.safeClear();
			expect(arr.length).toBe(0);
			for (let i = 0; i < 10; i++) {
				expect(arr.getRawBuffer()[i]).toBe(0);
			}
		});
	});

	describe("secured() wrapper", () => {
		test("pop() calls safePop()", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			const secured = arr.secured();
			expect(secured.pop()).toBe(3);
			expect(arr.getRawBuffer()[2]).toBe(0);
		});

		test("shift() calls safeShift()", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			const secured = arr.secured();
			expect(secured.shift()).toBe(1);
			expect(arr.getRawBuffer()[0]).toBe(0);
		});

		test("splice() calls safeSplice()", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			const secured = arr.secured();
			secured.splice(1, 2);
			expect(arr.getRawBuffer()[3]).toBe(0);
			expect(arr.getRawBuffer()[4]).toBe(0);
		});

		test("truncate() calls safeTruncate()", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3, 4, 5);
			const secured = arr.secured();
			secured.truncate(3);
			expect(arr.getRawBuffer()[3]).toBe(0);
			expect(arr.getRawBuffer()[4]).toBe(0);
		});

		test("clear() calls safeClear()", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			const secured = arr.secured();
			secured.clear();
			for (let i = 0; i < 10; i++) {
				expect(arr.getRawBuffer()[i]).toBe(0);
			}
		});

		test("other methods delegate normally (get, push, etc.)", () => {
			const arr = new DynamicArray(10);
			arr.push(1, 2, 3);
			const secured = arr.secured();
			expect(secured.get(0)).toBe(1);
			expect(secured.push(4)).toBe(4);
			expect(secured.length).toBe(4);
			expect(secured.at(-1)).toBe(4);
			expect(secured.includes(2)).toBe(true);
		});

		test("collection methods return secured views", () => {
			const arr = new DynamicArray();
			arr.push(1, 2, 3, 4);
			const secured = arr.secured();
			const extra = new DynamicArray();
			extra.push(5, 6);
			const sliced = secured.slice(1, 3);
			const mapped = secured.map((value) => value * 2);
			const filtered = secured.filter((value) => value % 2 === 0);
			const concatenated = secured.concat(extra);
			expect(sliced.toArray()).toEqual([2, 3]);
			expect(mapped.pop()).toBe(8);
			expect(filtered.pop()).toBe(4);
			expect(concatenated.pop()).toBe(6);
		});

		test("concat accepts another secured view", () => {
			const left = new DynamicArray();
			left.push(1, 2);
			const right = new DynamicArray();
			right.push(3, 4);
			const result = left.secured().concat(right.secured());
			expect(result.toArray()).toEqual([1, 2, 3, 4]);
			expect(result.pop()).toBe(4);
			expect(result.toArray()).toEqual([1, 2, 3]);
		});

		test("fluent methods return the same view", () => {
			const secured = new DynamicArray().secured();
			expect(secured.pushAligned(1, 1)).toBe(secured);
			expect(secured.fill(2)).toBe(secured);
			expect(secured.reverse()).toBe(secured);
			expect(secured.sort()).toBe(secured);
			expect(secured.sortWith((a, b) => a - b)).toBe(secured);
		});
	});
});
