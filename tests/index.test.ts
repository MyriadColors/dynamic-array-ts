import { describe, expect, test } from "bun:test";
import { DynamicArray, SerializedDynamicArray } from "../index";

describe("DynamicArray Basic Operations", () => {
	test("push() should add elements to the end", () => {
		const arr = new DynamicArray<Uint8ArrayConstructor>();
		expect(arr.push(10)).toBe(1);
		expect(arr.push(20, 30)).toBe(3);
		expect(arr.length).toBe(3);
		expect(arr.get(0)).toBe(10);
		expect(arr.get(1)).toBe(20);
		expect(arr.get(2)).toBe(30);
	});

	test("pop() should remove and return the last element", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		expect(arr.pop()).toBe(3);
		expect(arr.length).toBe(2);
		expect(arr.pop()).toBe(2);
		expect(arr.pop()).toBe(1);
		expect(arr.pop()).toBeUndefined();
		expect(arr.length).toBe(0);
	});

	test("unshift() should add elements to the beginning", () => {
		const arr = new DynamicArray();
		arr.push(10);
		expect(arr.unshift(20, 30)).toBe(3);
		expect(arr.toArray()).toEqual([20, 30, 10]);
		expect(arr.length).toBe(3);
	});

	test("shift() should remove and return the first element", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		expect(arr.shift()).toBe(1);
		expect(arr.toArray()).toEqual([2, 3]);
		expect(arr.length).toBe(2);
		expect(arr.shift()).toBe(2);
		expect(arr.shift()).toBe(3);
		expect(arr.shift()).toBeUndefined();
	});

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
});

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

	test("truncate() should reduce length and trigger shrink if necessary", () => {
		const arr = new DynamicArray(40);
		for (let i = 0; i < 40; i++) arr.push(i);

		arr.truncate(5);
		expect(arr.length).toBe(5);
		// 40 -> 20 -> 10 (multiple shrinks might trigger or just one depending on implementation)
		// Implementation check: truncate calls shouldShrink which checks 5 < 40 * 0.25
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
		// We can't easily test system memory limits, but we can test the constructor check
		expect(() => new DynamicArray(100, 50)).toThrow(RangeError);

		// Test growth limit if supported by the environment's ArrayBuffer
		const arr = new DynamicArray(5, 10);
		arr.push(1, 2, 3, 4, 5);
		// Next push would try to grow to 10.
		arr.push(6);
		expect(arr.capacity).toBeLessThanOrEqual(10);
	});
});

describe("DynamicArray Slicing & Searching", () => {
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

	test("searching methods should find elements correctly", () => {
		const arr = new DynamicArray();
		arr.push(10, 20, 30, 20, 10);

		expect(arr.indexOf(20)).toBe(1);
		expect(arr.lastIndexOf(20)).toBe(3);
		expect(arr.indexOf(40)).toBe(-1);
		expect(arr.includes(30)).toBe(true);
		expect(arr.includes(50)).toBe(false);
	});
});

describe("DynamicArray Functional Methods", () => {
	test("forEach() should iterate over all elements", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		const result: number[] = [];
		for (const val of arr) {
			result.push(val);
		}
		expect(result).toEqual([1, 2, 3]);
	});
	test("map() should transform elements", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		const doubled = arr.map((val) => val * 2);
		expect(doubled.toArray()).toEqual([2, 4, 6]);
	});

	test("map() should support changing TypedArray type", () => {
		const arr = new DynamicArray<Uint8ArrayConstructor>(
			10,
			Infinity,
			Uint8Array,
		);
		arr.push(1, 2, 3);
		// Map Uint8 to Float64
		const floatArr = arr.map((val) => val + 0.5, Float64Array);
		expect(floatArr.get(0)).toBe(1.5);
		expect(floatArr.toArray()).toEqual([1.5, 2.5, 3.5]);
	});

	test("filter() should return elements matching predicate", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3, 4, 5);
		const even = arr.filter((val) => val % 2 === 0);
		expect(even.toArray()).toEqual([2, 4]);
	});

	test("reduce() should accumulate values", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3, 4);
		const sum = arr.reduce((acc, val) => acc + val, 0);
		expect(sum).toBe(10);
	});

	test("predicates (find, findIndex, some, every) should work", () => {
		const arr = new DynamicArray();
		arr.push(10, 20, 30);

		expect(arr.find((v) => v > 15)).toBe(20);
		expect(arr.findIndex((v) => v > 15)).toBe(1);
		expect(arr.some((v) => v === 20)).toBe(true);
		expect(arr.every((v) => v > 5)).toBe(true);
		expect(arr.every((v) => v > 15)).toBe(false);
	});
});

describe("DynamicArray In-place Modifications", () => {
	test("reverse() should reverse elements in-place", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		arr.reverse();
		expect(arr.toArray()).toEqual([3, 2, 1]);
	});

	test("sort() should sort elements in-place", () => {
		const arr = new DynamicArray();
		arr.push(30, 10, 20);
		arr.sort();
		expect(arr.toArray()).toEqual([10, 20, 30]);

		// With comparator
		arr.sort((a, b) => b - a);
		expect(arr.toArray()).toEqual([30, 20, 10]);
	});

	test("nativeSort() should use the underlying typed array sort", () => {
		const arr = new DynamicArray();
		arr.push(3, 1, 2);
		arr.nativeSort();
		expect(arr.toArray()).toEqual([1, 2, 3]);
	});

	test("splice() should remove elements correctly", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3, 4, 5);
		const deleted = arr.splice(1, 2);
		expect(deleted).toEqual([2, 3]);
		expect(arr.toArray()).toEqual([1, 4, 5]);
		expect(arr.length).toBe(3);
	});

	test("splice() should insert elements correctly", () => {
		const arr = new DynamicArray();
		arr.push(1, 4);
		arr.splice(1, 0, 2, 3);
		expect(arr.toArray()).toEqual([1, 2, 3, 4]);
		expect(arr.length).toBe(4);
	});

	test("splice() should handle simultaneous deletion and insertion", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 5);
		const deleted = arr.splice(1, 1, 3, 4);
		expect(deleted).toEqual([2]);
		expect(arr.toArray()).toEqual([1, 3, 4, 5]);
		expect(arr.length).toBe(4);
	});

	test("splice() should trigger growth and shrinking", () => {
		const arr = new DynamicArray(20);
		for (let i = 0; i < 20; i++) arr.push(i);

		// Trigger growth via splice
		arr.splice(1, 0, 100, 101);
		expect(arr.capacity).toBe(40); // 20 * 2

		// Trigger shrink via splice
		// Need to drop below 25% of 40 = 10 elements.
		arr.splice(0, 15);
		expect(arr.length).toBe(7);
		expect(arr.capacity).toBe(20); // 40 / 2
	});
});

describe("DynamicArray Multi-type Support", () => {
	test("should work with Float64Array", () => {
		const arr = new DynamicArray(5, Infinity, Float64Array);
		arr.push(1.5, 2.5, 3.5);
		expect(arr.get(0)).toBe(1.5);
		expect(arr.get(2)).toBe(3.5);
		expect(arr.toArray()).toEqual([1.5, 2.5, 3.5]);
	});

	test("should work with BigInt64Array", () => {
		const arr = new DynamicArray(5, Infinity, BigInt64Array);
		arr.push(100n, 200n, 300n);
		expect(arr.get(0)).toBe(100n);
		expect(arr.at(-1)).toBe(300n);
		expect(arr.toArray()).toEqual([100n, 200n, 300n]);
	});
});

describe("SerializedDynamicArray", () => {
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

	test("clear() should reset everything", () => {
		const sda = new SerializedDynamicArray();
		sda.pushObject({ a: 1 });
		sda.clear();
		expect(sda.length()).toBe(0);
		expect(() => sda.popObject()).toThrow();
	});
});
