import { bench, do_not_optimize } from "mitata";
import { DynamicArray } from "../index";

bench("DynamicArray.forEachSnapshot (100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	return do_not_optimize(da.forEachSnapshot((x) => x));
});

bench("DynamicArray.forEach (100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	// biome-ignore lint/complexity/noForEach: For testing purposes
	return do_not_optimize(
		da.forEach((x) => {
			x;
		}),
	);
});

bench("DynamicArrray.forOf (100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	return do_not_optimize(
		da.forOf((x) => {
			x;
		}),
	);
});

bench("DynamicArrray.get (100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	return do_not_optimize(da.get(99999));
});

bench("DynamicArray.unsafeGet (100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	return do_not_optimize(da.unsafeGet(99999));
});

bench("DynamicArray.push(100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	return do_not_optimize(da);
});

bench("DynamicArray.pushAligned(100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.pushAligned(8, i);
	}
	return do_not_optimize(da);
});

bench("DynamicArray.shift (100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	return do_not_optimize(da.shift());
});

bench("DynamicArray.pop (100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	return do_not_optimize(da.pop());
});

bench("DynamicArray.unsafePop (100000)", () => {
	const da = new DynamicArray(100000);
	for (let i = 0; i < 100000; i++) {
		da.push(i);
	}
	return do_not_optimize(da.unsafePop());
});
