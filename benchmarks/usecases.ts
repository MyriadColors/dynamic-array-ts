import { bench, do_not_optimize, group } from "mitata";
import { DynamicArray } from "../index";
import {
	createFilledArray,
	createFilledDynamicArray,
	createFilledNumArray,
} from "./util";

const SIZE = 100_000; // Large enough to show cache/copy effects

group("Use Case: WASM / Binary Interop", () => {
	const da = createFilledDynamicArray(SIZE);
	const arr = createFilledArray(SIZE);
	const na = createFilledNumArray(SIZE);

	bench("Native Array to Uint8Array (Copy required)", () => {
		// This is what you must do to send a native array to a binary API
		return do_not_optimize(new Uint8Array(arr));
	});

	bench("DynamicArray to Uint8Array (Zero-copy)", () => {
		// This is all DynamicArray needs to do
		return do_not_optimize(da.raw());
	});

	bench("NumArray to Uint8Array (Zero-copy)", () => {
		return do_not_optimize(na.array());
	});
});

group("Use Case: High-Density Iteration (Sum)", () => {
	const da = createFilledDynamicArray(SIZE);
	const arr = createFilledArray(SIZE);
	const ua = new Uint8Array(arr);
	const na = createFilledNumArray(SIZE);

	bench("Sum Native Array (Generic Iteration)", () => {
		let sum = 0;
		for (let i = 0; i < arr.length; i++) {
			const value = arr[i];
			if (value !== undefined) {
				sum += value;
			}
		}
		return do_not_optimize(sum);
	});

	bench("Sum DynamicArray (TypedArray Iteration)", () => {
		let sum = 0;
		const raw = da.raw();
		for (let i = 0; i < raw.length; i++) {
			const value = raw[i];
			if (value !== undefined) {
				sum += value;
			}
		}
		return do_not_optimize(sum);
	});

	bench("Sum NumArray (TypedArray Iteration)", () => {
		let sum = 0;
		const raw = na.array();
		for (let i = 0; i < raw.length; i++) {
			const value = raw[i];
			if (value !== undefined) {
				sum += value;
			}
		}
		return do_not_optimize(sum);
	});

	bench("Sum Native Uint8Array (Baseline)", () => {
		let sum = 0;
		for (let i = 0; i < ua.length; i++) {
			const value = ua[i];
			if (value !== undefined) {
				sum += value;
			}
		}
		return do_not_optimize(sum);
	});
});

group("Use Case: Controlled Growth (Resizable Buffer)", () => {
	bench("Growth: DynamicArray (Manual Copy Fallback)", () => {
		const da = new DynamicArray(10);
		for (let i = 0; i < 10000; i++) da.push(i % 256);
		return da;
	});

	bench("Growth: DynamicArray (ArrayBuffer.resize)", () => {
		const da = new DynamicArray(10, 20000);
		for (let i = 0; i < 10000; i++) da.push(i % 256);
		return da;
	});

	// Note: typed-numarray doesn't seem to support explicit ArrayBuffer.resize()
	// but we can benchmark its default growth.
	bench("Growth: NumArray (Default)", () => {
		const na = createFilledNumArray(10);
		for (let i = 0; i < 10000; i++) na.push(i % 256);
		return na;
	});
});
