/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Buffer Immutability", () => {
	test("buffer getter should return the same object reference", () => {
		const arr = new DynamicArray(10, Infinity, Uint32Array);
		arr.push(1, 2, 3);

		const buffer1 = arr.buffer;
		const buffer2 = arr.buffer;

		expect(buffer1).toBe(buffer2);
		expect(buffer1).toBe(arr.buffer);
	});

	test("buffer getter should return same reference after mutations", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1, 2, 3);

		const initialBuffer = arr.buffer;

		// These operations should not change the buffer reference
		arr.push(4, 5);
		expect(arr.buffer).toBe(initialBuffer);

		arr.pop();
		expect(arr.buffer).toBe(initialBuffer);

		arr.shift();
		expect(arr.buffer).toBe(initialBuffer);

		arr.unshift(0);
		expect(arr.buffer).toBe(initialBuffer);

		arr.set(0, 99);
		expect(arr.buffer).toBe(initialBuffer);

		arr.splice(1, 1);
		expect(arr.buffer).toBe(initialBuffer);

		arr.compact();
		expect(arr.buffer).toBe(initialBuffer);
	});

	test("buffer getter should return same reference until resize occurs", () => {
		const arr = new DynamicArray(4, Infinity, Uint8Array);
		arr.push(1, 2, 3);

		const bufferBefore = arr.buffer;

		// Fill to capacity - should not resize yet
		arr.push(4);
		expect(arr.buffer).toBe(bufferBefore);

		// This should trigger resize
		arr.push(5);
		expect(arr.buffer).not.toBe(bufferBefore);

		const bufferAfter = arr.buffer;

		// Pop below threshold should not resize
		arr.pop();
		arr.pop();
		arr.pop();
		expect(arr.buffer).toBe(bufferAfter);
	});

	test("buffer property should not be reassignable via direct assignment", () => {
		const arr = new DynamicArray(10, Infinity, Uint32Array);
		const newBuffer = new ArrayBuffer(100);

		// Attempting to reassign buffer should fail
		expect(() => {
			// @ts-expect-error - intentionally testing runtime behavior
			arr.buffer = newBuffer;
		}).toThrow(TypeError);

		// Buffer should remain unchanged
		expect(arr.buffer).not.toBe(newBuffer);
		expect(arr.buffer.byteLength).toBe(40); // 10 * 4 bytes
	});

	test("buffer getter should expose buffer for WebGPU/WASM interop", () => {
		const arr = new DynamicArray(100, Infinity, Float32Array);
		arr.push(1.0, 2.0, 3.0);

		const buffer = arr.buffer;

		// Buffer should be usable with WebGPU/WASM APIs
		expect(buffer).toBeInstanceOf(ArrayBuffer);
		expect(buffer.byteLength).toBeGreaterThanOrEqual(12);
		expect(buffer.byteLength).toBe(arr.byteLength);

		// Create a view from the buffer (simulating WASM access)
		const view = new Float32Array(buffer);
		expect(view[0]).toBe(1.0);
		expect(view[1]).toBe(2.0);
		expect(view[2]).toBe(3.0);
	});

	test("buffer reference should be consistent with raw() view underlying buffer", () => {
		const arr = new DynamicArray(10, Infinity, Uint16Array);
		arr.push(100, 200, 300);

		const rawView = arr.raw();

		// The raw() view's buffer should be the same as arr.buffer
		expect(rawView.buffer).toBe(arr.buffer);
	});

	test("buffer getter should work correctly with different TypedArray types", () => {
		const uint8 = new DynamicArray(10, Infinity, Uint8Array);
		uint8.push(1, 2, 3);
		expect(uint8.buffer.byteLength).toBe(10);

		const uint32 = new DynamicArray(10, Infinity, Uint32Array);
		uint32.push(1, 2, 3);
		expect(uint32.buffer.byteLength).toBe(40);

		const float64 = new DynamicArray(10, Infinity, Float64Array);
		float64.push(1, 2, 3);
		expect(float64.buffer.byteLength).toBe(80);

		const bigint64 = new DynamicArray(10, Infinity, BigInt64Array);
		bigint64.push(1n, 2n, 3n);
		expect(bigint64.buffer.byteLength).toBe(80);
	});

	test("buffer should be protected from external corruption attempts", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(10, 20, 30);

		const buffer = arr.buffer;

		// Attempts to mutate the buffer externally should not affect the array's internal state
		const externalView = new Uint8Array(buffer);
		externalView[0] = 99;

		// Note: This actually WILL change the array's view since it's the same underlying buffer
		// The protection is against reassignment, not against external views of the same buffer
		expect(arr.get(0)).toBe(99);

		// But the buffer reference itself cannot be changed
		const anotherBuffer = new ArrayBuffer(100);
		expect(() => {
			// @ts-expect-error - intentionally testing runtime behavior
			arr.buffer = anotherBuffer;
		}).toThrow(TypeError);

		expect(arr.buffer).toBe(buffer);
		expect(arr.buffer).not.toBe(anotherBuffer);
	});

	test("buffer should update correctly after resize", () => {
		// Start small to force resize
		const arr = new DynamicArray(10, 200, Uint32Array);
		arr.push(1, 2, 3);

		const bufferBefore = arr.buffer;
		const byteLengthBefore = bufferBefore.byteLength;

		// Force a resize by pushing past initial capacity
		for (let i = 0; i < 50; i++) {
			arr.push(i);
		}

		const bufferAfter = arr.buffer;
		// Buffer should have been resized (either in-place or via transfer)
		expect(bufferAfter.byteLength).toBeGreaterThan(byteLengthBefore);

		// The buffer should still contain the original data
		expect(arr.get(0)).toBe(1);
		expect(arr.get(1)).toBe(2);
		expect(arr.get(2)).toBe(3);
		expect(arr.length).toBe(53);
	});

	test("buffer property should exist on the class prototype", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);

		// The getter should be on the prototype chain
		expect(Object.getOwnPropertyDescriptor(arr, "buffer")).toBeUndefined();
		const descriptor = Object.getOwnPropertyDescriptor(
			Object.getPrototypeOf(arr),
			"buffer",
		);
		expect(descriptor).toBeDefined();
		expect(descriptor?.get).toBeDefined();
		expect(descriptor?.set).toBeUndefined(); // No setter
	});
});
