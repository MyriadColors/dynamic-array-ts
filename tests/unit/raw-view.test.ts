/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray raw()", () => {
	test("returns a TypedArray view with correct length", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3, 4, 5);
		const raw = arr.raw();
		expect(raw.length).toBe(5);
	});

	test("contains all pushed elements in correct order", () => {
		const arr = new DynamicArray(10, Infinity, Uint32Array);
		arr.push(10, 20, 30, 40);
		const raw = arr.raw();
		expect(raw[0]).toBe(10);
		expect(raw[1]).toBe(20);
		expect(raw[2]).toBe(30);
		expect(raw[3]).toBe(40);
	});

	test("empty array returns empty view (length === 0)", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		const raw = arr.raw();
		expect(raw.length).toBe(0);
		expect(raw.byteLength).toBe(0);
	});

	test("works correctly with _head offset (after shift())", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3, 4, 5);
		arr.shift();
		arr.shift();
		const raw = arr.raw();
		expect(raw.length).toBe(3);
		expect(raw[0]).toBe(3);
		expect(raw[1]).toBe(4);
		expect(raw[2]).toBe(5);
	});

	test("works correctly with _head offset (after unshift())", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(3, 4, 5);
		arr.unshift(1, 2);
		const raw = arr.raw();
		expect(raw.length).toBe(5);
		expect(raw[0]).toBe(1);
		expect(raw[1]).toBe(2);
		expect(raw[2]).toBe(3);
		expect(raw[3]).toBe(4);
		expect(raw[4]).toBe(5);
	});

	test("correct with Float32Array type", () => {
		const arr = new DynamicArray(10, Infinity, Float32Array);
		arr.push(1.5, 2.5, 3.5);
		const raw = arr.raw();
		expect(raw.length).toBe(3);
		expect(raw[0]).toBe(1.5);
		expect(raw[1]).toBe(2.5);
		expect(raw[2]).toBe(3.5);
	});

	test("correct with Int16Array type", () => {
		const arr = new DynamicArray(10, Infinity, Int16Array);
		arr.push(-100, 0, 100);
		const raw = arr.raw();
		expect(raw.length).toBe(3);
		expect(raw[0]).toBe(-100);
		expect(raw[1]).toBe(0);
		expect(raw[2]).toBe(100);
	});

	test("correct with BigInt64Array type", () => {
		const arr = new DynamicArray(10, Infinity, BigInt64Array);
		arr.push(1n, 2n, 3n);
		const raw = arr.raw() as BigInt64Array;
		expect(raw.length).toBe(3);
		expect(raw[0]).toBe(1n);
		expect(raw[1]).toBe(2n);
		expect(raw[2]).toBe(3n);
	});

	test("view buffer reference matches arr.buffer", () => {
		const arr = new DynamicArray(10, Infinity, Uint16Array);
		arr.push(100, 200, 300);
		const raw = arr.raw();
		expect(raw.buffer).toBe(arr.buffer);
	});

	test("modifying the view changes the DynamicArray (live window)", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3);
		const raw = arr.raw();
		raw[1] = 99;
		expect(arr.get(1)).toBe(99);
		expect(arr.toArray()[1]).toBe(99);
	});

	test("iteration via raw() matches toArray() for various sizes", () => {
		const sizes = [0, 1, 10, 100, 1000];
		for (const size of sizes) {
			const arr = new DynamicArray(size + 10, Infinity, Uint32Array);
			for (let i = 0; i < size; i++) {
				arr.push(i);
			}
			const raw = arr.raw();
			const viaIterator: number[] = [];
			for (const v of raw) {
				viaIterator.push(v);
			}
			expect(viaIterator).toEqual(arr.toArray());
		}
	});

	test("numeric computation (sum) via raw() is correct", () => {
		const arr = new DynamicArray(10, Infinity, Float64Array);
		arr.push(1, 2, 3, 4, 5);
		const raw = arr.raw() as Float64Array;
		let sum = 0;
		for (let i = 0; i < raw.length; i++) {
			sum += raw[i] as number;
		}
		expect(sum).toBe(15);
	});
});

describe("DynamicArray withRaw()", () => {
	test("returns the callback's return value", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3);
		const result = arr.withRaw((view) => view.length);
		expect(result).toBe(3);
	});

	test("works with empty array", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		const result = arr.withRaw((view) => {
			expect(view.length).toBe(0);
			return "empty";
		});
		expect(result).toBe("empty");
	});

	test("works with _head offset", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3, 4, 5);
		arr.shift();
		arr.shift();
		const result = arr.withRaw((view) => {
			expect(view.length).toBe(3);
			expect(view[0]).toBe(3);
			return (view[0] as number) + (view[1] as number) + (view[2] as number);
		});
		expect(result).toBe(12);
	});

	test("works with Float32Array type", () => {
		const arr = new DynamicArray(10, Infinity, Float32Array);
		arr.push(1.5, 2.5, 3.5);
		const result = arr.withRaw(
			(view) => (view[0] as number) + (view[1] as number) + (view[2] as number),
		);
		expect(result).toBe(7.5);
	});

	test("works with Int16Array type", () => {
		const arr = new DynamicArray(10, Infinity, Int16Array);
		arr.push(-10, 0, 10);
		const result = arr.withRaw(
			(view) => (view[0] as number) + (view[1] as number) + (view[2] as number),
		);
		expect(result).toBe(0);
	});

	test("view buffer reference matches arr.buffer", () => {
		const arr = new DynamicArray(10, Infinity, Uint16Array);
		arr.push(100, 200, 300);
		const result = arr.withRaw((view) => {
			expect(view.buffer).toBe(arr.buffer);
			return true;
		});
		expect(result).toBe(true);
	});

	test("modifying the view changes the DynamicArray", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3);
		arr.withRaw((view) => {
			view[1] = 99;
		});
		expect(arr.get(1)).toBe(99);
		expect(arr.toArray()[1]).toBe(99);
	});

	test("numeric computation (sum) via callback is correct", () => {
		const arr = new DynamicArray(10, Infinity, Float64Array);
		arr.push(1.1, 2.2, 3.3, 4.4);
		const sum = arr.withRaw((view) => {
			let s = 0;
			for (let i = 0; i < view.length; i++) {
				s += view[i] as number;
			}
			return s;
		});
		expect(sum).toBeCloseTo(11);
	});

	test("callback receives view with correct length and elements", () => {
		const arr = new DynamicArray(10, Infinity, Uint32Array);
		arr.push(10, 20, 30, 40, 50);
		let capturedView: Uint32Array | null = null;
		arr.withRaw((view) => {
			capturedView = view;
			return undefined;
		});
		expect(capturedView).not.toBeNull();
		expect(capturedView!.length).toBe(5);
		expect(capturedView![0]).toBe(10);
		expect(capturedView![4]).toBe(50);
	});

	test("callback can return primitives (number, undefined, object)", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3);

		const numResult = arr.withRaw(() => 42);
		expect(numResult).toBe(42);

		const undefResult = arr.withRaw(() => undefined);
		expect(undefResult).toBeUndefined();

		const objResult = arr.withRaw(() => ({ length: 3 }));
		expect(objResult).toEqual({ length: 3 });
	});

	test("if callback throws, error propagates (no catch)", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3);

		expect(() => {
			arr.withRaw(() => {
				throw new Error("test error");
			});
		}).toThrow("test error");
	});
});
