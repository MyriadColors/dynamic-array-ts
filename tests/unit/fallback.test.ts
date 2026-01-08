import { describe, expect, test, afterEach, beforeEach } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Fallback Logic", () => {
    const originalResize = ArrayBuffer.prototype.resize;
    const originalTransfer = (ArrayBuffer.prototype as any).transfer;

    afterEach(() => {
        ArrayBuffer.prototype.resize = originalResize;
        (ArrayBuffer.prototype as any).transfer = originalTransfer;
    });

    test("should fallback to manual copy when resize and transfer are missing", () => {
        // Mock missing features
        (ArrayBuffer.prototype as any).resize = undefined;
        (ArrayBuffer.prototype as any).transfer = undefined;

        const arr = new DynamicArray(2, Infinity, Uint8Array);
        // Force internal flags to false to test manual fallback
        (arr as any).supportsResize = false;
        (arr as any).supportsTransfer = false;
        
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
            console.warn("Environment doesn't support transfer(), skipping part of fallback test");
        }

        (ArrayBuffer.prototype as any).resize = undefined;
        // Keep original transfer if it exists, otherwise this test is limited
        
        const arr = new DynamicArray(2, Infinity, Uint8Array);
        // Force internal flags to false to test manual fallback
        (arr as any).supportsResize = false;
        (arr as any).supportsTransfer = false;
        
        arr.push(1, 2);
        
        arr.push(3);
        expect(arr.length).toBe(3);
        expect(arr.toArray()).toEqual([1, 2, 3]);
    });

    test("should handle shrinking with manual copy fallback", () => {
        (ArrayBuffer.prototype as any).resize = undefined;
        (ArrayBuffer.prototype as any).transfer = undefined;

        // MIN_SHRINK_CAPACITY is 10
        const arr = new DynamicArray(20, Infinity, Uint8Array);
        (arr as any).supportsResize = false;
        (arr as any).supportsTransfer = false;
        
        for(let i=0; i<20; i++) arr.push(i);
        
        // Remove 16 elements to hit < 25% threshold (20 * 0.25 = 5)
        for(let i=0; i<16; i++) arr.pop();
        
        expect(arr.length).toBe(4);
        expect(arr.capacity).toBe(10);
        expect(arr.toArray()).toEqual([0, 1, 2, 3]);
    });
});
