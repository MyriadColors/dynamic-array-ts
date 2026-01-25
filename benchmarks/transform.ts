import { bench, do_not_optimize, group } from "mitata";
import {
	createFilledArray,
	createFilledDynamicArray,
	createFilledNumArray,
	TRANSFORM_SIZES,
} from "./util";

group("Transformation: map", () => {
	for (const size of TRANSFORM_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);
		const na = createFilledNumArray(size);

		bench(`DynamicArray.map x${size}`, () => {
			return do_not_optimize(da.map((v: number) => v * 2));
		});

		bench(`NumArray.map x${size}`, () => {
			return do_not_optimize(na.map((v: number) => v * 2));
		});

		bench(`Native Array.map x${size}`, () => {
			return do_not_optimize(arr.map((v: number) => v * 2));
		});
	}
});

group("Transformation: filter", () => {
	for (const size of TRANSFORM_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);
		const na = createFilledNumArray(size);

		bench(`DynamicArray.filter x${size}`, () => {
			return do_not_optimize(da.filter((v: number) => v > 128));
		});

		bench(`NumArray.filter x${size}`, () => {
			return do_not_optimize(na.filter((v: number) => v > 128));
		});

		bench(`Native Array.filter x${size}`, () => {
			return do_not_optimize(arr.filter((v: number) => v > 128));
		});
	}
});

group("Transformation: reduce", () => {
	for (const size of TRANSFORM_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);
		const na = createFilledNumArray(size);

		bench(`DynamicArray.reduce x${size}`, () => {
			return do_not_optimize(da.reduce((acc: number, v: number) => acc + v, 0));
		});

		bench(`NumArray.reduce x${size}`, () => {
			return do_not_optimize(na.reduce((acc: number, v: number) => acc + v, 0));
		});

		bench(`Native Array.reduce x${size}`, () => {
			return do_not_optimize(
				arr.reduce((acc: number, v: number) => acc + v, 0),
			);
		});
	}
});

group("Transformation: reverse (In-Place)", () => {
	for (const size of TRANSFORM_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);

		// Note: reverse is O(N) and destructive.
		// Benchmarking in-place means we are reversing a reversed array every other time.
		// This is generally acceptable for performance measuring of the swap logic.

		bench(`DynamicArray.reverse x${size}`, () => {
			return do_not_optimize(da.reverse());
		});

		bench(`Native Array.reverse x${size}`, () => {
			return do_not_optimize(arr.reverse());
		});
	}
});

group("Transformation: sort (Copy + Sort)", () => {
	for (const size of TRANSFORM_SIZES) {
		const da = createFilledDynamicArray(size);
		// Fill with random data for sorting
		for (let i = 0; i < size; i++) da.set(i, (Math.random() * 255) | 0);

		const arr = createFilledArray(size);
		for (let i = 0; i < size; i++) arr[i] = (Math.random() * 255) | 0;

		bench(`DynamicArray.sort (generic) x${size}`, () => {
			const copy = da.slice();
			copy.sort();
			return do_not_optimize(copy);
		});

		bench(`DynamicArray.nativeSort (typed) x${size}`, () => {
			const copy = da.slice();
			copy.nativeSort();
			return do_not_optimize(copy);
		});

		bench(`Native Array.sort x${size}`, () => {
			const copy = arr.slice();
			copy.sort();
			return do_not_optimize(copy);
		});
	}
});
