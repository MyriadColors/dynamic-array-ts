import { bench, do_not_optimize, group } from "mitata";
import { RingBuffer } from "../index";
import { SIZES } from "./util";

group("RingBuffer: write", () => {
	for (const size of SIZES) {
		bench(`RingBuffer.write x${size}`, () => {
			const rb = new RingBuffer(size + 100);
			for (let i = 0; i < size; i++) {
				rb.write(i % 256);
			}
			return do_not_optimize(rb);
		});

		bench(`DynamicArray.push x${size}`, () => {
			const da = new DynamicArray(size + 100);
			for (let i = 0; i < size; i++) {
				da.push(i % 256);
			}
			return do_not_optimize(da);
		});

		bench(`Native Array.push x${size}`, () => {
			const arr: number[] = [];
			for (let i = 0; i < size; i++) {
				arr.push(i % 256);
			}
			return do_not_optimize(arr);
		});
	}
});

group("RingBuffer: read", () => {
	for (const size of SIZES) {
		bench(`RingBuffer.read x${size}`, () => {
			const rb = new RingBuffer(size);
			for (let i = 0; i < size; i++) rb.write(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				result += rb.read();
			}
			return do_not_optimize(result);
		});

		bench(`DynamicArray.shift x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				result += da.shift() ?? 0;
			}
			return do_not_optimize(result);
		});

		bench(`Native Array.shift x${size}`, () => {
			const arr: number[] = [];
			for (let i = 0; i < size; i++) arr.push(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				result += arr.shift() ?? 0;
			}
			return do_not_optimize(result);
		});
	}
});

group("RingBuffer: peek", () => {
	for (const size of SIZES) {
		bench(`RingBuffer.peek x${size}`, () => {
			const rb = new RingBuffer(size);
			for (let i = 0; i < size; i++) rb.write(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				const val = rb.peek();
				result += val;
				rb.read();
				rb.write(i % 256);
			}
			return do_not_optimize(result);
		});

		bench(`DynamicArray.peekFront x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				const val = da.peekFront();
				if (val !== undefined) result += val;
				da.shift();
				da.push(i % 256);
			}
			return do_not_optimize(result);
		});

		bench(`Native Array[0] x${size}`, () => {
			const arr: number[] = [];
			for (let i = 0; i < size; i++) arr.push(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				result += arr[0] ?? 0;
				arr.shift();
				arr.push(i % 256);
			}
			return do_not_optimize(result);
		});
	}
});

group("RingBuffer: wrap-around write/read", () => {
	const WRAP_SIZES = [100, 1000, 10000, 100000];
	for (const size of WRAP_SIZES) {
		bench(`RingBuffer wrap-around x${size}`, () => {
			const rb = new RingBuffer(100);
			let result = 0;
			for (let i = 0; i < size; i++) {
				rb.write(i % 256);
				result += rb.read();
			}
			return do_not_optimize(result);
		});

		bench(`DynamicArray wrap-around x${size}`, () => {
			const da = new DynamicArray(100, 100);
			let result = 0;
			for (let i = 0; i < size; i++) {
				da.push(i % 256);
				result += da.shift() ?? 0;
			}
			return do_not_optimize(result);
		});

		bench(`Native Array wrap-around x${size}`, () => {
			const arr: number[] = [];
			let result = 0;
			for (let i = 0; i < size; i++) {
				arr.push(i % 256);
				result += arr.shift() ?? 0;
			}
			return do_not_optimize(result);
		});
	}
});

group("RingBuffer: toArray", () => {
	for (const size of SIZES) {
		bench(`RingBuffer.toArray x${size}`, () => {
			const rb = new RingBuffer(size);
			for (let i = 0; i < size; i++) rb.write(i % 256);

			return do_not_optimize(rb.toArray());
		});

		bench(`DynamicArray.toArray x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			return do_not_optimize(da.toArray());
		});

		bench(`Native Array.slice x${size}`, () => {
			const arr: number[] = [];
			for (let i = 0; i < size; i++) arr.push(i % 256);

			return do_not_optimize(arr.slice());
		});
	}
});

group("RingBuffer: Iteration", () => {
	for (const size of SIZES) {
		bench(`RingBuffer for...of x${size}`, () => {
			const rb = new RingBuffer(size);
			for (let i = 0; i < size; i++) rb.write(i % 256);

			let sum = 0;
			for (const v of rb) {
				sum += v;
			}
			return do_not_optimize(sum);
		});

		bench(`DynamicArray for...of x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			let sum = 0;
			for (const v of da) {
				sum += v;
			}
			return do_not_optimize(sum);
		});

		bench(`Native Array for...of x${size}`, () => {
			const arr: number[] = [];
			for (let i = 0; i < size; i++) arr.push(i % 256);

			let sum = 0;
			for (const v of arr) {
				sum += v;
			}
			return do_not_optimize(sum);
		});
	}
});

group("RingBuffer: clear", () => {
	for (const size of SIZES) {
		bench(`RingBuffer.clear x${size}`, () => {
			const rb = new RingBuffer(size);
			for (let i = 0; i < size; i++) rb.write(i % 256);

			rb.clear();
			return do_not_optimize(rb);
		});

		bench(`DynamicArray.clear x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			da.clear();
			return do_not_optimize(da);
		});

		bench(`Native Array.length = 0 x${size}`, () => {
			const arr: number[] = [];
			for (let i = 0; i < size; i++) arr.push(i % 256);
			arr.length = 0;
			return do_not_optimize(arr);
		});
	}
});

import { DynamicArray } from "../index";
