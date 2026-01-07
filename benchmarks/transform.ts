import { bench, do_not_optimize, group } from "mitata";
import { DynamicArray, SerializedDynamicArray } from "../index";
import {
	createFilledArray,
	createFilledDynamicArray,
	createFilledNumArray,
} from "./util";

const size = 1000;
const da = createFilledDynamicArray(size);
const arr = createFilledArray(size);
const na = createFilledNumArray(size);

group("Transformation: map", () => {
	bench("DynamicArray.map", () => {
		return do_not_optimize(da.map((v: number) => v * 2));
	});

	bench("NumArray.map", () => {
		return do_not_optimize(na.map((v: number) => v * 2));
	});

	bench("Native Array.map", () => {
		return do_not_optimize(arr.map((v: number) => v * 2));
	});
});

group("Transformation: filter", () => {
	bench("DynamicArray.filter", () => {
		return do_not_optimize(da.filter((v: number) => v > 128));
	});

	bench("NumArray.filter", () => {
		return do_not_optimize(na.filter((v: number) => v > 128));
	});

	bench("Native Array.filter", () => {
		return do_not_optimize(arr.filter((v: number) => v > 128));
	});
});

group("Transformation: reduce", () => {
	bench("DynamicArray.reduce", () => {
		return do_not_optimize(da.reduce((acc: number, v: number) => acc + v, 0));
	});

	bench("NumArray.reduce", () => {
		return do_not_optimize(na.reduce((acc: number, v: number) => acc + v, 0));
	});

	bench("Native Array.reduce", () => {
		return do_not_optimize(arr.reduce((acc: number, v: number) => acc + v, 0));
	});
});

group("Serialization: SerializedDynamicArray", () => {
	bench("pushObject x100", () => {
		const sda = new SerializedDynamicArray();
		const obj = { id: 1, name: "test", data: [1, 2, 3] };
		for (let i = 0; i < 100; i++) {
			sda.pushObject(obj);
		}
		return do_not_optimize(sda);
	}).gc("inner");

	bench("popObject x100", () => {
		const sda = new SerializedDynamicArray();
		const obj = { id: 1, name: "test", data: [1, 2, 3] };
		for (let i = 0; i < 100; i++) sda.pushObject(obj);

		for (let i = 0; i < 100; i++) {
			do_not_optimize(sda.popObject());
		}
		return sda;
	}).gc("inner");
});
