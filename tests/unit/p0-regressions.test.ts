/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: regression suite */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../src/dynamic-array";
import { DynamicArrayDeque } from "../../src/deque";

describe("P0 & P1 Regression Test Suite", () => {
	describe("P0.1: Head offset overflow and data loss during push and pushAligned", () => {
		test("scalar push accounts for _head + newLength without dropping data or throwing RangeError", () => {
			const a = new DynamicArray(10, 10, Uint8Array);
			a.push([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
			a.shift();
			a.shift();
			// head is now 2, length is 8. Pushing 99 requires length 9.
			// _head + newLength = 2 + 9 = 11 > 10. Needs compaction before storing!
			a.push(99);
			expect(a.length).toBe(9);
			expect(a.at(-1)).toBe(99);
			expect(a.toArray()).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 99]);
		});

		test("array-like push accounts for _head + newLength without throwing", () => {
			const a = new DynamicArray(10, 10, Uint8Array);
			a.push([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
			a.shift();
			a.shift();
			a.push([98, 99]);
			expect(a.length).toBe(10);
			expect(a.at(-1)).toBe(99);
			expect(a.toArray()).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 98, 99]);
		});

		test("pushAligned accounts for _head + newLength with padding", () => {
			const a = new DynamicArray(10, 10, Uint8Array);
			a.push([1, 2, 3, 4, 5]);
			a.shift(); // head 1, length 4
			a.pushAligned(4, 99); // length 4 is aligned to 4, 0 padding, push 99 -> new length 5, head 1 -> total 6 <= 10
			expect(a.at(-1)).toBe(99);
			expect(() => a.pushAligned(0, 1)).toThrow(RangeError);
			expect(() => a.pushAligned(-4, 1)).toThrow(RangeError);
		});
	});

	describe("P0.2: clear / truncate / pop reset _head when empty", () => {
		test("clear resets _head to 0", () => {
			const a = new DynamicArray(10, 10, Uint8Array);
			a.push([1, 2, 3, 4, 5, 6, 7, 8]);
			a.shift();
			a.shift();
			a.clear();
			expect(a.length).toBe(0);
			a.push(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
			expect(a.length).toBe(10);
			expect(a.toArray().length).toBe(10);
		});

		test("truncate(0) resets _head to 0", () => {
			const a = new DynamicArray(10, 10, Uint8Array);
			a.push(1, 2, 3, 4);
			a.shift();
			a.shift();
			a.truncate(0);
			expect(a.length).toBe(0);
			a.push(10, 20);
			expect(a.toArray()).toEqual([10, 20]);
		});

		test("pop until empty resets _head to 0", () => {
			const a = new DynamicArray(10, 10, Uint8Array);
			a.push(1, 2);
			a.shift(); // head 1, length 1
			a.pop(); // length 0 -> head should be 0
			a.push(99);
			expect(a.toArray()).toEqual([99]);
		});
	});

	describe("P0.3: SAFE_OVERRIDES prototype safety", () => {
		test("secured() view does not throw on Object.prototype methods", () => {
			const arr = new DynamicArray();
			arr.push(1, 2, 3);
			const sec = arr.secured();
			expect(typeof sec.toString()).toBe("string");
			expect(sec.toString()).toBe("1,2,3");
			expect(() => sec.valueOf()).not.toThrow();
			expect(sec.hasOwnProperty).toBeDefined();
		});
	});

	describe("P0.4: secured() strict sandbox security boundary", () => {
		test("secured() view blocks raw buffer accessors and private properties", () => {
			const arr = new DynamicArray();
			arr.push(1, 2, 3);
			const sec = arr.secured();

			expect(Reflect.get(sec, "_buffer")).toBeUndefined();
			expect(Reflect.get(sec, "_head")).toBeUndefined();
			expect(Reflect.get(sec, "_length")).toBeUndefined();
			expect(Reflect.get(sec, "buffer")).toBeUndefined();
			expect(Reflect.get(sec, "view")).toBeUndefined();
			expect(Reflect.get(sec, "raw")).toBeUndefined();
			expect(Reflect.get(sec, "getRawBuffer")).toBeUndefined();
			expect(Reflect.get(sec, "withRaw")).toBeUndefined();
			expect(Reflect.get(sec, "withBuffer")).toBeUndefined();
		});
	});

	describe("P0.5: fromStructured strict validation and allowlist", () => {
		test("rejects malformed snapshots and arbitrary constructors", () => {
			expect(() =>
				DynamicArray.fromStructured({
					__isDynamicArray: true,
					buffer: new ArrayBuffer(8),
					length: 100,
					capacity: 8,
					maxCapacity: Infinity,
					head: 0,
					type: "Uint8Array",
					debug: false,
				}),
			).toThrow();

			expect(() =>
				DynamicArray.fromStructured({
					__isDynamicArray: true,
					buffer: new ArrayBuffer(8),
					length: 1,
					capacity: 8,
					maxCapacity: Infinity,
					head: 0,
					type: "Object",
					debug: false,
				}),
			).toThrow();
		});
	});

	describe("P0.6: LazyChain operation state independence", () => {
		test("take() produces independent state on repeated iterations", () => {
			const arr = new DynamicArray();
			arr.push(1, 2, 3, 4);
			const c = arr.lazy().take(2);
			expect(Array.from(c)).toEqual([1, 2]);
			expect(Array.from(c)).toEqual([1, 2]);
		});

		test("branched operations do not corrupt base or sibling chain state", () => {
			const arr = new DynamicArray();
			arr.push(10, 20, 30, 40);
			const base = arr.lazy().map((_v, i) => i);
			expect(base.take(2).toArray()).toEqual([0, 1]);
			expect(base.toArray()).toEqual([0, 1, 2, 3]);
		});

		test("sum() works with BigInt typed arrays", () => {
			const arr = new DynamicArray(5, Infinity, BigUint64Array);
			arr.push(10n, 20n, 30n);
			expect(arr.lazy().sum()).toBe(60n);
		});
	});

	describe("P1: API and behavior fixes", () => {
		test("lastIndexOf with negative fromIndex normalizes correctly", () => {
			const arr = new DynamicArray();
			arr.push(10, 20, 30, 20, 10);
			expect(arr.lastIndexOf(10, -1)).toBe(4);
			expect(arr.lastIndexOf(20, -2)).toBe(3);
			expect(arr.lastIndexOf(99, -1)).toBe(-1);
		});

		test("Deque pushFront follows unshift semantics", () => {
			const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
			deque.pushFront(1, 2);
			expect(deque.toArray()).toEqual([1, 2]);
			deque.pushFront(10, 20);
			expect(deque.toArray()).toEqual([10, 20, 1, 2]);
		});

		test("Deque rejects non-positive initial capacity", () => {
			expect(() => new DynamicArrayDeque(0)).toThrow(RangeError);
			expect(() => new DynamicArrayDeque(-5)).toThrow(RangeError);
		});

		test("unsafeSet bumps array version", () => {
			const arr = new DynamicArray();
			arr.push(1, 2, 3);
			const v0 = arr.version;
			arr.unsafeSet(1, 99);
			expect(arr.version).toBeGreaterThan(v0);
		});
	});
});
