import { bench, do_not_optimize, group } from "mitata";
import { DynamicArray, DynamicArrayStack } from "../index";
import { SIZES } from "./util";

group("Stack: push", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayStack.push x${size}`, () => {
			const stack = new DynamicArrayStack(10);
			for (let i = 0; i < size; i++) {
				stack.push(i % 256);
			}
			return do_not_optimize(stack);
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

group("Stack: pop", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayStack.pop x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(stack.pop());
			}
			return stack;
		});

		bench(`DynamicArrayStack.safePop x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(stack.safePop());
			}
			return stack;
		});

		bench(`DynamicArrayStack.unsafePop x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			for (let i = 0; i < size; i++) {
				do_not_optimize(stack.unsafePop());
			}
			return stack;
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

group("Stack: peek", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayStack.peek x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				const val = stack.peek();
				if (val !== undefined) result += val;
				stack.pop();
				stack.push(i % 256);
			}
			return do_not_optimize(result);
		});

		bench(`DynamicArrayStack.unsafePeek x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				const val = stack.unsafePeek();
				result += val;
				stack.pop();
				stack.push(i % 256);
			}
			return do_not_optimize(result);
		});

		bench(`DynamicArrayStack.safePeek x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			let result = 0;
			for (let i = 0; i < size; i++) {
				const val = stack.safePeek();
				if (val !== undefined) result += val;
				stack.pop();
				stack.push(i % 256);
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
				da.push(i % 256);
			}
			return do_not_optimize(result);
		});
	}
});

group("Stack: push/pop cycle", () => {
	const CYCLE_SIZES = [100, 1000, 10000, 100000];
	for (const size of CYCLE_SIZES) {
		bench(`Stack push/pop x${size}`, () => {
			const stack = new DynamicArrayStack(10);
			for (let i = 0; i < size; i++) {
				stack.push(i);
				do_not_optimize(stack.pop());
			}
			return do_not_optimize(stack);
		});

		bench(`DynamicArray push/pop x${size}`, () => {
			const da = new DynamicArray(10);
			for (let i = 0; i < size; i++) {
				da.push(i);
				do_not_optimize(da.pop());
			}
			return do_not_optimize(da);
		});

		bench(`Native Array push/pop x${size}`, () => {
			const arr: number[] = [];
			for (let i = 0; i < size; i++) {
				arr.push(i);
				do_not_optimize(arr.pop());
			}
			return do_not_optimize(arr);
		});
	}
});

group("Stack: toArray", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayStack.toArray x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			return do_not_optimize(stack.toArray());
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

group("Stack: Iteration", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayStack for...of x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			let sum = 0;
			for (const v of stack) {
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

group("Stack: clear", () => {
	for (const size of SIZES) {
		bench(`DynamicArrayStack.clear x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			stack.clear();
			return do_not_optimize(stack);
		});

		bench(`DynamicArrayStack.safeClear x${size}`, () => {
			const stack = new DynamicArrayStack(size);
			for (let i = 0; i < size; i++) stack.push(i % 256);

			stack.safeClear();
			return do_not_optimize(stack);
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
