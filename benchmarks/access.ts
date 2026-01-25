import { type BenchContext, bench, do_not_optimize, group } from "mitata";
import {
	ACCESS_SIZES,
	createFilledArray,
	createFilledDynamicArray,
	createFilledNumArray,
	SIZES,
} from "./util";

group("Access: get/index", () => {
	for (const size of ACCESS_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);
		const ua = new Uint8Array(arr);
		const na = createFilledNumArray(size);
		const idx = Math.floor(size / 2);

		bench(`DynamicArray.get(${size})`, () => {
			return do_not_optimize(da.get(idx));
		});

		bench(`DynamicArray.unsafeGet(${size})`, () => {
			return do_not_optimize(da.unsafeGet(idx));
		});

		bench(`DynamicArray.at(${size})`, () => {
			return do_not_optimize(da.at(idx));
		});

		bench(`NumArray.at(${size})`, () => {
			return do_not_optimize(na.at(idx));
		});

		bench(`Native Array[${size}]`, () => {
			return do_not_optimize(arr[idx]);
		});

		bench(`Uint8Array[${size}]`, () => {
			return do_not_optimize(ua[idx]);
		});
	}
});

group("Access: peek", () => {
	const size = 1000;
	const da = createFilledDynamicArray(size);

	bench("DynamicArray.peekFront", () => {
		return do_not_optimize(da.peekFront());
	});

	bench("DynamicArray.peekBack", () => {
		return do_not_optimize(da.peekBack());
	});
});

group("Access: set/index", () => {
	for (const size of ACCESS_SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);
		const ua = new Uint8Array(arr);
		const na = createFilledNumArray(size);
		const idx = Math.floor(size / 2);

		bench(`DynamicArray.set(${size})`, () => {
			da.set(idx, 1);
			return do_not_optimize(da);
		});

		bench(`NumArray.set(${size})`, () => {
			na.set(idx, 1);
			return do_not_optimize(na);
		});

		bench(`Native Array[${size}] = 1`, () => {
			arr[idx] = 1;
			return do_not_optimize(arr);
		});

		bench(`Uint8Array[${size}] = 1`, () => {
			ua[idx] = 1;
			return do_not_optimize(ua);
		});
	}
});

group("Search: indexOf", () => {
	for (const size of SIZES) {
		const da = createFilledDynamicArray(size);
		const arr = createFilledArray(size);
		const na = createFilledNumArray(size);

		const targets = [0, Math.floor(size / 2), size - 1, -1];

		bench(`DynamicArray.indexOf x${size}`, function* (ctx: BenchContext) {
			const targetIndex = ctx.get("targetIndex") as number;
			const target = targetIndex === -1 ? -1 : targetIndex % 256;
			yield () => do_not_optimize(da.indexOf(target));
		}).args("targetIndex", targets);

		bench(`NumArray.indexOf x${size}`, function* (ctx: BenchContext) {
			const targetIndex = ctx.get("targetIndex") as number;
			const target = targetIndex === -1 ? -1 : targetIndex % 256;
			yield () => do_not_optimize(na.indexOf(target));
		}).args("targetIndex", targets);

		bench(`Native Array.indexOf x${size}`, function* (ctx: BenchContext) {
			const targetIndex = ctx.get("targetIndex") as number;
			const target = targetIndex === -1 ? -1 : targetIndex % 256;
			yield () => do_not_optimize(arr.indexOf(target));
		}).args("targetIndex", targets);
	}
});

group("Search: lastIndexOf", () => {
	const size = 1000;
	const da = createFilledDynamicArray(size);
	const arr = createFilledArray(size);

	const targets = [0, Math.floor(size / 2), size - 1, -1];

	bench("DynamicArray.lastIndexOf", function* (ctx: BenchContext) {
		const targetIndex = ctx.get("targetIndex") as number;
		const target = targetIndex === -1 ? -1 : targetIndex % 256;
		yield () => do_not_optimize(da.lastIndexOf(target));
	}).args("targetIndex", targets);

	bench("Native Array.lastIndexOf", function* (ctx: BenchContext) {
		const targetIndex = ctx.get("targetIndex") as number;
		const target = targetIndex === -1 ? -1 : targetIndex % 256;
		yield () => do_not_optimize(arr.lastIndexOf(target));
	}).args("targetIndex", targets);
});
