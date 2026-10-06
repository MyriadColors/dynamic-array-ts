import { DEBUG } from "./constants";
import type { ElementType, TypedArrayConstructor, TypedArrayInstance } from "./types";

export class DynamicArrayDeque<
	T extends TypedArrayConstructor = Uint8ArrayConstructor,
> {
	private _buffer: TypedArrayInstance<T>;
	private _head: number = 0;
	private _length: number = 0;
	private _capacity: number;
	private _maxCapacity: number;
	private _TypedArrayCtor: T;
	private _debug: boolean = false;
	private _zeroElement: ElementType<T>;

	private static readonly DEFAULT_INITIAL_CAPACITY = 10;

	constructor(
		initialCapacity: number = DynamicArrayDeque.DEFAULT_INITIAL_CAPACITY,
		maxCapacity: number = Infinity,
		TypedArrayCtor: T = Uint8Array as T,
		options: { debug?: boolean } = {},
	) {
		if (initialCapacity <= 0) {
			initialCapacity = DynamicArrayDeque.DEFAULT_INITIAL_CAPACITY;
		}
		if (initialCapacity > maxCapacity) {
			throw new RangeError("initialCapacity cannot exceed maxCapacity");
		}
		this._capacity = initialCapacity;
		this._maxCapacity = maxCapacity;
		this._TypedArrayCtor = TypedArrayCtor;
		this._buffer = new TypedArrayCtor(this._capacity) as TypedArrayInstance<T>;
		this._debug = options.debug ?? false;
		this._zeroElement = (
			TypedArrayCtor === BigUint64Array || TypedArrayCtor === BigInt64Array
				? 0n
				: 0
		) as ElementType<T>;
	}

	private _assert(condition: boolean, message: string): void {
		if ((DEBUG || this._debug) && !condition) {
			throw new Error(`[DynamicArrayDeque Assertion Failed] ${message}`);
		}
	}

	private _checkInvariants(): void {
		if (!(DEBUG || this._debug)) return;
		this._assert(this._length >= 0, `_length must be non-negative`);
		this._assert(this._length <= this._capacity, `_length must be <= capacity`);
		this._assert(this._head >= 0, `_head must be non-negative`);
		this._assert(this._head < this._capacity, `_head must be less than capacity`);
	}

	get length(): number {
		return this._length;
	}

	get capacity(): number {
		return this._capacity;
	}

	get maxCapacity(): number {
		return this._maxCapacity;
	}

	get isEmpty(): boolean {
		return this._length === 0;
	}

	private _grow(minCapacityNeeded: number): void {
		let newCapacity = Math.max(this._capacity * 2, minCapacityNeeded);
		if (newCapacity > this._maxCapacity) {
			newCapacity = this._maxCapacity;
			if (this._length > newCapacity) {
				throw new RangeError("Exceeded maxCapacity");
			}
		}

		const newBuffer = new this._TypedArrayCtor(newCapacity) as TypedArrayInstance<T>;
		const newV = newBuffer as unknown as { set(a: ArrayLike<unknown>, o?: number): void };

		if (this._length > 0) {
			const tail = (this._head + this._length) % this._capacity;
			if (this._head < tail || tail === 0) {
				// Contiguous memory
				newV.set(this._buffer.subarray(this._head, this._head + this._length), 0);
			} else {
				// Wrapped memory
				const firstPart = this._buffer.subarray(this._head, this._capacity);
				const secondPart = this._buffer.subarray(0, tail);
				newV.set(firstPart, 0);
				newV.set(secondPart, firstPart.length);
			}
		}

		this._buffer = newBuffer;
		this._capacity = newCapacity;
		this._head = 0;
	}

	pushBack(...values: ElementType<T>[]): number {
		const numValues = values.length;
		if (numValues === 0) return this._length;
		
		if (this._length + numValues > this._capacity) {
			this._grow(this._length + numValues);
		}

		for (let i = 0; i < numValues; i++) {
			const pos = (this._head + this._length + i) % this._capacity;
			(this._buffer as unknown as Record<number, ElementType<T>>)[pos] = values[i] as ElementType<T>;
		}
		
		this._length += numValues;
		if (DEBUG || this._debug) this._checkInvariants();
		return this._length;
	}

	popBack(): ElementType<T> | undefined {
		if (this.isEmpty) {
			return undefined;
		}

		const pos = (this._head + this._length - 1) % this._capacity;
		const value = (this._buffer as unknown as Record<number, ElementType<T>>)[pos] as ElementType<T>;
		this._length--;

		if (DEBUG || this._debug) this._checkInvariants();
		return value;
	}

	safePopBack(): ElementType<T> | undefined {
		if (this.isEmpty) {
			return undefined;
		}

		const pos = (this._head + this._length - 1) % this._capacity;
		const value = (this._buffer as unknown as Record<number, ElementType<T>>)[pos] as ElementType<T>;
		(this._buffer as unknown as Record<number, ElementType<T>>)[pos] = this._zeroElement;
		this._length--;

		if (DEBUG || this._debug) this._checkInvariants();
		return value;
	}

	peekBack(): ElementType<T> | undefined {
		if (this.isEmpty) {
			return undefined;
		}

		const pos = (this._head + this._length - 1) % this._capacity;
		return (this._buffer as unknown as Record<number, ElementType<T>>)[pos] as ElementType<T>;
	}

	pushFront(...values: ElementType<T>[]): number {
		const numValues = values.length;
		if (numValues === 0) return this._length;

		if (this._length + numValues > this._capacity) {
			this._grow(this._length + numValues);
		}

		this._head = (this._head - numValues + this._capacity) % this._capacity;

		for (let i = 0; i < numValues; i++) {
			const pos = (this._head + i) % this._capacity;
			(this._buffer as unknown as Record<number, ElementType<T>>)[pos] = values[numValues - 1 - i] as ElementType<T>;
		}

		this._length += numValues;
		if (DEBUG || this._debug) this._checkInvariants();
		return this._length;
	}

	popFront(): ElementType<T> | undefined {
		if (this.isEmpty) {
			return undefined;
		}

		const value = (this._buffer as unknown as Record<number, ElementType<T>>)[this._head] as ElementType<T>;
		this._head = (this._head + 1) % this._capacity;
		this._length--;

		if (DEBUG || this._debug) this._checkInvariants();
		return value;
	}

	safePopFront(): ElementType<T> | undefined {
		if (this.isEmpty) {
			return undefined;
		}

		const value = (this._buffer as unknown as Record<number, ElementType<T>>)[this._head] as ElementType<T>;
		(this._buffer as unknown as Record<number, ElementType<T>>)[this._head] = this._zeroElement;
		this._head = (this._head + 1) % this._capacity;
		this._length--;

		if (DEBUG || this._debug) this._checkInvariants();
		return value;
	}

	peekFront(): ElementType<T> | undefined {
		if (this.isEmpty) {
			return undefined;
		}
		return (this._buffer as unknown as Record<number, ElementType<T>>)[this._head] as ElementType<T>;
	}

	clear(): void {
		this._head = 0;
		this._length = 0;
		if (DEBUG || this._debug) this._checkInvariants();
	}

	safeClear(): void {
		if (this._length > 0) {
			const tail = (this._head + this._length) % this._capacity;
			if (this._head < tail || tail === 0) {
				// biome-ignore lint/suspicious/noExplicitAny: bypassed union signature
				(this._buffer.subarray(this._head, this._head + this._length) as any).fill(this._zeroElement);
			} else {
				// biome-ignore lint/suspicious/noExplicitAny: bypassed union signature
				(this._buffer.subarray(this._head, this._capacity) as any).fill(this._zeroElement);
				// biome-ignore lint/suspicious/noExplicitAny: bypassed union signature
				(this._buffer.subarray(0, tail) as any).fill(this._zeroElement);
			}
		}
		this._head = 0;
		this._length = 0;
		if (DEBUG || this._debug) this._checkInvariants();
	}

	toArray(): ElementType<T>[] {
		const result = new Array(this._length);
		for (let i = 0; i < this._length; i++) {
			const pos = (this._head + i) % this._capacity;
			result[i] = (this._buffer as unknown as Record<number, ElementType<T>>)[pos] as ElementType<T>;
		}
		return result;
	}

	*[Symbol.iterator](): IterableIterator<ElementType<T>> {
		for (let i = 0; i < this._length; i++) {
			const pos = (this._head + i) % this._capacity;
			yield (this._buffer as unknown as Record<number, ElementType<T>>)[pos] as ElementType<T>;
		}
	}
}
