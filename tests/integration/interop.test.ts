/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are jsut tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Buffer Interop & Stability", () => {
	test("Multiple DynamicArrays can technically share a buffer (manual integration)", () => {
		const arr1 = new DynamicArray(10, Infinity, Uint32Array);
		arr1.push(1, 2, 3);

		// Simulating a scenario where another system uses the same buffer
		const sharedBuffer = arr1.buffer;
		const arr2 = new DynamicArray(10, Infinity, Uint32Array);
		type DynamicArrayInternals = {
			_buffer: typeof sharedBuffer;
			view: Uint32Array;
			_length: number;
		};
		const arr2Internal = arr2 as unknown as DynamicArrayInternals;
		// Manually pointing arr2 to arr1's buffer (not a standard API but testing robustness)
		arr2Internal._buffer = sharedBuffer;
		arr2Internal.view = new Uint32Array(sharedBuffer);
		arr2Internal._length = 3;

		expect(arr2.get(0)).toBe(1);
		arr1.set(0, 99);
		expect(arr2.get(0)).toBe(99);
	});

	test("Raw views should remain valid as long as no resize occurs", () => {
		const arr = new DynamicArray(10, Infinity, Float32Array);
		arr.push(1, 2, 3);

		const raw = arr.raw();
		expect(raw[0]).toBe(1);

		arr.set(0, 10);
		expect(raw[0]).toBe(10); // View is live
	});

	test("Raw views may become detached after resize (documented behavior)", () => {
		const arr = new DynamicArray(2, Infinity, Uint8Array);
		arr.push(1, 2);

		const raw = arr.raw();
		expect(raw.byteLength).toBe(2);

		// Trigger resize (transfer or new buffer)
		arr.push(3);

		// If transfer() or new ArrayBuffer was used, the old one is detached or just different.
		// In modern JS, if it was transferred, raw.byteLength becomes 0.
		// If it was a manual copy, raw still points to the OLD buffer.

		if (raw.byteLength === 0) {
			// Detached
			expect(raw.byteLength).toBe(0);
		} else {
			// Still points to old data
			expect(raw[0]).toBe(1);
			expect(arr.get(0)).toBe(1);
			arr.set(0, 99);
			expect(raw[0]).toBe(1); // Old view does NOT see the change because buffer changed
		}
	});

	test("Should correctly handle buffer sharing with TypedArray.set()", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		const source = new Uint8Array([10, 20, 30]);

		arr.push(source); // Uses .set() internally
		expect(arr.toArray()).toEqual([10, 20, 30]);

		// Changing source should NOT affect arr (copy behavior of .set())
		source[0] = 99;
		expect(arr.get(0)).toBe(10);
	});
});
