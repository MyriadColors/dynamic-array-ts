import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

describe("DynamicArray Mutation Operations", () => {
	test("push() should add elements to the end", () => {
		const arr = new DynamicArray<Uint8ArrayConstructor>();
		expect(arr.push(10)).toBe(1);
		expect(arr.push(20, 30)).toBe(3);
		expect(arr.length).toBe(3);
		expect(arr.get(0)).toBe(10);
		expect(arr.get(1)).toBe(20);
		expect(arr.get(2)).toBe(30);
	});

	test("push() should handle bulk insertions with ArrayLike objects", () => {
		const arr = new DynamicArray();
		arr.push(1);
		// Push an array
		arr.push([2, 3, 4]);
		// Push a TypedArray
		arr.push(new Uint8Array([5, 6]));
		
		expect(arr.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
		expect(arr.length).toBe(6);
	});

	test("pushAligned() should pad elements to reach alignment", () => {
		const arr = new DynamicArray(10, Infinity, Uint8Array);
		arr.push(1); // length 1
		arr.pushAligned(4, 2, 3); // needs 3 padding zeros: [1, 0, 0, 0, 2, 3]
		expect(arr.toArray()).toEqual([1, 0, 0, 0, 2, 3]);
		expect(arr.length).toBe(6);

		arr.pushAligned(4, 4); // needs 2 padding zeros: [1, 0, 0, 0, 2, 3, 0, 0, 4]
		expect(arr.length).toBe(9);
		expect(arr.get(8)).toBe(4);
	});

	test("pop() should remove and return the last element", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		expect(arr.pop()).toBe(3);
		expect(arr.length).toBe(2);
		expect(arr.pop()).toBe(2);
		expect(arr.pop()).toBe(1);
		expect(arr.pop()).toBeUndefined();
		expect(arr.length).toBe(0);
	});

	test("unshift() should add elements to the beginning", () => {
		const arr = new DynamicArray();
		arr.push(10);
		expect(arr.unshift(20, 30)).toBe(3);
		expect(arr.toArray()).toEqual([20, 30, 10]);
		expect(arr.length).toBe(3);
	});

	test("shift() should remove and return the first element and update _head", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		expect(arr.shift()).toBe(1);
		expect(arr.toArray()).toEqual([2, 3]);
		expect(arr.length).toBe(2);
		// Internal check via toArray/get
		expect(arr.get(0)).toBe(2);
	});

	test("compact() should move elements to the start and reset _head", () => {
		const arr = new DynamicArray(10);
		arr.push(1, 2, 3, 4, 5);
		arr.shift();
		arr.shift();
		// length 3, _head 2
		expect(arr.length).toBe(3);
		
		arr.compact();
		expect(arr.length).toBe(3);
		expect(arr.toArray()).toEqual([3, 4, 5]);
		
		// Verify we can still push correctly after compact
		arr.push(6);
		expect(arr.toArray()).toEqual([3, 4, 5, 6]);
	});

    test("exhaustive _head logic: mixing push/pop/shift/unshift", () => {
        const arr = new DynamicArray(10);
        
        arr.push(1, 2, 3);       // [1, 2, 3], head 0
        arr.shift();             // [2, 3], head 1
        arr.unshift(0);          // [0, 2, 3], head 0 (unshift currently compacts)
        arr.push(4, 5);          // [0, 2, 3, 4, 5], head 0
        arr.shift();             // [2, 3, 4, 5], head 1
        arr.shift();             // [3, 4, 5], head 2
        
        expect(arr.toArray()).toEqual([3, 4, 5]);
        
        arr.pop();               // [3, 4], head 2, len 2
        expect(arr.toArray()).toEqual([3, 4]);
        
        // Trigger automatic compact in push if head is large
        // (Implementation says if head > capacity * 0.2)
        // Here head=2, capacity=10. 2 > 10 * 0.2 is FALSE (it's equal).
        // Let's force it.
        for(let i=0; i<3; i++) arr.shift(); // will be empty, head resets to 0
        arr.push(1, 2, 3, 4, 5, 6);
        arr.shift(); arr.shift(); arr.shift(); // head 3. 3 > 10 * 0.2 is TRUE.
        
        arr.push(7); // Should trigger compact
        expect(arr.toArray()).toEqual([4, 5, 6, 7]);
    });

	test("reverse() should reverse elements in-place", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		arr.reverse();
		expect(arr.toArray()).toEqual([3, 2, 1]);
	});

	test("sort() should sort elements in-place", () => {
		const arr = new DynamicArray();
		arr.push(30, 10, 20);
		arr.sort();
		expect(arr.toArray()).toEqual([10, 20, 30]);

		// With comparator
		arr.sort((a, b) => b - a);
		expect(arr.toArray()).toEqual([30, 20, 10]);
	});

	test("nativeSort() should use the underlying typed array sort", () => {
		const arr = new DynamicArray();
		arr.push(3, 1, 2);
		arr.nativeSort();
		expect(arr.toArray()).toEqual([1, 2, 3]);
	});

	test("splice() should remove elements correctly", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3, 4, 5);
		const deleted = arr.splice(1, 2);
		expect(deleted).toEqual([2, 3]);
		expect(arr.toArray()).toEqual([1, 4, 5]);
		expect(arr.length).toBe(3);
	});

	test("splice() should insert elements correctly", () => {
		const arr = new DynamicArray();
		arr.push(1, 4);
		arr.splice(1, 0, 2, 3);
		expect(arr.toArray()).toEqual([1, 2, 3, 4]);
		expect(arr.length).toBe(4);
	});

	test("splice() should handle simultaneous deletion and insertion", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 5);
		const deleted = arr.splice(1, 1, 3, 4);
		expect(deleted).toEqual([2]);
		expect(arr.toArray()).toEqual([1, 3, 4, 5]);
		expect(arr.length).toBe(4);
	});

    test("clear() should reset length", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3);
		arr.clear();
		expect(arr.length).toBe(0);
        expect(arr.toArray()).toEqual([]);
	});

    test("truncate() should reduce length", () => {
		const arr = new DynamicArray();
		arr.push(1, 2, 3, 4, 5);
		arr.truncate(3);
		expect(arr.length).toBe(3);
        expect(arr.toArray()).toEqual([1, 2, 3]);
	});
});
