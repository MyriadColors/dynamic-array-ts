/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray.from()", () => {
	describe("from plain Array", () => {
		test("should create DynamicArray from number array", () => {
			const arr = DynamicArray.from([1, 2, 3], Float64Array);
			expect(arr.length).toBe(3);
			expect(arr.toArray()).toEqual([1, 2, 3]);
		});

		test("should create DynamicArray from empty array", () => {
			const arr = DynamicArray.from([], Float32Array);
			expect(arr.length).toBe(0);
			expect(arr.isEmpty).toBe(true);
		});

		test("should create DynamicArray with single element", () => {
			const arr = DynamicArray.from([42], Uint8Array);
			expect(arr.length).toBe(1);
			expect(arr.get(0)).toBe(42);
		});

		test("should create DynamicArray from float values", () => {
			const arr = DynamicArray.from([1.5, 2.5, 3.5], Float32Array);
			expect(arr.length).toBe(3);
			expect(arr.toArray()).toEqual([1.5, 2.5, 3.5]);
		});
	});

	describe("from TypedArray", () => {
		test("should create DynamicArray from Float64Array", () => {
			const source = new Float64Array([1.1, 2.2, 3.3]);
			const arr = DynamicArray.from(source, Float64Array);
			expect(arr.length).toBe(3);
			expect(arr.toArray()).toEqual([1.1, 2.2, 3.3]);
		});

		test("should create DynamicArray from Uint8Array", () => {
			const source = new Uint8Array([10, 20, 30, 40]);
			const arr = DynamicArray.from(source, Uint8Array);
			expect(arr.length).toBe(4);
			expect(arr.toArray()).toEqual([10, 20, 30, 40]);
		});

		test("should create DynamicArray from Int32Array", () => {
			const source = new Int32Array([-1, 0, 1, -100]);
			const arr = DynamicArray.from(source, Int32Array);
			expect(arr.length).toBe(4);
			expect(arr.toArray()).toEqual([-1, 0, 1, -100]);
		});
	});

	describe("from Iterable", () => {
		test("should create DynamicArray from Set", () => {
			const source = new Set([1, 2, 3]);
			const arr = DynamicArray.from(source, Float64Array);
			expect(arr.length).toBe(3);
			const sorted = arr.toArray().sort();
			expect(sorted).toEqual([1, 2, 3]);
		});

		test("should create DynamicArray from Map.values()", () => {
			const source = new Map([
				["a", 10],
				["b", 20],
			]);
			const arr = DynamicArray.from(source.values(), Float64Array);
			expect(arr.length).toBe(2);
			expect(arr.toArray()).toContain(10);
			expect(arr.toArray()).toContain(20);
		});

		test("should create DynamicArray from Generator", () => {
			function* generateNumbers() {
				yield 1;
				yield 2;
				yield 3;
			}
			const arr = DynamicArray.from(generateNumbers(), Float64Array);
			expect(arr.length).toBe(3);
			expect(arr.toArray()).toEqual([1, 2, 3]);
		});

		test("should create DynamicArray from custom Iterable", () => {
			const customIterable = {
				*[Symbol.iterator]() {
					yield 100;
					yield 200;
				},
			};
			const arr = DynamicArray.from(customIterable, Float64Array);
			expect(arr.length).toBe(2);
			expect(arr.toArray()).toEqual([100, 200]);
		});
	});

	describe("from ArrayLike", () => {
		test("should create DynamicArray from ArrayLike object", () => {
			const source = { 0: 5, 1: 10, 2: 15, length: 3 };
			const arr = DynamicArray.from(source, Float64Array);
			expect(arr.length).toBe(3);
			expect(arr.toArray()).toEqual([5, 10, 15]);
		});

		test("should create DynamicArray from arguments", () => {
			function createFromArgs(...args: number[]) {
				return DynamicArray.from(args, Float64Array);
			}
			const arr = createFromArgs(7, 8, 9);
			expect(arr.length).toBe(3);
			expect(arr.toArray()).toEqual([7, 8, 9]);
		});
	});

	describe("with options", () => {
		test("should use initialCapacity when provided", () => {
			const arr = DynamicArray.from([1, 2], Float64Array, {
				initialCapacity: 100,
			});
			expect(arr.length).toBe(2);
			expect(arr.capacity).toBe(100);
		});

		test("should use maxCapacity when provided", () => {
			const arr = DynamicArray.from([1, 2, 3], Float64Array, {
				maxCapacity: 5,
			});
			expect(arr.length).toBe(3);
			expect(arr.maxCapacity).toBe(5);
		});

		test("should use both initialCapacity and maxCapacity", () => {
			const arr = DynamicArray.from([1, 2, 3], Float64Array, {
				initialCapacity: 50,
				maxCapacity: 100,
			});
			expect(arr.length).toBe(3);
			expect(arr.capacity).toBe(50);
			expect(arr.maxCapacity).toBe(100);
		});

		test("initialCapacity should default to source length", () => {
			const arr = DynamicArray.from([1, 2, 3, 4, 5], Float64Array);
			expect(arr.length).toBe(5);
			expect(arr.capacity).toBe(5);
		});
	});

	describe("type correctness", () => {
		test("should preserve Uint8Array type", () => {
			const arr = DynamicArray.from([255, 128, 0], Uint8Array);
			expect(arr.get(0)).toBe(255);
			expect(arr.get(1)).toBe(128);
			expect(arr.get(2)).toBe(0);
		});

		test("should preserve Float32Array precision", () => {
			const source = new Float32Array([0.123456789, 1.0000001]);
			const arr = DynamicArray.from(source, Float32Array);
			expect(arr.get(0)).toBeCloseTo(0.123456789, 6);
		});

		test("should handle negative values with Int16Array", () => {
			const arr = DynamicArray.from([-32768, -1, 0, 1, 32767], Int16Array);
			expect(arr.toArray()).toEqual([-32768, -1, 0, 1, 32767]);
		});
	});

	describe("edge cases", () => {
		test("should handle large arrays", () => {
			const source = Array.from({ length: 10000 }, (_, i) => i);
			const arr = DynamicArray.from(source, Float64Array);
			expect(arr.length).toBe(10000);
			expect(arr.get(0)).toBe(0);
			expect(arr.get(9999)).toBe(9999);
		});

		test("should handle sparse-like ArrayLike with gaps", () => {
			const source: { length: number; [index: number]: number } = {
				length: 5,
				0: 1,
				2: 3,
				4: 5,
			};
			const arr = DynamicArray.from(source, Float64Array);
			expect(arr.length).toBe(5);
			expect(arr.get(0)).toBe(1);
			expect(Number.isNaN(arr.get(1))).toBe(true);
			expect(arr.get(2)).toBe(3);
			expect(Number.isNaN(arr.get(3))).toBe(true);
			expect(arr.get(4)).toBe(5);
		});
	});
});
