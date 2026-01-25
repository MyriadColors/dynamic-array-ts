/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { afterEach, describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

type ArrayBufferPrototypeWithFallback = {
	resize: ArrayBuffer["resize"] | undefined;
	transfer: ((newLength?: number) => ArrayBuffer) | undefined;
};

describe("DynamicArray Fallback Logic", () => {
	const arrayBufferProto =
		ArrayBuffer.prototype as unknown as ArrayBufferPrototypeWithFallback;
	const originalResize = arrayBufferProto.resize;
	const originalTransfer = arrayBufferProto.transfer;

	afterEach(() => {
		arrayBufferProto.resize = originalResize;
		arrayBufferProto.transfer = originalTransfer;
	});

	test("should fallback to manual copy when resize and transfer are missing", () => {
		// Mock missing features
		arrayBufferProto.resize = undefined;
		arrayBufferProto.transfer = undefined;

		const arr = new DynamicArray(2, Infinity, Uint8Array);
		// Force internal flags to false to test manual fallback
		const arrWithFlags = arr as unknown as {
			supportsResize: boolean;
			supportsTransfer: boolean;
		};
		arrWithFlags.supportsResize = false;
		arrWithFlags.supportsTransfer = false;

		arr.push(1, 2);
		const originalBuffer = arr.buffer;

		// Trigger growth
		arr.push(3);

		expect(arr.length).toBe(3);
		expect(arr.get(2)).toBe(3);
		expect(arr.buffer).not.toBe(originalBuffer);
		expect(arr.capacity).toBe(4);
		expect(arr.toArray()).toEqual([1, 2, 3]);
	});

	test("should use transfer() when resize() is missing but transfer() is available", () => {
		if (!originalTransfer) {
			console.warn(
				"Environment doesn't support transfer(), skipping part of fallback test",
			);
		}

		arrayBufferProto.resize = undefined;
		// Keep original transfer if it exists, otherwise this test is limited

		const arr = new DynamicArray(2, Infinity, Uint8Array);
		// Force internal flags to false to test manual fallback
		const arrWithFlags = arr as unknown as {
			supportsResize: boolean;
			supportsTransfer: boolean;
		};
		arrWithFlags.supportsResize = false;
		arrWithFlags.supportsTransfer = false;

		arr.push(1, 2);

		arr.push(3);
		expect(arr.length).toBe(3);
		expect(arr.toArray()).toEqual([1, 2, 3]);
	});

	test("should handle shrinking with manual copy fallback", () => {
		arrayBufferProto.resize = undefined;
		arrayBufferProto.transfer = undefined;

		// MIN_SHRINK_CAPACITY is 10
		const arr = new DynamicArray(20, Infinity, Uint8Array);
		const arrWithFlags = arr as unknown as {
			supportsResize: boolean;
			supportsTransfer: boolean;
		};
		arrWithFlags.supportsResize = false;
		arrWithFlags.supportsTransfer = false;

		for (let i = 0; i < 20; i++) arr.push(i);

		// Remove 16 elements to hit < 25% threshold (20 * 0.25 = 5)
		for (let i = 0; i < 16; i++) arr.pop();

		expect(arr.length).toBe(4);
		expect(arr.capacity).toBe(10);
		expect(arr.toArray()).toEqual([0, 1, 2, 3]);
	});
});
