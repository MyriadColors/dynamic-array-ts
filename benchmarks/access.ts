import { type BenchContext, bench, do_not_optimize, group } from "mitata";
import { DynamicArray } from "../index";
import {
	createFilledArray,
	createFilledDynamicArray,
	createFilledNumArray,
} from "./util";

const size = 1000;
const da = createFilledDynamicArray(size);
const arr = createFilledArray(size);
const ua = new Uint8Array(arr);
const na = createFilledNumArray(size);

group("Access: get/index", () => {
	bench("DynamicArray.get(500)", () => {
		return do_not_optimize(da.get(500));
	});

	bench("NumArray.at(500)", () => {
		return do_not_optimize(na.at(500));
	});

	bench("Native Array[500]", () => {
		return do_not_optimize(arr[500]);
	});

	bench("Uint8Array[500]", () => {
		return do_not_optimize(ua[500]);
	});
});

group("Access: set/index", () => {
	bench("DynamicArray.set(500, 1)", () => {
		da.set(500, 1);
		return do_not_optimize(da);
	});

	bench("NumArray.set(500, 1)", () => {
		na.set(500, 1);
		return do_not_optimize(na);
	});

	bench("Native Array[500] = 1", () => {
		arr[500] = 1;
		return do_not_optimize(arr);
	});

	bench("Uint8Array[500] = 1", () => {
		ua[500] = 1;
		return do_not_optimize(ua);
	});
});

group("Search: indexOf/includes", () => {
	// Use args to prevent JIT optimization of the search value
	bench(function* (ctx: BenchContext) {
		const target = ctx.get("target");
		yield () => do_not_optimize(da.indexOf(target));
	}).args("target", [0, 500, 999, -1]);

	bench(function* (ctx: BenchContext) {
		const target = ctx.get("target");
		yield () => do_not_optimize(na.indexOf(target));
	}).args("target", [0, 500, 999, -1]);

	bench(function* (ctx: BenchContext) {
		const target = ctx.get("target");
		yield () => do_not_optimize(arr.indexOf(target));
	}).args("target", [0, 500, 999, -1]);
});
