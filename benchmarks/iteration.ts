import { bench, do_not_optimize, group } from "mitata";
import {
	createFilledArray,
	createFilledDynamicArray,
	TRANSFORM_SIZES,
} from "./util";

group("Iteration: forEach", () => {
	for (const size of TRANSFORM_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);

		bench(`DynamicArray.forEach x${size}`, () => {
			return do_not_optimize(
				// biome-ignore lint/complexity/noForEach: we are testing forEach specifically
				da.forEach((x) => {
					do_not_optimize(x);
				}),
			);
		});

		bench(`DynamicArray.forEachStable x${size}`, () => {
			return do_not_optimize(
				da.forEachStable((x) => {
					do_not_optimize(x);
				}),
			);
		});

		bench(`Native Array.forEach x${size}`, () => {
			return do_not_optimize(
				// biome-ignore lint/complexity/noForEach: we are testing forEach specifically
				arr.forEach((x) => {
					do_not_optimize(x);
				}),
			);
		});
	}
});

group("Iteration: for...of", () => {
	for (const size of TRANSFORM_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);

		bench(`Native Array for...of x${size}`, () => {
			for (const x of arr) {
				do_not_optimize(x);
			}
		});

		bench(`DynamicArray Iterator ([Symbol.iterator]) x${size}`, () => {
			for (const x of da) {
				do_not_optimize(x);
			}
		});
	}
});

group("Iteration: Manual Loop (index access)", () => {
	for (const size of TRANSFORM_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);

		bench(`DynamicArray Manual Loop (get) x${size}`, () => {
			for (let i = 0; i < da.length; i++) {
				do_not_optimize(da.get(i));
			}
		});

		bench(`DynamicArray Manual Loop (unsafeGet) x${size}`, () => {
			for (let i = 0; i < da.length; i++) {
				do_not_optimize(da.unsafeGet(i));
			}
		});

		bench(`Native Array Manual Loop x${size}`, () => {
			for (let i = 0; i < arr.length; i++) {
				do_not_optimize(arr[i]);
			}
		});
	}
});
