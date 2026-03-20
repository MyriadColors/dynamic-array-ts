/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are jsut tests */
import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Concurrent Modification During Iteration", () => {
	test("push() causing resize inside forEach should detach view and stop iteration (current behavior)", () => {
		// Start with small capacity to force resize quickly
		const arr = new DynamicArray(4);
		arr.push(1, 2, 3);
		// Capacity 4. Length 3.

		let iterations = 0;
		// We expect it to fail/stop once resize happens.
		// Iter 0: Val 1. Push 11. Len 4. (Full)
		// Iter 1: Val 2. Push 12. Len 5. RESIZE -> 8. Old view detached/stale.
		// Iter 2: Val 3. Old View[2] is valid if no transfer?
		// If transfer() is used, old buffer is detached immediately.

		// The current implementation uses `v = this.view` at start of forEach.
		// If resize happens, `v` is stale.

		// biome-ignore lint/complexity/noForEach: We are testing foreach specifically
		arr.forEach((val) => {
			if (iterations < 100) {
				arr.push(val + 10);
				iterations++;
			}
		});

		// It won't reach 100 because the view gets detached/stale.
		// We just want to confirm it doesn't crash, but it won't complete the full logic.
		expect(iterations).toBeLessThan(100);
		expect(arr.length).toBeGreaterThan(3);
	});

	test("shift() inside forEach should skip elements due to index shifting", () => {
		const arr = new DynamicArray();
		arr.push(0, 1, 2, 3, 4, 5);

		const visited: number[] = [];

		arr.forEach((val, _) => {
			visited.push(val);
			// Removing the first element shifts everything left.
			// Index 0 becomes the next value, but the loop increments `i` to 1.
			// So we effectively skip one element each time.
			if (val === 0 || val === 2 || val === 4) {
				arr.shift();
			}
		});

		// Initial: [0, 1, 2, 3, 4, 5]
		// i=0, val=0, visited=[0]. shift() -> [1, 2, 3, 4, 5]
		// i=1, val=2 (skip 1), visited=[0, 2]. shift() -> [1, 3, 4, 5]
		// i=2, val=4 (skip 3), visited=[0, 2, 4]. shift() -> [1, 3, 5]
		// i=3, val=undefined?
		//    Wait, `v` is captured at start. `shift` uses `copyWithin` on `this.view`.
		//    If `v` refers to the same buffer/view as `this.view` (no resize),
		//    then `v` sees the changes immediately!

		// If no resize happens, `v` IS `this.view`.
		// [0, 1, 2, 3, 4, 5]
		// i=0. val=0. shift(). `v` becomes [1, 2, 3, 4, 5, 5] (last element might be duplicated or 0 depending on impl? no, length decr).
		// Actually implementation of shift: copyWithin(0, 1, length). length--.
		// Data in buffer: [1, 2, 3, 4, 5, 5] (conceptually, index 5 is now "garbage" but still in buffer).

		// i=1. v[1] is 2. (Skipped 1).
		// visited: 0, 2.
		// shift(). v becomes [2, 3, 4, 5, 5, 5].

		// i=2. v[2] is 4. (Skipped 3).
		// visited: 0, 2, 4.
		// shift(). v becomes [3, 4, 5, 5, 5, 5].

		// i=3. v[3] is 5.
		// visited: 0, 2, 4, 5.
		// shift(). v becomes [4, 5, 5, 5, 5, 5].

		// i=4. v[4] is 5.
		// visited: 0, 2, 4, 5, 5.

		// loop condition: i < length.
		// length started at 6.
		// i=0. len=5.
		// i=1. len=4.
		// i=2. len=3.
		// i=3. 3 < 3 is FALSE. Loop terminates?
		// Wait, `this._length` is re-evaluated? Yes, it's a getter.

		// i=0 (len=6->5).
		// i=1 (len=5->4).
		// i=2 (len=4->3).
		// i=3 (len=3). 3 < 3 False. Ends.

		// So expected visited: [0, 2, 4]
		// Remaining array: [3, 4, 5] ?
		// Let's trace array state:
		// Start: 0,1,2,3,4,5
		// Shift 1: 1,2,3,4,5
		// Shift 2: 2,3,4,5
		// Shift 3: 3,4,5
		// Expected Array: [3, 4, 5]

		expect(visited).toEqual([0, 2, 4]);
		expect(arr.toArray()).toEqual([3, 4, 5]);
	});

	test("Generator (for..of) should fail on resize similar to forEach", () => {
		const arr = new DynamicArray(4);
		arr.push(1, 2, 3);

		let count = 0;
		const MAX = 100;

		// Same issue: Generator captures `v` at start. Resize invalidates it.
		for (const val of arr) {
			if (count < MAX) {
				arr.push(val * 10);
				count++;
			}
			if (count > MAX + 5) break;
		}

		expect(count).toBeLessThan(MAX);
	});

	test("Standard Array.forEach snapshot behavior comparison", () => {
		// Just to document the difference: Standard Array snapshots length?
		// Actually, standard Array.prototype.forEach DOES respect new length according to spec,
		// but implementations might vary or people assume it snapshots.
		// MDN: "The range of elements processed by forEach() is set before the first callback is invoked."
		// Wait, let's verify standard behavior:
		const stdArr = [1, 2, 3];
		let stdCount = 0;
		// biome-ignore lint/complexity/noForEach: We are testing foreach specifically
		stdArr.forEach((v) => {
			if (stdCount < 3) {
				// push 3 times
				stdArr.push(v + 10);
				stdCount++;
			}
		});
		// MDN says: "Elements which are appended to the array after the call to forEach begins will not be visited by callback."
		// So standard array length SHOULD be 6, but visited count should be 3.

		// NOW, let's check our DynamicArray
		const dynArr = new DynamicArray();
		dynArr.push(1, 2, 3);
		let dynCount = 0;
		let visits = 0;

		// biome-ignore lint/complexity/noForEach: we are testing foreach specifically
		dynArr.forEach((v) => {
			visits++;
			if (dynCount < 3) {
				dynArr.push(v + 10);
				dynCount++;
			}
		});

		// Current DynamicArray implementation loops `i < this._length`.
		// Since `push` updates `_length` immediately, it visits the new elements.
		// This differs from Array.prototype.forEach behavior.

		expect(stdArr.length).toBe(6); // 3 + 3
		expect(stdCount).toBe(3);

		expect(dynArr.length).toBe(6);
		expect(visits).toBe(3); // Now correctly follows standard Array behavior: 3 visits
	});
});
