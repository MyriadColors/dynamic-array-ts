import { bench, do_not_optimize, group } from "mitata";
import NumArray from "typed-numarray";
import { DynamicArray } from "../index";
import { SIZES } from "./util";

group("Mutation: push (Growth)", () => {
	for (const size of SIZES) {
		bench(`DynamicArray.push x${size}`, () => {
			const da = new DynamicArray(10);
			for (let i = 0; i < size; i++) {
				da.push(i % 256);
			}
			return do_not_optimize(da);
		});

		bench(`NumArray.push x${size}`, () => {
			const na = NumArray("uint8", 10);
			for (let i = 0; i < size; i++) {
				na.push(i % 256);
			}
			return do_not_optimize(na);
		});

		bench(`Native Array.push x${size}`, () => {
			const arr = [];
			for (let i = 0; i < size; i++) {
				arr.push(i % 256);
			}
			return do_not_optimize(arr);
		});

		if (size === 100000) {
			bench("DynamicArray.pushAligned (100000, 8)", () => {
				const da = new DynamicArray(10);
				for (let i = 0; i < size; i++) {
					da.pushAligned(8, i % 256);
				}
				return do_not_optimize(da);
			});
		}
	}
});

group("Mutation: pop (Shrinkage)", () => {
	for (const size of SIZES) {
		bench(`DynamicArray.pop x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(da.pop());
			}
			return da;
		});

		if (size === 100000) {
			bench("DynamicArray.unsafePop x100000", () => {
				const da = new DynamicArray(size);
				for (let i = 0; i < size; i++) da.push(i % 256);

				for (let i = 0; i < size; i++) {
					do_not_optimize(da.unsafePop());
				}
				return da;
			});
		}

		bench(`NumArray.pop x${size}`, () => {
			const na = NumArray("uint8", size);
			for (let i = 0; i < size; i++) na.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(na.pop());
			}
			return na;
		});

		bench(`Native Array.pop x${size}`, () => {
			const arr = new Array(size).fill(0);
			for (let i = 0; i < size; i++) {
				do_not_optimize(arr.pop());
			}
			return arr;
		});
	}
});

group("Mutation: unshift (Prepend)", () => {
	const SMALL_SIZES = [10, 100, 1000]; // unshift is O(n), so we use smaller sizes
	for (const size of SMALL_SIZES) {
		bench(`DynamicArray.unshift x${size}`, () => {
			const da = new DynamicArray(10);
			for (let i = 0; i < size; i++) {
				da.unshift(i % 256);
			}
			return do_not_optimize(da);
		});

		bench(`NumArray.unshift x${size}`, () => {
			const na = NumArray("uint8", 10);
			for (let i = 0; i < size; i++) {
				na.unshift(i % 256);
			}
			return do_not_optimize(na);
		});

		bench(`Native Array.unshift x${size}`, () => {
			const arr = [];
			for (let i = 0; i < size; i++) {
				arr.unshift(i % 256);
			}
			return do_not_optimize(arr);
		});
	}
});

group("Mutation: shift (Remove First)", () => {
	const SMALL_SIZES = [10, 100, 1000];
	for (const size of SMALL_SIZES) {
		bench(`DynamicArray.shift x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(da.shift());
			}
			return da;
		});

		bench(`NumArray.shift x${size}`, () => {
			const na = NumArray("uint8", size);
			for (let i = 0; i < size; i++) na.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(na.shift());
			}
			return na;
		});

		bench(`Native Array.shift x${size}`, () => {
			const arr = new Array(size).fill(0);
			for (let i = 0; i < size; i++) {
				do_not_optimize(arr.shift());
			}
			return arr;
		});
	}
});
