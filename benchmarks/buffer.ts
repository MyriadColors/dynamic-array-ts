import { bench, do_not_optimize, group } from "mitata";
import { DynamicArray } from "../index";

group("Buffer Management", () => {
	bench("reserve(1000) from 10", () => {
		const da = new DynamicArray(10);
		da.reserve(1000);
		return do_not_optimize(da);
	});

	bench("shrinkToFit() from 1000 to 10", () => {
		const da = new DynamicArray(1000);
		for (let i = 0; i < 10; i++) da.push(i);
		da.shrinkToFit();
		return do_not_optimize(da);
	});
});

group("Buffer Resize vs Transfer", () => {
	bench("Manual growth via push (multiple resizes)", () => {
		const da = new DynamicArray(10);
		for (let i = 0; i < 2000; i++) {
			da.push(i % 256);
		}
		return do_not_optimize(da);
	});
});
