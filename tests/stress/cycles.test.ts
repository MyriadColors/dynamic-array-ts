import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Growth/Shrink Cycles (Hysteresis)", () => {
	test("Should not shrink immediately after growth (Hysteresis check)", () => {
		// Start with capacity 10
		const arr = new DynamicArray(10);
		expect(arr.capacity).toBe(10);

		// Fill to capacity
		for (let i = 0; i < 10; i++) arr.push(i);
		expect(arr.capacity).toBe(10);
		expect(arr.length).toBe(10);

		const initialBuffer = arr.buffer;

		// Trigger growth to 20
		arr.push(10);
		expect(arr.capacity).toBe(20);
		expect(arr.length).toBe(11);
		
		// Buffer should have changed (resized or transferred)
		const grownBuffer = arr.buffer;
		expect(grownBuffer).not.toBe(initialBuffer);

		// Pop back to 10. 
		// Length 10 is 50% of capacity 20. 
		// Shrink threshold is 0.25 (25%), so it should NOT shrink.
		arr.pop();
		expect(arr.length).toBe(10);
		expect(arr.capacity).toBe(20);
		expect(arr.buffer).toBe(grownBuffer); // Buffer must remain identical

		// Pop until we hit the threshold. 
		// Threshold is length < 20 * 0.25 = 5.
		// So at length 5 it shouldn't shrink, at length 4 it should.
		while (arr.length > 5) {
			arr.pop();
			expect(arr.capacity).toBe(20);
		}
		
		expect(arr.length).toBe(5);
		expect(arr.capacity).toBe(20);

		// This pop should trigger shrink
		arr.pop();
		expect(arr.length).toBe(4);
		expect(arr.capacity).toBe(10); // Math.max(10, 20/2)
		expect(arr.buffer).not.toBe(grownBuffer);
	});

	test("Should handle rapid oscillation without reallocating", () => {
		// Capacity 20, Length 10
		const arr = new DynamicArray(20);
		for (let i = 0; i < 10; i++) arr.push(i);
		
		const stableBuffer = arr.buffer;
		const ITERATIONS = 1000;

		for (let i = 0; i < ITERATIONS; i++) {
			// Add 5 elements (Total 15, 75% capacity)
			arr.push(1, 2, 3, 4, 5);
			// Remove 5 elements (Total 10, 50% capacity)
			arr.pop();
			arr.pop();
			arr.pop();
			arr.pop();
			arr.pop();
			
			// Ensure buffer remains stable
			if (arr.buffer !== stableBuffer) {
				throw new Error(`Buffer reallocated during iteration ${i}`);
			}
		}

		expect(arr.length).toBe(10);
		expect(arr.capacity).toBe(20);
		expect(arr.buffer).toBe(stableBuffer);
	});

	test("Should handle multiple growth steps and correctly shrink back", () => {
		const arr = new DynamicArray(10);
		
		// Grow 10 -> 20 -> 40 -> 80
		for (let i = 0; i < 80; i++) arr.push(i);
		expect(arr.capacity).toBe(80);

		// Shrink threshold is 25%.
		// To shrink from 80 to 40: length < 20
		// To shrink from 40 to 20: length < 10
		// To shrink from 20 to 10: length < 5
		
		// Truncate to 21 (above 20 threshold for 80 capacity)
		arr.truncate(21);
		expect(arr.capacity).toBe(80);

		// Truncate to 19 (triggers shrink to 40)
		arr.truncate(19);
		expect(arr.capacity).toBe(40);

		// Truncate to 9 (triggers shrink to 20)
		arr.truncate(9);
		expect(arr.capacity).toBe(20);

		// Truncate to 4 (triggers shrink to 10)
		arr.truncate(4);
		expect(arr.capacity).toBe(10);
	});
});
