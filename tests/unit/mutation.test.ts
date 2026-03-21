/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray.from() Factory", () => {
	test("should create DynamicArray from an array", () => {
		const floats = DynamicArray.from([1.0, 2.5, 3.14], Float32Array);
		expect(floats.length).toBe(3);
		expect(floats.get(0)).toBe(1.0);
		expect(floats.get(1)).toBe(2.5);
		expect(floats.get(2)).toBeCloseTo(3.14);
	});

	test("should create DynamicArray from a TypedArray", () => {
		const source = new Float64Array([1.1, 2.2, 3.3]);
		const copy = DynamicArray.from(source, Float64Array);
		expect(copy.length).toBe(3);
		expect(copy.get(0)).toBe(1.1);
	});

	test("should create DynamicArray from an iterable", () => {
		function* generate() {
			yield 10;
			yield 20;
			yield 30;
		}
		const arr = DynamicArray.from(generate(), Uint8Array);
		expect(arr.length).toBe(3);
		expect(arr.toArray()).toEqual([10, 20, 30]);
	});

	test("should respect initialCapacity option", () => {
		const arr = DynamicArray.from([1, 2], Uint16Array, {
			initialCapacity: 100,
		});
		expect(arr.length).toBe(2);
		expect(arr.capacity).toBe(100);
	});

	test("should respect maxCapacity option", () => {
		const arr = DynamicArray.from([1, 2, 3], Uint8Array, {
			initialCapacity: 5,
			maxCapacity: 10,
		});
		expect(arr.length).toBe(3);
		expect(arr.maxCapacity).toBe(10);
	});

	test("should work with bigint arrays", () => {
		const arr = DynamicArray.from([1n, 2n, 3n], BigUint64Array);
		expect(arr.length).toBe(3);
		expect(arr.get(0)).toBe(1n);
	});
});

describe("DynamicArray Mutation Operations", () => {
	test("push() should add elements to the end", () => {
		const arr = new DynamicArray<Uint8ArrayConstructor>();
		expect(arr.push(10)).toBe(1);
		expect(arr.push(20, 30)).toBe(3);
		expect(arr.length).toBe(3);
		expect(arr.get(0)).toBe(10);
		expect(arr.get(1)).toBe(20);
		expect(arr.get(2)).toBe(30);
	});

	test("push() should handle bulk insertions with ArrayLike objects", () => {
		const arr = new DynamicArray();
		arr.push(1);
		// Push an array
		arr.push([2, 3, 4]);
		// Push a TypedArray
		arr.push(new Uint8Array([5, 6]));

		expect(arr.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
		expect(arr.length).toBe(6);
	});

	test("pushAligned() should pad elements to reach alignment", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1); // length 1
		arr.pushAligned(4, 2, 3); // needs 3 padding zeros: [1, 0, 0, 0, 2, 3]
		expect(arr.toArray()).toEqual([1, 0, 0, 0, 2, 3]);
		expect(arr.length).toBe(6);

		arr.pushAligned(4, 4); // needs 2 padding zeros: [1, 0, 0, 0, 2, 3, 0, 0, 4]
		expect(arr.length).toBe(9);
		expect(arr.get(8)).toBe(4);
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

	test("unshift() should use O(1) fast path when head space is available", () => {
		const arr = new DynamicArray(10, Infinity, Int32Array);
		arr.push(1, 2, 3);
		arr.shift(); // head 1
		arr.unshift(0); // fast path: 1 <= 1
		expect(arr.toArray()).toEqual([0, 2, 3]);
		arr.unshift(-1); // fast path: 1 <= 1
		expect(arr.toArray()).toEqual([-1, 0, 2, 3]);
	});

	test("unshift() bulk fast path: multiple elements fit in head space", () => {
		const arr = new DynamicArray(10);
		arr.push(5, 6, 7, 8, 9);
		arr.shift();
		arr.shift();
		arr.shift(); // head 3
		arr.unshift(1, 2, 3); // fast path: 3 <= 3, writes at head
		expect(arr.toArray()).toEqual([1, 2, 3, 8, 9]);
	});

	test("unshift() falls back to copyWithin when head space is insufficient", () => {
		const arr = new DynamicArray(10);
		arr.push(5, 6, 7);
		arr.shift(); // head 1
		arr.unshift(1, 2, 3, 4); // 4 > 1, slow path: compact then copyWithin
		expect(arr.toArray()).toEqual([1, 2, 3, 4, 6, 7]);
	});

	test("shift() should remove and return the first element and update _head", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		expect(arr.shift()).toBe(1);
		expect(arr.toArray()).toEqual([2, 3]);
		expect(arr.length).toBe(2);
		// Internal check via toArray/get
		expect(arr.get(0)).toBe(2);
	});

	test("compact() should move elements to the start and reset _head", () => {
		const arr = new DynamicArray(10);
		arr.push(1, 2, 3, 4, 5);
		arr.shift();
		arr.shift();
		// length 3, _head 2
		expect(arr.length).toBe(3);

		arr.compact();
		expect(arr.length).toBe(3);
		expect(arr.toArray()).toEqual([3, 4, 5]);

		// Verify we can still push correctly after compact
		arr.push(6);
		expect(arr.toArray()).toEqual([3, 4, 5, 6]);
	});

	test("exhaustive _head logic: mixing push/pop/shift/unshift", () => {
		const arr = new DynamicArray(10);

		arr.push(1, 2, 3); // [1, 2, 3], head 0
		arr.shift(); // [2, 3], head 1
		arr.unshift(0); // [0, 2, 3], head 0 (fast path: uses head space)
		arr.push(4, 5); // [0, 2, 3, 4, 5], head 0
		arr.shift(); // [2, 3, 4, 5], head 1
		arr.shift(); // [3, 4, 5], head 2
		arr.shift(); // [4, 5], head 3

		expect(arr.toArray()).toEqual([4, 5]);

		arr.pop(); // [4], head 3, len 1
		expect(arr.toArray()).toEqual([4]);

		for (let i = 0; i < 3; i++) arr.shift(); // empty, head resets to 0
		arr.push(1, 2, 3, 4, 5, 6);
		arr.shift();
		arr.shift();
		arr.shift(); // head 3. 3 > 10 * 0.2 is TRUE.

		arr.push(7); // Should trigger compact
		expect(arr.toArray()).toEqual([4, 5, 6, 7]);
	});

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
	});

	test("sortWith() should sort with a custom comparator", () => {
		const arr = new DynamicArray();
		arr.push(30, 10, 20);
		arr.sortWith((a, b) => b - a);
		expect(arr.toArray()).toEqual([30, 20, 10]);
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
		arr.splice(1, 0, {}, 2, 3);
		expect(arr.toArray()).toEqual([1, 2, 3, 4]);
		expect(arr.length).toBe(4);
	});

	test("splice() should handle simultaneous deletion and insertion", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 5);
		const deleted = arr.splice(1, 1, {}, 3, 4);
		expect(deleted).toEqual([2]);
		expect(arr.toArray()).toEqual([1, 3, 4, 5]);
		expect(arr.length).toBe(4);
	});

	test("clear() should reset length", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		arr.clear();
		expect(arr.length).toBe(0);
		expect(arr.toArray()).toEqual([]);
	});

	test("truncate() should reduce length", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3, 4, 5);
		arr.truncate(3);
		expect(arr.length).toBe(3);
		expect(arr.toArray()).toEqual([1, 2, 3]);
	});

	describe("BigInt zero-fill operations", () => {
		test("safeClear() should work with BigUint64Array", () => {
			const arr = new DynamicArray<BigUint64ArrayConstructor>(
				10,
				Infinity,
				BigUint64Array,
			);
			arr.push(1n, 2n, 3n);
			expect(arr.length).toBe(3);
			arr.safeClear();
			expect(arr.length).toBe(0);
			expect(arr.isEmpty).toBe(true);
		});

		test("safeClear() should work with BigInt64Array", () => {
			const arr = new DynamicArray<BigInt64ArrayConstructor>(
				10,
				Infinity,
				BigInt64Array,
			);
			arr.push(1n, -2n, 3n);
			expect(arr.length).toBe(3);
			arr.safeClear();
			expect(arr.length).toBe(0);
			expect(arr.isEmpty).toBe(true);
		});

		test("pushAligned() should work with BigUint64Array", () => {
			const arr = new DynamicArray<BigUint64ArrayConstructor>(
				10,
				Infinity,
				BigUint64Array,
			);
			arr.pushAligned(4, 1n, 2n);
			expect(arr.length).toBe(2);
			expect(arr.get(0)).toBe(1n);
			expect(arr.get(1)).toBe(2n);
		});

		test("pushAligned() should pad with BigUint64Array when needed", () => {
			const arr = new DynamicArray<BigUint64ArrayConstructor>(
				10,
				Infinity,
				BigUint64Array,
			);
			arr.push(1n);
			arr.pushAligned(4, 2n, 3n);
			expect(arr.length).toBe(6);
			expect(arr.get(0)).toBe(1n);
			expect(arr.get(1)).toBe(0n);
			expect(arr.get(2)).toBe(0n);
			expect(arr.get(3)).toBe(0n);
			expect(arr.get(4)).toBe(2n);
			expect(arr.get(5)).toBe(3n);
		});

		test("pushAligned() should work with BigInt64Array", () => {
			const arr = new DynamicArray<BigInt64ArrayConstructor>(
				10,
				Infinity,
				BigInt64Array,
			);
			arr.pushAligned(4, -1n);
			expect(arr.length).toBe(1);
			expect(arr.get(0)).toBe(-1n);
		});

		test("pushAligned() should pad with BigInt64Array when needed", () => {
			const arr = new DynamicArray<BigInt64ArrayConstructor>(
				10,
				Infinity,
				BigInt64Array,
			);
			arr.push(1n);
			arr.pushAligned(4, -1n);
			expect(arr.length).toBe(5);
			expect(arr.get(0)).toBe(1n);
			expect(arr.get(1)).toBe(0n);
			expect(arr.get(2)).toBe(0n);
			expect(arr.get(3)).toBe(0n);
			expect(arr.get(4)).toBe(-1n);
		});

		test("safeTruncate() should work with BigUint64Array", () => {
			const arr = new DynamicArray<BigUint64ArrayConstructor>(
				10,
				Infinity,
				BigUint64Array,
			);
			arr.push(1n, 2n, 3n, 4n, 5n);
			arr.safeTruncate(3);
			expect(arr.length).toBe(3);
			expect(arr.toArray()).toEqual([1n, 2n, 3n]);
		});

		test("safePop() should work with BigInt64Array", () => {
			const arr = new DynamicArray<BigInt64ArrayConstructor>(
				10,
				Infinity,
				BigInt64Array,
			);
			arr.push(1n, 2n, 3n);
			const popped = arr.safePop();
			expect(popped).toBe(3n);
			expect(arr.length).toBe(2);
		});

		test("safeShift() should work with BigInt64Array", () => {
			const arr = new DynamicArray<BigInt64ArrayConstructor>(
				10,
				Infinity,
				BigInt64Array,
			);
			arr.push(1n, 2n, 3n);
			const shifted = arr.safeShift();
			expect(shifted).toBe(1n);
			expect(arr.length).toBe(2);
			expect(arr.toArray()).toEqual([2n, 3n]);
		});

		test("compact() should work with BigUint64Array", () => {
			const arr = new DynamicArray<BigUint64ArrayConstructor>(
				10,
				Infinity,
				BigUint64Array,
			);
			arr.push(1n, 2n, 3n);
			arr.shift();
			arr.shift();
			expect(arr.length).toBe(1);
			arr.compact();
			expect(arr.length).toBe(1);
			expect(arr.toArray()).toEqual([3n]);
		});
	});
});
