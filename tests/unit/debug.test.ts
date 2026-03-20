import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";

const RE_ASSERTION_FAILED = /assertion failed/i;
const RE_NEG_HEAD = /assertion failed.*_head must be non-negative/i;
const RE_BUFFER_VIZ = /_1_, 2, 3, _0_, _0_/;

describe("DynamicArray Debug Mode", () => {
	test("constructor flag enables debug mode", () => {
		const da = new DynamicArray(10, Infinity, Uint8Array, { debug: true });
		// @ts-expect-error: accessing private property for test
		expect(da._debug).toBe(true);
	});

	test("assertions on unsafeGet", () => {
		const da = new DynamicArray(10, Infinity, Uint8Array, { debug: true });
		da.push(1, 2, 3);

		expect(() => da.unsafeGet(5)).toThrow(RE_ASSERTION_FAILED);
		expect(da.unsafeGet(0)).toBe(1);
	});

	test("assertions on unsafePop", () => {
		const da = new DynamicArray(10, Infinity, Uint8Array, { debug: true });
		expect(() => da.unsafePop()).toThrow(RE_ASSERTION_FAILED);
	});

	test("invariant checks on mutation (corruption detection)", () => {
		const da = new DynamicArray(10, Infinity, Uint8Array, { debug: true });
		da.push(1, 2, 3);

		// Manually corrupt internal state to violate invariant: _head >= 0
		// @ts-expect-error
		da._head = -1;

		expect(() => da.push(4)).toThrow(RE_NEG_HEAD);
	});

	test("enhanced toString() output", () => {
		const da = new DynamicArray(5, Infinity, Uint8Array, { debug: true });
		da.push(1, 2, 3);
		da.shift(); // _head becomes 1, _length 2

		const str = da.toString();
		expect(str).toContain("DynamicArray(Uint8Array)");
		expect(str).toContain("head: 1");
		expect(str).toContain("len: 2");
		expect(str).toContain("cap: 5");
		// Should show elements like _1_ (dead), 2, 3 (live), _0_ (dead)
		expect(str).toMatch(RE_BUFFER_VIZ);
	});

	test("transparent mode (debug: false) has no assertions", () => {
		const da = new DynamicArray(10, Infinity, Uint8Array, { debug: false });
		// unsafePop on empty should NOT throw assertion error in non-debug mode
		// (though it might return undefined or behave strangely, the point is no assertion)
		expect(() => da.unsafePop()).not.toThrow(RE_ASSERTION_FAILED);
	});

	test("Static from() supports debug flag", () => {
		const da = DynamicArray.from([1, 2, 3], Uint8Array, { debug: true });
		// @ts-expect-error
		expect(da._debug).toBe(true);
		expect(da.toString()).toContain("head: 0");
	});
});
