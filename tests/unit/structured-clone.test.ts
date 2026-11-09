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
		test("should not be natively cloneable by structuredClone", () => {
			const arr = DynamicArray.from([10, 20, 30], Uint8Array);
			expect(() => structuredClone(arr)).toThrow();
		});

		test("toStructured() returns a cloneable snapshot", () => {
			const arr = DynamicArray.from([10, 20, 30], Uint8Array);
			const snapshot = arr.toStructured();

			expect(snapshot.__isDynamicArray).toBe(true);
			expect(snapshot.buffer).toBeInstanceOf(ArrayBuffer);
			expect(snapshot.length).toBe(3);
			expect(snapshot.type).toBe("Uint8Array");
		});

		test("Symbol.for('structuredClone') delegates to toStructured()", () => {
			const arr = DynamicArray.from([1, 2, 3], Int16Array);
			const viaSymbol = (
				(arr as unknown as Record<symbol, () => unknown>)[
					Symbol.for("structuredClone")
				] as () => unknown
			)();
			expect(viaSymbol).toEqual(arr.toStructured());
		});

		test("should reconstruct using fromStructured", () => {
			const arr = DynamicArray.from([42, 43], Float32Array);
			const reconstructed = DynamicArray.fromStructured(arr.toStructured());
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

		test("should clone via structuredClone of the snapshot", () => {
			const arr = DynamicArray.from([7, 8, 9], Uint16Array);
			const clonedSnapshot = structuredClone(arr.toStructured());

			const reconstructed = DynamicArray.fromStructured(clonedSnapshot);
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
