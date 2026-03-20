/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Functional Methods", () => {
	test("forEach() should iterate over all elements", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		const result: number[] = [];
		// biome-ignore lint/complexity/noForEach: we are testing forEach specifically
		arr.forEach((val) => {
			result.push(val);
		});
		expect(result).toEqual([1, 2, 3]);
	});

	test("Symbol.iterator should support for...of loops", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		const result: number[] = [];
		for (const val of arr) {
			result.push(val);
		}
		expect(result).toEqual([1, 2, 3]);
	});

	test("forEachStable() should iterate over all elements", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		const result: number[] = [];
		arr.forEachStable((val) => {
			result.push(val);
		});
		expect(result).toEqual([1, 2, 3]);
	});

	test("forEachStable() should not see elements added after call start", () => {
		const arr = new DynamicArray<Uint8ArrayConstructor>(
			10,
			Infinity,
			Uint8Array,
		);
		arr.push(1, 2, 3);
		const visited: number[] = [];
		arr.forEachStable((val) => {
			visited.push(val);
			arr.push(val + 10);
		});
		expect(visited).toEqual([1, 2, 3]);
	});

	test("forEachStable() should iterate over a snapshot unaffected by mutations", () => {
		const arr = new DynamicArray();
		arr.push(10, 20, 30, 40, 50);
		const visited: number[] = [];
		arr.forEachStable((val) => {
			visited.push(val);
			if (val === 10) {
				arr.shift();
				arr.shift();
			}
		});
		expect(visited).toEqual([10, 20, 30, 40, 50]);
	});

	test("forEachStable() should pass correct index to callback", () => {
		const arr = new DynamicArray();
		arr.push(100, 200, 300);
		const indices: number[] = [];
		arr.forEachStable((_, i) => {
			indices.push(i);
		});
		expect(indices).toEqual([0, 1, 2]);
	});

	test("forEachSnapshot() should be an alias for forEachStable()", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		const stable: number[] = [];
		const snapshot: number[] = [];
		arr.forEachStable((val) => stable.push(val));
		arr.forEachSnapshot((val) => snapshot.push(val));
		expect(snapshot).toEqual(stable);
	});

	test("forEachSnapshot() should see snapshot of values", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		const capturedValues: number[] = [];
		arr.forEachSnapshot((val) => {
			capturedValues.push(val);
		});
		arr.set(0, 999);
		expect(capturedValues).toEqual([1, 2, 3]);
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
