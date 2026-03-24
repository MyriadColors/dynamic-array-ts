import { bench, do_not_optimize, group } from "mitata";
import {
	ACCESS_SIZES,
	createFilledArray,
	createFilledDynamicArray,
} from "./util";

group("raw() call overhead", () => {
	for (const size of ACCESS_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.raw() x${size}`, () => {
			return do_not_optimize(da.raw());
		});
	}
});

group("withRaw() call overhead", () => {
	for (const size of ACCESS_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.withRaw() x${size}`, () => {
			return do_not_optimize(da.withRaw((v) => v));
		});
	}
});

group("Numeric computation (sum)", () => {
	const size = 100000;
	const da = createFilledDynamicArray(size);
	const arr = createFilledArray(size);
	const raw = da.raw();

	bench(`raw() + manual for-loop sum x${size}`, () => {
		let sum = 0;
		const view = da.raw();
		for (let i = 0; i < view.length; i++) {
			sum += view[i] as number;
		}
		return do_not_optimize(sum);
	});

	bench(`withRaw() + manual for-loop sum x${size}`, () => {
		return do_not_optimize(
			da.withRaw((view) => {
				let sum = 0;
				for (let i = 0; i < view.length; i++) {
					sum += view[i] as number;
				}
				return sum;
			}),
		);
	});

	bench(`toArray() + reduce x${size}`, () => {
		return do_not_optimize(da.toArray().reduce((a, b) => a + b, 0));
	});

	bench(`Native Array.reduce x${size}`, () => {
		return do_not_optimize(arr.reduce((a, b) => a + b, 0));
	});

	bench(`TypedArray.reduce x${size}`, () => {
		return do_not_optimize(raw.reduce((a, b) => a + b, 0));
	});
});

group("Iteration comparison", () => {
	const size = 100000;
	const da = createFilledDynamicArray(size);
	const arr = createFilledArray(size);
	const raw = da.raw();

	bench(`for...of over raw() x${size}`, () => {
		let count = 0;
		for (const v of da.raw()) {
			count += v;
		}
		return do_not_optimize(count);
	});

	bench(`for...of over toArray() x${size}`, () => {
		let count = 0;
		for (const v of da.toArray()) {
			count += v;
		}
		return do_not_optimize(count);
	});

	bench(`for-loop index over raw() x${size}`, () => {
		let count = 0;
		const view = da.raw();
		for (let i = 0; i < view.length; i++) {
			count += view[i] as number;
		}
		return do_not_optimize(count);
	});

	bench(`for-loop index over Native Array x${size}`, () => {
		let count = 0;
		for (let i = 0; i < arr.length; i++) {
			count += arr[i] as number;
		}
		return do_not_optimize(count);
	});

	bench(`for-loop index over TypedArray x${size}`, () => {
		let count = 0;
		for (let i = 0; i < raw.length; i++) {
			count += raw[i] as number;
		}
		return do_not_optimize(count);
	});
});

group("View creation overhead", () => {
	const size = 100000;
	const da = createFilledDynamicArray(size);

	bench(`raw() returns subarray view x${size}`, () => {
		return do_not_optimize(da.raw());
	});

	bench(`toArray() creates copy x${size}`, () => {
		return do_not_optimize(da.toArray());
	});

	bench(`raw().subarray() for partial view x${size}`, () => {
		const view = da.raw();
		return do_not_optimize(view.subarray(0, view.length));
	});
});

group("withRaw() vs alternatives", () => {
	const size = 10000;
	const da = createFilledDynamicArray(size);

	bench(`withRaw() + computation x${size}`, () => {
		return do_not_optimize(
			da.withRaw((view) => {
				let sum = 0;
				let max = 0;
				for (let i = 0; i < view.length; i++) {
					const v = view[i] as number;
					sum += v;
					if (v > max) max = v;
				}
				return { sum, max };
			}),
		);
	});

	bench(`raw() + computation x${size}`, () => {
		const view = da.raw();
		let sum = 0;
		let max = 0;
		for (let i = 0; i < view.length; i++) {
			const v = view[i] as number;
			sum += v;
			if (v > max) max = v;
		}
		return do_not_optimize({ sum, max });
	});

	bench(`toArray() + computation x${size}`, () => {
		const arr = da.toArray();
		let sum = 0;
		let max = 0;
		for (let i = 0; i < arr.length; i++) {
			const v = arr[i] as number;
			sum += v;
			if (v > max) max = v;
		}
		return do_not_optimize({ sum, max });
	});
});
