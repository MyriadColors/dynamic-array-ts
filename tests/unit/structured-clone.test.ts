import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Structured Clone & Transfer", () => {
	describe("transfer()", () => {
		test("should return underlying buffer and detach array", () => {
			const arr = DynamicArray.from([1, 2, 3], Int32Array);
			expect(arr.length).toBe(3);

			const buffer = arr.transfer();
			expect(buffer).toBeInstanceOf(ArrayBuffer);
			expect(buffer.byteLength >= 12).toBe(true);

			// Array should be detached and unusable
			expect(() => arr.length).toThrow(TypeError);
			expect(() => arr.push(4)).toThrow(TypeError);
			expect(() => arr.transfer()).toThrow(TypeError);
			expect(() => arr.get(0)).toThrow(TypeError);

			// New array can be constructed from the buffer
			const newView = new Int32Array(buffer);
			expect(newView[0]).toBe(1);
			expect(newView[1]).toBe(2);
			expect(newView[2]).toBe(3);
		});
	});

	describe("structuredClone", () => {
		test("should provide [Symbol.for('structuredClone')]()", () => {
			const arr = DynamicArray.from([10, 20, 30], Uint8Array);
			const cloneable = (
				(arr as unknown as Record<symbol, () => unknown>)[
					Symbol.for("structuredClone")
				] as () => unknown
			)();

			expect(cloneable).toBeDefined();
			expect((cloneable as Record<string, unknown>).__isDynamicArray).toBe(
				true,
			);
			expect((cloneable as Record<string, unknown>).buffer).toBeInstanceOf(
				ArrayBuffer,
			);
			expect((cloneable as Record<string, unknown>).length).toBe(3);
			expect((cloneable as Record<string, unknown>).type).toBe("Uint8Array");
		});

		test("should be able to reconstruct using fromStructured", () => {
			const arr = DynamicArray.from([42, 43], Float32Array);
			const data = (
				(arr as unknown as Record<symbol, () => unknown>)[
					Symbol.for("structuredClone")
				] as () => unknown
			)();

			const reconstructed = DynamicArray.fromStructured(data);
			expect(reconstructed).toBeInstanceOf(DynamicArray);
			expect(reconstructed.length).toBe(2);
			expect(reconstructed.get(0)).toBe(42);
			expect(reconstructed.get(1)).toBe(43);
		});

		test("isStructuredData should identify valid structured data", () => {
			expect(DynamicArray.isStructuredData(null)).toBe(false);
			expect(DynamicArray.isStructuredData({})).toBe(false);

			const validData = { __isDynamicArray: true, buffer: new ArrayBuffer(8) };
			expect(DynamicArray.isStructuredData(validData)).toBe(true);
		});

		test("should simulate full structuredClone pass (via JSON)", () => {
			const arr = DynamicArray.from([7, 8, 9], Uint16Array);
			const data = (
				(arr as unknown as Record<symbol, () => unknown>)[
					Symbol.for("structuredClone")
				] as () => unknown
			)() as { buffer: ArrayBuffer; [key: string]: unknown };

			// A real structuredClone would transfer/copy the ArrayBuffer.
			// We can simulate it by structuredClone in Bun if available, or just mocking it.
			let clonedObject: unknown;
			if (typeof structuredClone === "function") {
				clonedObject = structuredClone(data);
			} else {
				// Fallback testing if structuredClone not available globally
				clonedObject = { ...data, buffer: data.buffer.slice(0) };
			}

			const reconstructed = DynamicArray.fromStructured(clonedObject);
			expect(reconstructed.length).toBe(3);
			expect(reconstructed.get(0)).toBe(7);
			expect(reconstructed.get(1)).toBe(8);
			expect(reconstructed.get(2)).toBe(9);

			// Mutating original shouldn't affect the clone
			arr.set(0, 999);
			expect(reconstructed.get(0)).toBe(7);
		});
	});
});
