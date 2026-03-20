import { bench, do_not_optimize, group } from "mitata";
import { DynamicArray } from "../index";

const size = 10_000;
const nativeArray = Array.from({ length: size }, (_, i) => i);

group("Structured Clone (10k Int32)", () => {
	bench("Native JS Array (structuredClone)", () => {
		const cloned = structuredClone(nativeArray);
		return do_not_optimize(cloned);
	});

	bench("Native ArrayBuffer (structuredClone)", () => {
		// Create a fresh buffer each time if we modify it, but we don't
		const buffer = new Int32Array(nativeArray).buffer;
		const cloned = structuredClone(buffer);
		return do_not_optimize(cloned);
	});

	bench("DynamicArray (structuredClone metadata + fromStructured)", () => {
		const da = DynamicArray.from(nativeArray, Int32Array);
		const metadata = (
			(da as unknown as Record<symbol, () => unknown>)[
				Symbol.for("structuredClone")
			] as () => unknown
		)();
		const clonedData = structuredClone(metadata);
		const cloned = DynamicArray.fromStructured(clonedData);
		return do_not_optimize(cloned);
	});
});

group("Buffer Transfer Operations (10k elements)", () => {
	bench("ArrayBuffer.transfer()", () => {
		// We allocate inside so we don't run out of buffers since transfer detaches
		const buffer = new ArrayBuffer(size * 4);
		const transferred = buffer.transfer();
		return do_not_optimize(transferred);
	});

	bench("DynamicArray.transfer()", () => {
		const da = new DynamicArray(size, Infinity, Int32Array);
		const transferred = da.transfer();
		return do_not_optimize(transferred);
	});
});
