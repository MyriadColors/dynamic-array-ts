import { describe, expect, test } from "bun:test";
import { DynamicArray, unsafeBuffer } from "../../src/dynamic-array";
import type {
	BorrowedBuffer,
	ReadonlyTypedArray,
	ScopedBorrowedBuffer,
	ScopedMutableView,
	ScopedReadonlyView,
} from "../../src/ownership";
import type { TypedArrayInstance } from "../../src/types";

function assertReadonlyViewTypes(): void {
	const array = new DynamicArray(4, Infinity, Uint8Array);
	const raw = array.raw();
	const full = array.getRawBuffer();
	const arrayBufferView: ArrayBufferView = raw;
	const readonlyArray: ReadonlyTypedArray<typeof Uint8Array> = raw;
	const fullArrayBufferView: ArrayBufferView = full;
	const backingBuffer: ArrayBuffer = array.buffer;
	const decoded: string = new TextDecoder().decode(raw);

	expect(arrayBufferView).toBe(raw);
	expect(readonlyArray).toBe(raw);
	expect(fullArrayBufferView).toBe(full);
	expect(backingBuffer).toBe(array.buffer);
	expect(decoded).toBe("");

	// @ts-expect-error Raw views are readonly.
	raw[0] = 1;
	// @ts-expect-error Subviews remain readonly.
	raw.subarray()[0] = 1;
	// @ts-expect-error Slice results remain readonly.
	raw.slice()[0] = 1;
	// @ts-expect-error Mapped results remain readonly.
	raw.map((value) => value)[0] = 1;
	// @ts-expect-error Full-capacity views are readonly.
	full[0] = 1;
	// @ts-expect-error Raw views are not DynamicArray owners.
	const owner: typeof array = raw;
	expect(owner).toBeTruthy();
}

function assertScopedViewTypes(): void {
	const array = new DynamicArray(4, Infinity, Uint8Array);
	array.withRaw((view) => {
		view[0] = 1;
	});

	const escaped: TypedArrayInstance<typeof Uint8Array> = array.withRaw(
		// @ts-expect-error A mutable borrow cannot be returned as a typed array.
		(view) => view,
	);
	expect(escaped.length).toBe(0);

	array.withRawRead((view) => {
		// @ts-expect-error Readonly borrows reject writes.
		view[0] = 2;
	});
	array.withRawRead(
		// @ts-expect-error A readonly scoped borrow cannot be returned.
		(view) => view,
	);

	const scopedMutable: <Scope>(
		view: ScopedMutableView<typeof Uint8Array, Scope>,
	) => void = (view) => {
		view[0] = 3;
	};
	const scopedReadonly: <Scope>(
		view: ScopedReadonlyView<typeof Uint8Array, Scope>,
	) => void = (view) => {
		expect(view[0]).toBeDefined();
	};
	expect(scopedMutable).toBeFunction();
	expect(scopedReadonly).toBeFunction();
}

function assertBufferTypes(): void {
	// @ts-expect-error A borrowed buffer must originate from a scoped borrow.
	const buffer: BorrowedBuffer = {
		byteLength: 0,
		maxByteLength: 0,
		resizable: false,
		slice: () => new ArrayBuffer(0),
	};
	const scopedBuffer: <Scope>(value: ScopedBorrowedBuffer<Scope>) => void = (
		value,
	) => {
		expect(value.byteLength).toBeGreaterThanOrEqual(0);
	};
	expect(buffer.byteLength).toBe(0);
	expect(scopedBuffer).toBeFunction();

	const array = new DynamicArray(4, Infinity, Uint8Array);
	array.withBuffer((borrowed) => {
		const byteLength: number = borrowed.byteLength;
		const maxByteLength: number = borrowed.maxByteLength;
		const resizable: boolean = borrowed.resizable;
		const slice: ArrayBuffer = borrowed.slice();
		expect(byteLength).toBe(4);
		expect(maxByteLength).toBeGreaterThanOrEqual(byteLength);
		expect(resizable).toBeBoolean();
		expect(slice).toBeInstanceOf(ArrayBuffer);
		// @ts-expect-error The borrowed type does not expose resizing.
		borrowed.resize(8);
	});
	array.withBuffer(
		// @ts-expect-error A borrowed buffer cannot be returned directly.
		(borrowed) => borrowed,
	);
}

describe("ownership types", () => {
	test("ownership assertions are type checked", () => {
		expect(assertReadonlyViewTypes).toBeFunction();
		expect(assertScopedViewTypes).toBeFunction();
		expect(assertBufferTypes).toBeFunction();
	});

	test("unsafeBuffer explicitly returns the borrowed backing buffer", () => {
		const array = new DynamicArray(4, Infinity, Uint8Array);
		const backingBuffer = array.buffer;
		const escapedBuffer = array.withBuffer((buffer) => unsafeBuffer(buffer));
		expect(escapedBuffer).toBe(backingBuffer);
	});
});
