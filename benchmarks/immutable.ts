import { bench, do_not_optimize, group } from "mitata";
import { DynamicArray } from "../index";
import {
	createFilledArray,
	createFilledDynamicArray,
	TRANSFORM_SIZES,
} from "./util";

const IMMUTABLE_SIZES = [100, 1000, 10000, 50000];

group("Immutable: pushed (Append)", () => {
	for (const size of IMMUTABLE_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.pushed x${size}`, () => {
			return do_not_optimize(da.pushed(1, 2, 3));
		});

		bench(`Native Array.pushed x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize(arr.push(1, 2, 3));
		});
	}
});

group("Immutable: shifted (Remove First)", () => {
	for (const size of IMMUTABLE_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.shifted x${size}`, () => {
			return do_not_optimize(da.shifted());
		});

		bench(`Native Array.shifted x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize(arr.slice(1));
		});
	}
});

group("Immutable: spliced (Replace Middle)", () => {
	const SPLICE_SIZES = [100, 1000, 10000];
	for (const size of SPLICE_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.spliced x${size}`, () => {
			return do_not_optimize(da.spliced(Math.floor(size / 2), 2, 100, 200));
		});

		bench(`Native Array.spliced x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize([
				...arr.slice(0, Math.floor(size / 2)),
				100,
				200,
				...arr.slice(Math.floor(size / 2) + 2),
			]);
		});
	}
});

group("Immutable: unshifted (Prepend)", () => {
	for (const size of IMMUTABLE_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.unshifted x${size}`, () => {
			return do_not_optimize(da.unshifted(1, 2, 3));
		});

		bench(`Native Array.unshifted x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize([1, 2, 3, ...arr]);
		});
	}
});

group("Immutable: truncated (Shorten)", () => {
	for (const size of IMMUTABLE_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.truncated x${size}`, () => {
			return do_not_optimize(da.truncated(Math.floor(size / 2)));
		});

		bench(`Native Array.truncated x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize(arr.slice(0, Math.floor(size / 2)));
		});
	}
});

group("Immutable: filled (Fill Range)", () => {
	for (const size of IMMUTABLE_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.filled x${size}`, () => {
			return do_not_optimize(da.filled(0));
		});

		bench(`Native Array.filled x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize(arr.fill(0));
		});
	}
});

group("Immutable: cleared (Clear)", () => {
	for (const size of IMMUTABLE_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.cleared x${size}`, () => {
			return do_not_optimize(da.cleared());
		});

		bench(`Native Array.cleared x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize([]);
		});
	}
});

group("Immutable: reversed", () => {
	for (const size of IMMUTABLE_SIZES) {
		const da = createFilledDynamicArray(size);

		bench(`DynamicArray.reversed x${size}`, () => {
			return do_not_optimize(da.reversed());
		});

		bench(`Native Array.reversed x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize([...arr].reverse());
		});
	}
});

group("Immutable: sorted", () => {
	const SORT_SIZES = [100, 1000, 10000];
	for (const size of SORT_SIZES) {
		const da = new DynamicArray(size);
		for (let i = 0; i < size; i++) da.push((Math.random() * 255) | 0);

		bench(`DynamicArray.sorted x${size}`, () => {
			return do_not_optimize(da.sorted());
		});

		bench(`Native Array.sorted x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize([...arr].sort((a, b) => a - b));
		});
	}
});

group("Immutable: sortedWith", () => {
	const SORT_SIZES = [100, 1000, 10000];
	for (const size of SORT_SIZES) {
		const da = new DynamicArray(size);
		for (let i = 0; i < size; i++) da.push((Math.random() * 255) | 0);

		bench(`DynamicArray.sortedWith x${size}`, () => {
			return do_not_optimize(da.sortedWith((a, b) => b - a));
		});

		bench(`Native Array.sortedWith x${size}`, () => {
			const arr = [...da.toArray()];
			return do_not_optimize([...arr].sort((a: number, b: number) => b - a));
		});
	}
});

group("Immutable: Comparison (push vs pushed)", () => {
	const SIZE = 10000;

	bench(`DynamicArray.push (mutating) x${SIZE}`, () => {
		const da = new DynamicArray(10);
		for (let i = 0; i < SIZE; i++) {
			da.push(i);
		}
		return do_not_optimize(da);
	});

	bench(`DynamicArray.pushed (immutable) x${SIZE}`, () => {
		let da = new DynamicArray(10);
		for (let i = 0; i < SIZE; i++) {
			da = da.pushed(i);
		}
		return do_not_optimize(da);
	});

	bench(`Native Array.push (mutating) x${SIZE}`, () => {
		const arr: number[] = [];
		for (let i = 0; i < SIZE; i++) {
			arr.push(i);
		}
		return do_not_optimize(arr);
	});

	bench(`Native Array with spread (immutable) x${SIZE}`, () => {
		let arr: number[] = [];
		for (let i = 0; i < SIZE; i++) {
			arr = [...arr, i];
		}
		return do_not_optimize(arr);
	});
});
