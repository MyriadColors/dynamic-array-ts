import { bench, do_not_optimize, group } from "mitata";
import { DynamicArray, DynamicArrayDeque } from "../index";
import { SIZES } from "./util";

group("Deque: pushBack (Append)", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayDeque.pushBack x${size}`, () => {
			const deque = new DynamicArrayDeque(10);
			for (let i = 0; i < size; i++) {
				deque.pushBack(i % 256);
			}
			return do_not_optimize(deque);
		});

		bench(`DynamicArray.push x${size}`, () => {
			const da = new DynamicArray(10);
			for (let i = 0; i < size; i++) {
				da.push(i % 256);
			}
			return do_not_optimize(da);
		});

		bench(`Native Array.push x${size}`, () => {
			const arr = [];
			for (let i = 0; i < size; i++) {
				arr.push(i % 256);
			}
			return do_not_optimize(arr);
		});
	}
});

group("Deque: pushFront (Prepend)", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayDeque.pushFront x${size}`, () => {
			const deque = new DynamicArrayDeque(10);
			for (let i = 0; i < size; i++) {
				deque.pushFront(i % 256);
			}
			return do_not_optimize(deque);
		});

		bench(`DynamicArray.unshift x${size}`, () => {
			const da = new DynamicArray(10);
			for (let i = 0; i < size; i++) {
				da.unshift(i % 256);
			}
			return do_not_optimize(da);
		});

		bench(`Native Array.unshift x${size}`, () => {
			const arr = [];
			for (let i = 0; i < size; i++) {
				arr.unshift(i % 256);
			}
			return do_not_optimize(arr);
		});
	}
});

group("Deque: popBack", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayDeque.popBack x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(deque.popBack());
			}
			return deque;
		});

		bench(`DynamicArrayDeque.safePopBack x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(deque.safePopBack());
			}
			return deque;
		});

		bench(`DynamicArray.pop x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(da.pop());
			}
			return da;
		});

		bench(`Native Array.pop x${size}`, () => {
			const arr = new Array(size).fill(0);
			for (let i = 0; i < size; i++) {
				do_not_optimize(arr.pop());
			}
			return arr;
		});
	}
});

group("Deque: popFront", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayDeque.popFront x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(deque.popFront());
			}
			return deque;
		});

		bench(`DynamicArrayDeque.safePopFront x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(deque.safePopFront());
			}
			return deque;
		});

		bench(`DynamicArray.shift x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(da.shift());
			}
			return da;
		});

		bench(`Native Array.shift x${size}`, () => {
			const arr = new Array(size).fill(0);
			for (let i = 0; i < size; i++) {
				do_not_optimize(arr.shift());
			}
			return arr;
		});
	}
});

group("Deque: Mixed Operations", () => {
	const MIXED_SIZES = [100, 1000, 10000];
	for (const size of MIXED_SIZES) {
		bench(`Deque pushFront/popBack x${size}`, () => {
			const deque = new DynamicArrayDeque(10);
			for (let i = 0; i < size; i++) {
				deque.pushFront(i);
			}
			for (let i = 0; i < size; i++) {
				do_not_optimize(deque.popBack());
			}
			return do_not_optimize(deque);
		});

		bench(`Deque pushBack/popFront x${size}`, () => {
			const deque = new DynamicArrayDeque(10);
			for (let i = 0; i < size; i++) {
				deque.pushBack(i);
			}
			for (let i = 0; i < size; i++) {
				do_not_optimize(deque.popFront());
			}
			return do_not_optimize(deque);
		});

		bench(`Deque alternating x${size}`, () => {
			const deque = new DynamicArrayDeque(10);
			for (let i = 0; i < size; i++) {
				if (i % 2 === 0) {
					deque.pushFront(i);
				} else {
					deque.pushBack(i);
				}
			}
			for (let i = 0; i < size; i++) {
				if (i % 2 === 0) {
					do_not_optimize(deque.popFront());
				} else {
					do_not_optimize(deque.popBack());
				}
			}
			return do_not_optimize(deque);
		});
	}
});

group("Deque: peekFront/peekBack", () => {
	for (const size of SIZES) {
		bench(`Deque.peekFront x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				const val = deque.peekFront();
				if (val !== undefined) result += val;
				deque.popFront();
				deque.pushBack(i % 256);
			}
			return do_not_optimize(result);
		});

		bench(`Deque.peekBack x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				const val = deque.peekBack();
				if (val !== undefined) result += val;
				deque.popBack();
				deque.pushFront(i % 256);
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

		bench(`DynamicArray.peekBack x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				const val = da.peekBack();
				if (val !== undefined) result += val;
				da.pop();
				da.unshift(i % 256);
			}
			return do_not_optimize(result);
		});
	}
});

group("Deque: toArray", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayDeque.toArray x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			return do_not_optimize(deque.toArray());
		});

		bench(`DynamicArray.toArray x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			return do_not_optimize(da.toArray());
		});

		bench(`Native Array.slice x${size}`, () => {
			const arr = new Array(size);
			for (let i = 0; i < size; i++) arr[i] = i % 256;

			return do_not_optimize(arr.slice());
		});
	}
});

group("Deque: Iteration", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayDeque for...of x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			let sum = 0;
			for (const v of deque) {
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
			const arr = new Array(size);
			for (let i = 0; i < size; i++) arr[i] = i % 256;

			let sum = 0;
			for (const v of arr) {
				sum += v;
			}
			return do_not_optimize(sum);
		});
	}
});

group("Deque: clear", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayDeque.clear x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			deque.clear();
			return do_not_optimize(deque);
		});

		bench(`DynamicArrayDeque.safeClear x${size}`, () => {
			const deque = new DynamicArrayDeque(size);
			for (let i = 0; i < size; i++) deque.pushBack(i % 256);

			deque.safeClear();
			return do_not_optimize(deque);
		});

		bench(`DynamicArray.clear x${size}`, () => {
			const da = new DynamicArray(size);
			for (let i = 0; i < size; i++) da.push(i % 256);

			da.clear();
			return do_not_optimize(da);
		});

		bench(`Native Array.length = 0 x${size}`, () => {
			const arr = new Array(size).fill(0);
			arr.length = 0;
			return do_not_optimize(arr);
		});
	}
});
