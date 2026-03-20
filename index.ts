import type {
	ElementType,
	TypedArrayConstructor,
	TypedArrayInstance,
} from "./src/types";

const SAFE_OVERRIDES: Record<string | symbol, string> = {
	pop: "safePop",
	shift: "safeShift",
	splice: "safeSplice",
	truncate: "safeTruncate",
	clear: "safeClear",
};

const SECURED_METHODS = new Set([
	"slice",
	"map",
	"filter",
	"concat",
	"secured",
]);

/**
 * A dynamically-sized typed array with automatic buffer management.
 * Uses modern ArrayBuffer.resize() and transfer() when available.
 */
export class DynamicArray<
	T extends TypedArrayConstructor = Uint8ArrayConstructor,
> {
	private _buffer: ArrayBuffer;
	private view: TypedArrayInstance<T>;
	private _length: number;
	private _version: number = 0;
	private _capacity: number;
	private _initialCapacity: number;
	private readonly _maxCapacity: number;
	private _head: number = 0;
	private TypedArrayCtor: T;
	private bytesPerElement: number;
	private zeroElement: ElementType<T>;
	private supportsResize: boolean = false;
	private supportsTransfer: boolean = false;

	private static readonly DEFAULT_INITIAL_CAPACITY = 10;
	private static readonly GROWTH_FACTOR = 2;
	private static readonly SHRINK_THRESHOLD = 0.25;
	private static readonly MIN_SHRINK_CAPACITY = 10;

	/**
	 * Create a DynamicArray from an array-like or iterable source.
	 * @param source - The source elements to copy into the new array
	 * @param TypedArrayCtor - The TypedArray constructor (e.g., Float32Array, Uint8Array)
	 * @param options - Optional parameters
	 * @param options.initialCapacity - Initial buffer capacity (defaults to source length)
	 * @param options.maxCapacity - Maximum buffer capacity (defaults to Infinity)
	 */
	static from<U extends TypedArrayConstructor>(
		source: ArrayLike<ElementType<U>> | Iterable<ElementType<U>>,
		TypedArrayCtor: U,
		options?: {
			initialCapacity?: number;
			maxCapacity?: number;
		},
	): DynamicArray<U> {
		const arr = Array.isArray(source) ? source : Array.from(source);
		const { initialCapacity = arr.length, maxCapacity = Infinity } =
			options ?? {};
		const da = new DynamicArray<U>(
			Math.max(initialCapacity, 1),
			maxCapacity,
			TypedArrayCtor,
		);
		da.push(arr as ArrayLike<ElementType<U>>);
		return da;
	}

	constructor(
		initialCapacity: number = DynamicArray.DEFAULT_INITIAL_CAPACITY,
		maxCapacity: number = Infinity,
		TypedArrayCtor: T = Uint8Array as T,
	) {
		this.TypedArrayCtor = TypedArrayCtor;
		this.bytesPerElement = TypedArrayCtor.BYTES_PER_ELEMENT;
		this.zeroElement = (
			TypedArrayCtor === BigUint64Array || TypedArrayCtor === BigInt64Array
				? 0n
				: 0
		) as ElementType<T>;
		this._initialCapacity = Math.max(1, initialCapacity);
		this._length = 0;
		this._capacity = this._initialCapacity;

		this.validateCapacityBounds(this._initialCapacity, maxCapacity);
		this._maxCapacity = maxCapacity;
		this.detectFeatureSupport();

		const initialByteLength = this._initialCapacity * this.bytesPerElement;
		const options = this.createBufferOptions(maxCapacity);

		this._buffer = new ArrayBuffer(initialByteLength, options);
		this.view = new TypedArrayCtor(this._buffer) as TypedArrayInstance<T>;
	}

	// ============= Internal Helpers =============
	// These centralize type casts to minimize scattered "as unknown as" throughout the code

	/** Single centralized cast — the ONLY place as-unknown-as appears for view access */
	private get v(): Record<number, ElementType<T>> & {
		set(a: ArrayLike<unknown>, o?: number): void;
		copyWithin(t: number, s: number, e?: number): void;
		fill(v: ElementType<T>, s?: number, e?: number): void;
		subarray(s?: number, e?: number): TypedArrayInstance<T>;
	} {
		return this.view as unknown as Record<number, ElementType<T>> & {
			set(a: ArrayLike<unknown>, o?: number): void;
			copyWithin(t: number, s: number, e?: number): void;
			fill(v: ElementType<T>, s?: number, e?: number): void;
			subarray(s?: number, e?: number): TypedArrayInstance<T>;
		};
	}

	/** Get element at index (internal, assumes bounds valid) */
	private getElement(index: number): ElementType<T> {
		const value = this.v[this._head + index];
		if (value === undefined) {
			throw new RangeError(`Index ${index} out of bounds`);
		}
		return value;
	}

	/** Set element at index (internal, assumes bounds valid) */
	private setElement(index: number, value: ElementType<T>): void {
		const realIndex = this._head + index;
		if (this.v[realIndex] === undefined) {
			// Check real buffer bounds
			throw new RangeError(`Index ${index} out of bounds`);
		}
		this.v[realIndex] = value;
	}

	/** Internal helper to zero a range of elements in the buffer */
	private zeroRange(start: number, end: number): void {
		if (start >= end) return;
		this.v.fill(this.zeroElement, start, end);
	}

	/** Copy data between views using set() */
	private copyFromSubarray(
		target: TypedArrayInstance<T>,
		source: TypedArrayInstance<T>,
		offset = 0,
	): void {
		(target as { set(a: ArrayLike<unknown>, o?: number): void }).set(
			source,
			offset,
		);
	}

	/** Create a new view of the given buffer */
	private createView(buffer: ArrayBuffer): TypedArrayInstance<T> {
		return new this.TypedArrayCtor(buffer) as TypedArrayInstance<T>;
	}

	// ============= Capacity Management =============

	private validateCapacityBounds(initial: number, max: number): void {
		if (initial < 1) {
			throw new RangeError(
				`Initial capacity must be at least 1, got ${initial}`,
			);
		}
		if (max < Infinity && initial > max) {
			throw new RangeError(
				`Initial capacity (${initial}) cannot exceed maximum capacity (${max})`,
			);
		}
	}

	private detectFeatureSupport(): void {
		this.supportsResize = "resize" in ArrayBuffer.prototype;
		this.supportsTransfer = "transfer" in ArrayBuffer.prototype;
	}

	private createBufferOptions(
		maxCapacity: number,
	): { maxByteLength: number } | undefined {
		if (maxCapacity < Infinity && this.supportsResize) {
			return { maxByteLength: maxCapacity * this.bytesPerElement };
		}
		return;
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

	/**
	 * Get the underlying ArrayBuffer.
	 */
	get buffer(): ArrayBuffer {
		return this._buffer;
	}

	get byteLength(): number {
		return this._buffer.byteLength;
	}

	private growCapacity(minimumCapacity: number): void {
		const currentCapacity = this.capacity;
		const newCapacity = Math.max(
			minimumCapacity,
			Math.ceil(currentCapacity * DynamicArray.GROWTH_FACTOR),
		);

		this.resizeBuffer(newCapacity);
	}

	private shrinkCapacity(): void {
		const currentCapacity = this.capacity;
		const targetCapacity = Math.max(
			DynamicArray.MIN_SHRINK_CAPACITY,
			Math.ceil(currentCapacity / DynamicArray.GROWTH_FACTOR),
		);

		if (targetCapacity < currentCapacity) {
			this.resizeBuffer(targetCapacity);
		}
	}

	private resizeBuffer(newCapacity: number): void {
		this._version++;
		// Invariant: shrinking can never violate this — newCapacity < _capacity ≤ _maxCapacity.
		// This guard exists purely to catch growth paths (growCapacity, reserve).
		if (newCapacity > this._maxCapacity) {
			throw new RangeError(
				`Cannot resize to ${newCapacity}: exceeds maxCapacity (${this._maxCapacity})`,
			);
		}

		if (this._head > 0) {
			this.compact();
		}

		const newByteLength = newCapacity * this.bytesPerElement;

		const maxByteLength = this._buffer.maxByteLength;
		if (
			this._buffer.resizable &&
			maxByteLength !== undefined &&
			newByteLength <= maxByteLength
		) {
			this._buffer.resize(newByteLength);
			this.view = this.createView(this._buffer);
		} else if (this.supportsTransfer) {
			this._buffer = this._buffer.transfer(newByteLength);
			this.view = this.createView(this._buffer);
		} else {
			const newBuffer = new ArrayBuffer(newByteLength);
			const newView = this.createView(newBuffer);
			const copyLength = Math.min(this._length, newCapacity);
			this.copyFromSubarray(
				newView,
				this.view.subarray(0, copyLength) as TypedArrayInstance<T>,
			);
			this._buffer = newBuffer;
			this.view = newView;
		}
		this._capacity = newCapacity;
	}

	private shouldShrink(): boolean {
		return (
			this.capacity > DynamicArray.MIN_SHRINK_CAPACITY &&
			this._length < this.capacity * DynamicArray.SHRINK_THRESHOLD
		);
	}

	// ============= Core Mutation Methods =============

	/**
	 * Add elements to the end of the array.
	 * Supports scalars and array-like objects (e.g. other TypedArrays, Arrays) for efficient bulk insertion.
	 * @returns The new length of the array.
	 */
	push(...items: (ElementType<T> | ArrayLike<ElementType<T>>)[]): number {
		let addedLength = 0;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (typeof item === "object" && item !== null && "length" in item) {
				addedLength += (item as ArrayLike<ElementType<T>>).length;
			} else {
				addedLength++;
			}
		}

		const newLength = this._length + addedLength;
		// Check capacity against (head + new length), not just length
		if (this._head + newLength > this.capacity) {
			// If we have a lot of empty space at the front, compact instead of grow
			if (this._head > this.capacity * 0.2) {
				this.compact();
			}
			// If still not enough space, grow
			if (this._length + addedLength > this.capacity) {
				this.growCapacity(newLength);
			}
		}

		let offset = this._head + this._length;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (typeof item === "object" && item !== null && "length" in item) {
				this.v.set(item as ArrayLike<ElementType<T>>, offset);
				offset += (item as ArrayLike<ElementType<T>>).length;
			} else {
				this.v[offset++] = item as ElementType<T>;
			}
		}

		this._length = newLength;
		return this._length;
	}

	/**
	 * Push elements to the array, with automatic padding to align to a given boundary.
	 * @warn This is MUCH slower than the normal push method.
	 */
	pushAligned(alignment: number, ...values: ElementType<T>[]) {
		const remainder = this._length % alignment;
		if (remainder !== 0) {
			const padding = alignment - remainder;
			// Direct loop is faster than Array.from allocation for small numbers
			// Or assume buffer is zero-initialized and just increment length?
			// Safer to explicit push.
			for (let i = 0; i < padding; i++) {
				this.push(this.zeroElement);
			}
		}
		this.push(...values);
		return this;
	}

	/**
	 * Remove and return the last element.
	 */
	pop(): ElementType<T> | undefined {
		if (this._length === 0) {
			return;
		}

		const value = this.getElement(--this._length);

		if (this.shouldShrink()) {
			this.shrinkCapacity();
		}

		return value;
	}

	/**
	 * Removes the last element without bounds checking or shrinking.
	 * ⚠️ undefined behavior if array is empty.
	 * ⚠️ Does not release memory (capacity stays same).
	 */
	unsafePop(): ElementType<T> {
		// Direct index access, no checks
		return this.v[this._head + --this._length] as ElementType<T>;
	}

	/**
	 * Remove and return the last element, zeroing the freed position.
	 * Performance: ~1.5-2x slower than pop() due to extra write operation.
	 * @returns The removed element, or undefined if array is empty.
	 */
	safePop(): ElementType<T> | undefined {
		if (this._length === 0) {
			return;
		}

		const value = this.getElement(--this._length);
		this.zeroRange(this._head + this._length, this._head + this._length + 1);

		if (this.shouldShrink()) {
			this.shrinkCapacity();
		}

		return value;
	}

	/**
	 * Add elements to the beginning of the array.
	 * @returns The new length of the array.
	 */
	unshift(...values: ElementType<T>[]): number {
		const count = values.length;
		if (count === 0) return this._length;

		if (count <= this._head) {
			this._head -= count;
			this._length += count;
			if (count === 1) {
				const first = values[0];
				if (first !== undefined) {
					this.setElement(0, first);
				}
			} else {
				this.v.set(values, this._head);
			}
			return this._length;
		}

		if (this._head > 0) this.compact();

		const newLength = this._length + count;
		if (newLength > this.capacity) {
			this.growCapacity(newLength);
		}

		if (this._length > 0) {
			this.v.copyWithin(count, 0, this._length);
		}

		if (count === 1) {
			const first = values[0];
			if (first !== undefined) {
				this.setElement(0, first);
			}
		} else {
			this.v.set(values, 0);
		}

		this._length = newLength;
		return this._length;
	}

	/**
	 * Remove and return the first element.
	 * This should be faster than shift() if the array is compacted.
	 */
	shift(): ElementType<T> | undefined {
		if (this._length === 0) return;
		const value = this.v[this._head];
		this._head++;
		this._length--;

		// Optional: Reset if empty to regain space cheaply
		if (this._length === 0) this._head = 0;
		if (this._head > this.capacity / 2) this.compact();

		return value;
	}

	/**
	 * Remove and return the first element, zeroing the freed position.
	 * Performance: ~2x slower than shift() due to extra write operation.
	 * @returns The removed element, or undefined if array is empty.
	 */
	safeShift(): ElementType<T> | undefined {
		if (this._length === 0) return;

		const oldHead = this._head;
		const value = this.v[oldHead];
		this._head++;
		this._length--;

		this.zeroRange(this._head - 1, this._head);

		// Optional: Reset if empty to regain space cheaply
		if (this._length === 0) this._head = 0;
		if (this._head > this.capacity / 2) this.compact();

		return value;
	}

	/**
	 * Compacts the array by moving all elements to the start of the buffer.
	 */
	compact(): void {
		if (this._head === 0) return;

		this._version++;
		const oldEnd = this._head + this._length;

		this.v.copyWithin(0, this._head, oldEnd);

		this.zeroRange(this._length, oldEnd);

		this._head = 0;
	}

	/**
	 * Insert/remove elements at any position.
	 * @param start The index at which to start changing the array.
	 * @param deleteCount The number of elements to remove.
	 * @param items Elements to insert at the start position.
	 * @returns An array containing the deleted elements.
	 */
	splice(
		start: number,
		deleteCount: number = this._length - start,
		...items: ElementType<T>[]
	): ElementType<T>[] {
		const normalizedStart = this.normalizeIndex(start);
		const actualDeleteCount = Math.min(
			Math.max(0, deleteCount),
			this._length - normalizedStart,
		);

		// Collect deleted elements using native subarray and conversion
		const deleted = Array.from(
			this.view.subarray(
				this._head + normalizedStart,
				this._head + normalizedStart + actualDeleteCount,
			) as unknown as Iterable<ElementType<T>>,
		);

		const netChange = items.length - actualDeleteCount;
		const newLength = this._length + netChange;

		if (this._head + newLength > this.capacity) {
			this.growCapacity(newLength);
		}

		if (netChange !== 0 && normalizedStart + actualDeleteCount < this._length) {
			// Shift elements to the left or right to make room or fill gaps
			this.v.copyWithin(
				this._head + normalizedStart + items.length,
				this._head + normalizedStart + actualDeleteCount,
				this._head + this._length,
			);
		}

		// Insert new items
		if (items.length > 0) {
			this.v.set(items, this._head + normalizedStart);
		}

		this._length = newLength;

		if (this.shouldShrink()) {
			this.shrinkCapacity();
		}

		return deleted;
	}

	/**
	 * Insert/remove elements at any position, zeroing freed positions.
	 * Performance: ~2x slower than splice() depending on data moved.
	 * @param start The index at which to start changing the array.
	 * @param deleteCount The number of elements to remove.
	 * @param items Elements to insert at the start position.
	 * @returns An array containing the deleted elements.
	 */
	safeSplice(
		start: number,
		deleteCount: number = this._length - start,
		...items: ElementType<T>[]
	): ElementType<T>[] {
		const normalizedStart = this.normalizeIndex(start);
		const actualDeleteCount = Math.min(
			Math.max(0, deleteCount),
			this._length - normalizedStart,
		);

		// Collect deleted elements using native subarray and conversion
		const deleted = Array.from(
			this.view.subarray(
				this._head + normalizedStart,
				this._head + normalizedStart + actualDeleteCount,
			) as unknown as Iterable<ElementType<T>>,
		);

		const netChange = items.length - actualDeleteCount;
		const newLength = this._length + netChange;
		const oldLength = this._length;

		if (this._head + newLength > this.capacity) {
			this.growCapacity(newLength);
		}

		if (netChange !== 0 && normalizedStart + actualDeleteCount < this._length) {
			// Shift elements to the left or right to make room or fill gaps
			this.v.copyWithin(
				this._head + normalizedStart + items.length,
				this._head + normalizedStart + actualDeleteCount,
				this._head + this._length,
			);
		}

		// Insert new items
		if (items.length > 0) {
			this.v.set(items, this._head + normalizedStart);
		}

		// Zero the tail that's no longer used
		if (actualDeleteCount > items.length) {
			this.zeroRange(this._head + newLength, this._head + oldLength);
		}

		this._length = newLength;

		if (this.shouldShrink()) {
			this.shrinkCapacity();
		}

		return deleted;
	}

	// ============= Element Access =============

	/**
	 * Get element at index (throws on out-of-bounds).
	 */
	get(index: number): ElementType<T> {
		this.validateIndex(index);
		return this.getElement(index);
	}

	/**
	 * Get element at index, without bounds checking.
	 * Performance is only slightly better than the safe get method.
	 * @warn Use with caution, no bounds checking is performed.
	 */
	public unsafeGet(index: number): ElementType<T> {
		return this.v[this._head + index] as ElementType<T>;
	}

	/**
	 * Get element at index, supporting negative indices (like Array.prototype.at).
	 * Returns undefined for out-of-bounds access.
	 */
	at(index: number): ElementType<T> | undefined {
		const normalizedIndex = index < 0 ? this._length + index : index;
		if (normalizedIndex < 0 || normalizedIndex >= this._length) {
			return;
		}
		return this.getElement(normalizedIndex);
	}

	/**
	 * Set element at index (throws on out-of-bounds).
	 */
	set(index: number, value: ElementType<T>): void {
		this.validateIndex(index);
		this.setElement(index, value);
	}

	private validateIndex(index: number): void {
		if (index < 0 || index >= this._length) {
			throw new RangeError(`Index ${index} out of bounds [0, ${this._length})`);
		}
	}

	// ============= Slicing & Copying =============

	/**
	 * Create a new DynamicArray with a copy of elements in the given range.
	 */
	slice(start: number = 0, end: number = this._length): DynamicArray<T> {
		const normalizedStart = this.normalizeIndex(start);
		const normalizedEnd = this.normalizeIndex(end);
		const sliceLength = Math.max(0, normalizedEnd - normalizedStart);

		const result = new DynamicArray<T>(
			Math.max(1, sliceLength),
			Infinity,
			this.TypedArrayCtor,
		);
		this.copyFromSubarray(
			result.view,
			this.view.subarray(
				this._head + normalizedStart,
				this._head + normalizedEnd,
			) as TypedArrayInstance<T>,
		);
		result._length = sliceLength;

		return result;
	}

	private normalizeIndex(index: number): number {
		if (index < 0) {
			return Math.max(0, this._length + index);
		}
		return Math.min(index, this._length);
	}

	/**
	 * Concatenate with another DynamicArray of the same type.
	 */
	concat(other: DynamicArray<T>): DynamicArray<T> {
		const totalLength = this._length + other._length;
		const result = new DynamicArray<T>(
			Math.max(1, totalLength),
			Infinity,
			this.TypedArrayCtor,
		);

		this.copyFromSubarray(
			result.view,
			this.view.subarray(
				this._head,
				this._head + this._length,
			) as TypedArrayInstance<T>,
		);
		this.copyFromSubarray(result.view, other.raw(), this._length);
		result._length = totalLength;

		return result;
	}

	// ============= Capacity Control =============

	/**
	 * Clear all elements.
	 * @param shrink If true, also shrink buffer to initial capacity.
	 */
	clear(shrink: boolean = false): void {
		this._length = 0;

		if (shrink) {
			this.resizeBuffer(this._initialCapacity);
		}
	}

	/**
	 * Clear all elements, zeroing the entire buffer.
	 * Performance: O(capacity) - can be expensive for large buffers.
	 * Note: Use clear(true) for both zeroing and shrinking.
	 */
	safeClear(): void {
		this._length = 0;
		this._head = 0;
		this.v.fill(this.zeroElement, 0, this._capacity);
	}

	/**
	 * Ensure capacity is at least the given minimum.
	 */
	reserve(minimumCapacity: number): void {
		if (minimumCapacity > this.capacity) {
			this.resizeBuffer(minimumCapacity);
		}
	}

	/**
	 * Shrink the buffer to fit exactly the current length.
	 */
	shrinkToFit(): void {
		if (this._length < this.capacity) {
			this.resizeBuffer(Math.max(this._length, 1));
		}
	}

	/**
	 * Truncate to the given length (must be <= current length).
	 */
	truncate(newLength: number): void {
		if (newLength < 0 || newLength > this._length) {
			throw new RangeError(`Invalid truncate length: ${newLength}`);
		}
		this._length = newLength;
		if (this.shouldShrink()) {
			this.shrinkCapacity();
		}
	}

	/**
	 * Truncate to the given length, zeroing the truncated range.
	 * Performance: O(n) where n = elements truncated.
	 * @param newLength The new length (must be <= current length).
	 */
	safeTruncate(newLength: number): void {
		if (newLength < 0 || newLength > this._length) {
			throw new RangeError(`Invalid truncate length: ${newLength}`);
		}
		const oldLength = this._length;
		this._length = newLength;
		this.zeroRange(this._head + newLength, this._head + oldLength);
		if (this.shouldShrink()) {
			this.shrinkCapacity();
		}
	}

	// ============= Fill & Search =============

	/**
	 * Fill a range with a value.
	 */
	fill(value: ElementType<T>, start = 0, end = this._length): this {
		const normalizedStart = this.normalizeIndex(start);
		const normalizedEnd = this.normalizeIndex(end);
		this.v.fill(value, this._head + normalizedStart, this._head + normalizedEnd);
		return this;
	}

	/**
	 * Find the first index of an element.
	 */
	indexOf(searchElement: ElementType<T>, fromIndex: number = 0): number {
		const startIndex = this.normalizeIndex(fromIndex);
		for (let i = startIndex; i < this._length; i++) {
			if (this.v[this._head + i] === searchElement) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * Find the last index of an element.
	 */
	lastIndexOf(
		searchElement: ElementType<T>,
		fromIndex: number = this._length - 1,
	): number {
		const startIndex = Math.min(fromIndex, this._length - 1);
		for (let i = startIndex; i >= 0; i--) {
			if (this.v[this._head + i] === searchElement) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * Find the first element that satisfies the predicate.
	 */
	find(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): ElementType<T> | undefined {
		for (let i = 0; i < this._length; i++) {
			const value = this.v[this._head + i];
			if (value !== undefined && predicate(value, i, this)) {
				return value;
			}
		}
		return;
	}

	/**
	 * Find the index of the first element that satisfies the predicate.
	 */
	findIndex(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): number {
		for (let i = 0; i < this._length; i++) {
			const value = this.v[this._head + i];
			if (value !== undefined && predicate(value, i, this)) {
				return i;
			}
		}
		return -1;
	}

	/**
	 * Check if an element is present.
	 */
	includes(searchElement: ElementType<T>): boolean {
		return this.indexOf(searchElement) !== -1;
	}

	// ============= Iteration & Transformation =============

	/**
	 * Execute a callback for each element.
	 */
	forEach(
		callback: (value: ElementType<T>, index: number, array: this) => void,
	): void {
		const v = this.v;
		const initialLen = this._length;
		const version = this._version;

		for (let i = 0; i < initialLen && i < this._length; i++) {
			if (this._version !== version) break;
			const value = v[this._head + i] as ElementType<T>;
			callback(value, i, this);
		}
	}

	/**
	 * Iterates over a snapshot of the array taken at call time.
	 * Allocates O(n) — safe against all mutations (push/pop/shift/splice) during iteration.
	 * Prefer forEach() for non-concurrent-modification use cases.
	 */
	forEachStable(
		callback: (value: ElementType<T>, index: number, array: this) => void,
	): void {
		const snapshot = this.toArray();
		for (let i = 0; i < snapshot.length; i++) {
			callback(snapshot[i] as ElementType<T>, i, this);
		}
	}

	/** @deprecated use forEachStable instead */
	forEachSnapshot(
		callback: (value: ElementType<T>, index: number, array: this) => void,
	): void {
		this.forEachStable(callback);
	}

	/**
	 * Map each element to a new value with a different typed array constructor.
	 */
	map<U extends TypedArrayConstructor = T>(
		callback: (
			value: ElementType<T>,
			index: number,
			array: this,
		) => ElementType<U>,
		TypedArrayCtor?: U,
	): DynamicArray<U> {
		const ctor = (TypedArrayCtor ?? this.TypedArrayCtor) as U;
		const result = new DynamicArray<U>(this._length, Infinity, ctor);
		result._length = this._length;

		const rv = result.v;
		for (let i = 0; i < this._length; i++) {
			const value = this.v[this._head + i];
			if (value !== undefined) {
				rv[i] = callback(value, i, this);
			}
		}
		return result;
	}

	/**
	 * Create a new array with elements that pass the predicate.
	 */
	filter(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): DynamicArray<T> {
		const result = new DynamicArray<T>(
			this._length || 1,
			Infinity,
			this.TypedArrayCtor,
		);
		let targetIndex = 0;

		const rv = result.v;
		for (let i = 0; i < this._length; i++) {
			const value = this.v[this._head + i];
			if (value !== undefined && predicate(value, i, this)) {
				rv[targetIndex++] = value;
			}
		}

		result._length = targetIndex;
		if (result.shouldShrink()) {
			result.shrinkCapacity();
		}

		return result;
	}

	/**
	 * Reduce the array to a single value.
	 */
	reduce<U>(
		callback: (
			accumulator: U,
			value: ElementType<T>,
			index: number,
			array: this,
		) => U,
		initialValue: U,
	): U {
		let accumulator = initialValue;
		for (let i = 0; i < this._length; i++) {
			const value = this.v[this._head + i];
			if (value !== undefined) {
				accumulator = callback(accumulator, value, i, this);
			}
		}
		return accumulator;
	}

	/**
	 * Test if any element satisfies the predicate.
	 */
	some(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): boolean {
		for (let i = 0; i < this._length; i++) {
			const value = this.v[this._head + i];
			if (value !== undefined && predicate(value, i, this)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Test if all elements satisfy the predicate.
	 */
	every(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): boolean {
		for (let i = 0; i < this._length; i++) {
			const value = this.v[this._head + i];
			if (value !== undefined && !predicate(value, i, this)) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Reverse elements in-place.
	 */
	reverse(): this {
		for (
			let left = 0, right = this._length - 1;
			left < right;
			left++, right--
		) {
			const tmp = this.v[this._head + left];
			const valRight = this.v[this._head + right];
			if (tmp !== undefined && valRight !== undefined) {
				this.v[this._head + left] = valRight;
				this.v[this._head + right] = tmp;
			}
		}
		return this;
	}

	/**
	 * Fast in-place sort using the native TypedArray sort (SIMD-eligible).
	 */
	sort(): this {
		this.view.subarray(this._head, this._head + this._length).sort();
		return this;
	}

	/**
	 * Sort with a custom comparator. Allocates O(n) — prefer sort() for numeric data.
	 * @param compareFn Standard Array.prototype.sort comparator.
	 */
	sortWith(compareFn: (a: ElementType<T>, b: ElementType<T>) => number): this {
		const arr = this.toArray();
		arr.sort(compareFn);
		for (let i = 0; i < arr.length; i++) {
			this.v[this._head + i] = arr[i] as ElementType<T>;
		}
		return this;
	}

	// ============= Conversion =============

	/**
	 * Create a new regular JavaScript array with copies of the elements.
	 * Modifications to the returned array won't affect this DynamicArray.
	 */
	toArray(): ElementType<T>[] {
		const result: ElementType<T>[] = [];
		for (let i = 0; i < this._length; i++) {
			const value = this.v[this._head + i];
			if (value !== undefined) {
				result.push(value);
			}
		}
		return result;
	}

	/**
	 * Get a typed array view of the current elements (zero-copy).
	 *
	 * ⚠️ WARNING: This is a view into the underlying buffer:
	 * - Modifications will affect this DynamicArray
	 * - The view may become invalid after operations that resize the buffer
	 */
	raw(): TypedArrayInstance<T> {
		return this.view.subarray(
			this._head,
			this._head + this._length,
		) as TypedArrayInstance<T>;
	}

	/**
	 * Get the full underlying TypedArray view for testing purposes.
	 * Includes the entire buffer capacity, not just the logical length.
	 */
	getRawBuffer(): TypedArrayInstance<T> {
		return this.view;
	}

	*[Symbol.iterator](): Iterator<ElementType<T>> {
		const v = this.v;
		const version = this._version;

		for (let i = 0; i < this._length; i++) {
			if (this._version !== version) break;
			const value = v[this._head + i] as ElementType<T>;
			yield value;
		}
	}

	get isEmpty(): boolean {
		return this._length === 0;
	}

	/**
	 * Peek at the first element without removing it.
	 */
	peekFront(): ElementType<T> | undefined {
		if (this._length === 0) return;
		return this.getElement(0);
	}

	/**
	 * Peek at the last element without removing it.
	 */
	peekBack(): ElementType<T> | undefined {
		if (this._length === 0) return;
		return this.getElement(this._length - 1);
	}

	toString(): string {
		return `DynamicArray(${this._length}/${this.capacity}) [${this.toArray().join(", ")}]`;
	}

	/**
	 * Returns a secure view where pop/shift/splice/truncate/clear zero freed memory.
	 * This is implemented via a Proxy that intercepts mutation methods.
	 */
	secured(): DynamicArraySecureView<T> {
		return new Proxy(this, {
			get(target, prop, receiver) {
				if (typeof prop === "string") {
					const override = SAFE_OVERRIDES[prop];
					if (override) {
						return (...args: unknown[]) =>
							// biome-ignore lint/suspicious/noExplicitAny: target as any is needed for dynamic override dispatch
							(target as any)[override](...args);
					}

					const value = Reflect.get(target, prop, receiver);
					if (typeof value === "function") {
						return (...args: unknown[]) => {
							const result = value.apply(target, args);
							if (SECURED_METHODS.has(prop)) {
								return result.secured();
							}
							return result === target ? receiver : result;
						};
					}
					return value;
				}
				return Reflect.get(target, prop, receiver);
			},
		}) as unknown as DynamicArraySecureView<T>;
	}
}

/**
 * A secure view of a DynamicArray that automatically uses zeroing variants of mutation methods.
 */
export type DynamicArraySecureView<T extends TypedArrayConstructor> =
	DynamicArray<T>;

export class SerializedDynamicArray {
	private array: DynamicArray<Uint8ArrayConstructor>;
	private offsets: number[];
	private static readonly encoder = new TextEncoder();
	private static readonly decoder = new TextDecoder();

	constructor() {
		this.array = new DynamicArray<Uint8ArrayConstructor>(
			1,
			Infinity,
			Uint8Array,
		);
		this.offsets = [];
	}

	pushObject(obj: object): void {
		const bytes = JSON.stringify(obj);
		this.offsets.push(this.array.length);
		this.array.push(SerializedDynamicArray.encoder.encode(bytes));
	}

	popObject(): object {
		const offset = this.offsets.pop();
		if (offset === undefined) {
			throw new Error("No objects to pop");
		}
		const bytes = this.array.raw().subarray(offset);
		const obj = JSON.parse(SerializedDynamicArray.decoder.decode(bytes));
		this.array.truncate(offset);
		return obj;
	}

	getObjectAt(index: number): object {
		if (index < 0 || index >= this.offsets.length) {
			throw new RangeError("Index out of bounds");
		}
		const offset = this.offsets[index];
		if (offset === undefined) {
			throw new RangeError("Index out of bounds");
		}
		const nextOffset = this.offsets[index + 1] ?? this.array.length;

		const bytes = this.array.raw().subarray(offset, nextOffset);
		return JSON.parse(SerializedDynamicArray.decoder.decode(bytes));
	}

	length(): number {
		return this.offsets.length;
	}

	clear(): void {
		this.array.clear();
		this.offsets.length = 0;
	}
}
