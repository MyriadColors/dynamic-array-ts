import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Multi-type Support", () => {
    const constructors = [
        Uint8Array,
        Uint8ClampedArray,
        Uint16Array,
        Uint32Array,
        Int8Array,
        Int16Array,
        Int32Array,
        Float32Array,
        Float64Array,
    ];

	test.each(constructors)("should work with %p", (Ctor) => {
		const arr = new DynamicArray(5, Infinity, Ctor);
		arr.push(1, 2, 3);
		expect(arr.get(0)).toBe(1);
		expect(arr.get(2)).toBe(3);
		expect(arr.length).toBe(3);
        expect(arr.toArray()).toEqual([1, 2, 3]);
	});

    const bigIntConstructors = [
        BigUint64Array,
        BigInt64Array,
    ];

    test.each(bigIntConstructors)("should work with BigInt constructor %p", (Ctor) => {
        const arr = new DynamicArray(5, Infinity, Ctor);
		arr.push(100n, 200n);
		expect(arr.get(0)).toBe(100n);
		expect(arr.at(-1)).toBe(200n);
		expect(arr.toArray()).toEqual([100n, 200n]);
    });

    test("should handle Uint8ClampedArray specific behavior", () => {
        const arr = new DynamicArray(5, Infinity, Uint8ClampedArray);
        // Clamping behavior: 300 becomes 255, -5 becomes 0
        arr.push(300, -5);
        expect(arr.get(0)).toBe(255);
        expect(arr.get(1)).toBe(0);
    });
});
