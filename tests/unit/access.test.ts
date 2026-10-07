/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Access & Search Operations", () => {
	test("get() and set() should work within bounds", () => {
		const arr = new DynamicArray();
		arr.push(1, 2);
		arr.set(1, 10);
		expect(arr.get(1)).toBe(10);
	});

	test("get() and set() should throw RangeError for out-of-bounds", () => {
		const arr = new DynamicArray();
		arr.push(1);
		expect(() => arr.get(1)).toThrow(RangeError);
		expect(() => arr.get(-1)).toThrow(RangeError);
		expect(() => arr.set(1, 10)).toThrow(RangeError);
		expect(() => arr.set(-1, 10)).toThrow(RangeError);
	});

	test("at() should support positive and negative indices", () => {
		const arr = new DynamicArray();
		arr.push(10, 20, 30);
		expect(arr.at(0)).toBe(10);
		expect(arr.at(2)).toBe(30);
		expect(arr.at(-1)).toBe(30);
		expect(arr.at(-3)).toBe(10);
		expect(arr.at(3)).toBeUndefined();
		expect(arr.at(-4)).toBeUndefined();
	});

	test("searching methods should find elements correctly", () => {
		const arr = new DynamicArray();
		arr.push(10, 20, 30, 20, 10);

		expect(arr.indexOf(20)).toBe(1);
		expect(arr.lastIndexOf(20)).toBe(3);
		expect(arr.indexOf(40)).toBe(-1);
		expect(arr.includes(30)).toBe(true);
		expect(arr.includes(50)).toBe(false);
	});

	test("slice() should return a new DynamicArray with copied elements", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3, 4, 5);
		const sliced = arr.slice(1, 4);

		expect(sliced.length).toBe(3);
		expect(sliced.toArray()).toEqual([2, 3, 4]);
		expect(sliced).not.toBe(arr);

		// Negative indices
		expect(arr.slice(-2).toArray()).toEqual([4, 5]);
	});

	test("concat() should return a new DynamicArray combining two arrays", () => {
		const arr1 = new DynamicArray();
		arr1.push(1, 2);
		const arr2 = new DynamicArray();
		arr2.push(3, 4);

		const combined = arr1.concat(arr2);
		expect(combined.length).toBe(4);
		expect(combined.toArray()).toEqual([1, 2, 3, 4]);
	});

	test("isEmpty should correctly report status", () => {
		const arr = new DynamicArray();
		expect(arr.isEmpty).toBe(true);
		arr.push(1);
		expect(arr.isEmpty).toBe(false);
		arr.pop();
		expect(arr.isEmpty).toBe(true);
	});

	test("peekFront() and peekBack() should return elements without removing them", () => {
		const arr = new DynamicArray();
		expect(arr.peekFront()).toBeUndefined();
		expect(arr.peekBack()).toBeUndefined();

		arr.push(1, 2, 3);
		expect(arr.peekFront()).toBe(1);
		expect(arr.peekBack()).toBe(3);
		expect(arr.length).toBe(3);

		arr.shift();
		expect(arr.peekFront()).toBe(2);
		expect(arr.peekBack()).toBe(3);
	});

	test("timingSafeIndexOf() should correctly find elements or return -1", () => {
		const arr = new DynamicArray();
		arr.push(10, 20, 30, 20, 10);

		expect(arr.timingSafeIndexOf(20)).toBe(1);
		expect(arr.timingSafeIndexOf(10)).toBe(0);
		expect(arr.timingSafeIndexOf(30)).toBe(2);
		expect(arr.timingSafeIndexOf(40)).toBe(-1);

		// With fromIndex
		expect(arr.timingSafeIndexOf(20, 2)).toBe(3);
		expect(arr.timingSafeIndexOf(10, 1)).toBe(4);
		expect(arr.timingSafeIndexOf(10, -2)).toBe(4);

		// Empty array
		const empty = new DynamicArray();
		expect(empty.timingSafeIndexOf(5)).toBe(-1);

		// With _head offset
		arr.shift(); // removes 10, head becomes 1
		expect(arr.timingSafeIndexOf(20)).toBe(0);
		expect(arr.timingSafeIndexOf(30)).toBe(1);
		expect(arr.timingSafeIndexOf(10)).toBe(3);
	});

	test("timingSafeIndexOf() should work with BigInt typed arrays", () => {
		const arr = new DynamicArray(5, Infinity, BigUint64Array);
		arr.push(100n, 200n, 300n);
		expect(arr.timingSafeIndexOf(200n)).toBe(1);
		expect(arr.timingSafeIndexOf(999n)).toBe(-1);
	});

	test("timingSafeIndexOf() on secured view delegates properly", () => {
		const arr = new DynamicArray();
		arr.push(5, 15, 25);
		const sec = arr.secured();
		expect(sec.timingSafeIndexOf(15)).toBe(1);
		expect(sec.timingSafeIndexOf(99)).toBe(-1);
	});
});
