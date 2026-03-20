import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../../index";
import type { TypedArrayInstance } from "../../src/types";

describe("Type Safety & Definition Robustness", () => {
	test("TypedArrayInstance should correctly map constructors to instances", () => {
		// This is a type-only test, but we can verify it at runtime via constructors
		const verify = <T extends import("../../src/types").TypedArrayConstructor>(
			_ctor: T,
			instance: TypedArrayInstance<T>,
		) => {
			expect(instance).toBeInstanceOf(
				_ctor as unknown as { new (...args: unknown[]): unknown },
			);
		};

		verify(Uint8Array, new Uint8Array(1));
		verify(Int32Array, new Int32Array(1));
		verify(Float64Array, new Float64Array(1));
		verify(BigUint64Array, new BigUint64Array(1));
	});

	test("ElementType should correctly identify number vs bigint", () => {
		const numArr = new DynamicArray(10, Infinity, Float32Array);
		numArr.push(1.5);
		const n = numArr.get(0);
		// @ts-expect-error - number is not bigint
		const _b: bigint = n;
		expect(typeof n).toBe("number");

		const bigArr = new DynamicArray(10, Infinity, BigInt64Array);
		bigArr.push(10n);
		const b = bigArr.get(0);
		// @ts-expect-error - bigint is not number
		const _n: number = b;
		expect(typeof b).toBe("bigint");
	});

	test("DynamicArray should allow appropriate types in push()", () => {
		const arr = new DynamicArray(10, Infinity, Int16Array);
		arr.push(10);
		arr.push([20, 30]);
		arr.push(new Int16Array([40, 50]));

		// @ts-expect-error - Cannot push bigint to Int16Array
		expect(() => arr.push(10n)).toThrow();
		expect(arr.length).toBe(5);
	});

	test("DynamicArray.from() should infer type from constructor", () => {
		const da = DynamicArray.from([1, 2, 3], Uint32Array);
		const val = da.get(0);
		// @ts-expect-error - result should be number, not bigint
		const _b: bigint = val;
		expect(val).toBe(1);
	});

	test("TypedArrayInstance should be distributive and cover all instances", () => {
		type Constructors = Uint8ArrayConstructor | BigUint64ArrayConstructor;
		type Instances = TypedArrayInstance<Constructors>;

		// Instances should be Uint8Array | BigUint64Array
		const a: Instances = new Uint8Array(0);
		const b: Instances = new BigUint64Array(0);

		expect(a).toBeInstanceOf(Uint8Array);
		expect(b).toBeInstanceOf(BigUint64Array);
	});
});
