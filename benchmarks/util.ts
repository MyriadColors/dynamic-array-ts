import NumArray from "typed-numarray";
import { DynamicArray } from "../index";

export const SIZES = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];

export function createFilledDynamicArray(size: number): DynamicArray {
	const da = new DynamicArray(size);
	for (let i = 0; i < size; i++) {
		da.push(i % 256);
	}
	return da;
}

export function createFilledArray(size: number): number[] {
	const arr = new Array(size);
	for (let i = 0; i < size; i++) {
		arr[i] = i % 256;
	}
	return arr;
}

export function createFilledNumArray(size: number) {
	const arr = NumArray("uint8", size);
	for (let i = 0; i < size; i++) {
		arr.set(i, i % 256);
	}
	return arr;
}
