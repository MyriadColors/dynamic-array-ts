type TypedArrayConstructor =
	| Uint8ArrayConstructor
	| Uint8ClampedArrayConstructor
	| Uint16ArrayConstructor
	| Uint32ArrayConstructor
	| Int8ArrayConstructor
	| Int16ArrayConstructor
	| Int32ArrayConstructor
	| Float32ArrayConstructor
	| Float64ArrayConstructor
	| BigUint64ArrayConstructor
	| BigInt64ArrayConstructor;

type TypedArrayInstance<T extends TypedArrayConstructor> =
	T extends Uint8ArrayConstructor
	? Uint8Array
	: T extends Uint8ClampedArrayConstructor
	? Uint8ClampedArray
	: T extends Uint16ArrayConstructor
	? Uint16Array
	: T extends Uint32ArrayConstructor
	? Uint32Array
	: T extends Int8ArrayConstructor
	? Int8Array
	: T extends Int16ArrayConstructor
	? Int16Array
	: T extends Int32ArrayConstructor
	? Int32Array
	: T extends Float32ArrayConstructor
	? Float32Array
	: T extends Float64ArrayConstructor
	? Float64Array
	: T extends BigUint64ArrayConstructor
	? BigUint64Array
	: T extends BigInt64ArrayConstructor
	? BigInt64Array
	: never;

type ElementType<T extends TypedArrayConstructor> = T extends
	| BigUint64ArrayConstructor
	| BigInt64ArrayConstructor
	? bigint
	: number;

/**
 * A dynamically-sized typed array with automatic buffer management.
 * Uses modern ArrayBuffer.resize() and transfer() when available.
 */
export class DynamicArray<
	T extends TypedArrayConstructor = Uint8ArrayConstructor,
> {
	public buffer: ArrayBuffer;
	private view: TypedArrayInstance<T>;
	private _length: number;
	private _capacity: number;
	private _initialCapacity: number;
	private TypedArrayCtor: T;
	private bytesPerElement: number;
	private supportsResize: boolean = false;
	private supportsTransfer: boolean = false;

	private static readonly DEFAULT_INITIAL_CAPACITY = 10;
	private static readonly GROWTH_FACTOR = 2;
	private static readonly SHRINK_THRESHOLD = 0.25;
	private static readonly MIN_SHRINK_CAPACITY = 10;

	constructor(
		initialCapacity: number = DynamicArray.DEFAULT_INITIAL_CAPACITY,
		maxCapacity: number = Infinity,
		TypedArrayCtor: T = Uint8Array as T,
	) {
		this.TypedArrayCtor = TypedArrayCtor;
		this.bytesPerElement = TypedArrayCtor.BYTES_PER_ELEMENT;
		this._initialCapacity = Math.max(1, initialCapacity);
		this._length = 0;
		this._capacity = this._initialCapacity;

		this.validateCapacityBounds(this._initialCapacity, maxCapacity);
		this.detectFeatureSupport();

		const initialByteLength = this._initialCapacity * this.bytesPerElement;
		const options = this.createBufferOptions(maxCapacity);

		this.buffer = new ArrayBuffer(initialByteLength, options);
		this.view = new TypedArrayCtor(this.buffer) as TypedArrayInstance<T>;
	}

	// ============= Internal Helpers =============
	// These centralize type casts to minimize scattered "as unknown as" throughout the code

	/** Get element at index (internal, assumes bounds valid) */
	private getElement(index: number, safe: boolean = false): ElementType<T> {
		const value = this.view[index];
		if (safe) {
			if (value === undefined) {
				throw new RangeError(`Index ${index} out of bounds`);
			}
		}
		return value as ElementType<T>;
	}

	/** Set element at index (internal, assumes bounds valid) */
	private setElement(index: number, value: ElementType<T>): void {
		if (value === undefined) {
			throw new RangeError(`Index ${index} out of bounds`);
		}
		(this.view as unknown as Record<number, ElementType<T>>)[index] = value;
	}

	/** Copy data between views using set() */
	private copyFromSubarray(
		target: TypedArrayInstance<T>,
		source: TypedArrayInstance<T>,
		offset = 0,
	): void {
		(target as unknown as { set(arr: unknown, offset?: number): void }).set(
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
		return undefined;
	}

	get length(): number {
		return this._length;
	}

	get capacity(): number {
		return this._capacity;
	}

	get byteLength(): number {
		return this.buffer.byteLength;
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
		const newByteLength = newCapacity * this.bytesPerElement;

		const maxByteLength = this.buffer.maxByteLength;
		if (
			this.buffer.resizable &&
			maxByteLength !== undefined &&
			newByteLength <= maxByteLength
		) {
			this.buffer.resize(newByteLength);
			this.view = this.createView(this.buffer);
		} else if (this.supportsTransfer) {
			this.buffer = this.buffer.transfer(newByteLength);
			this.view = this.createView(this.buffer);
		} else {
			const newBuffer = new ArrayBuffer(newByteLength);
			const newView = this.createView(newBuffer);
			const copyLength = Math.min(this._length, newCapacity);
			this.copyFromSubarray(
				newView,
				this.view.subarray(0, copyLength) as TypedArrayInstance<T>,
			);
			this.buffer = newBuffer;
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
		if (newLength > this.capacity) {
			this.growCapacity(newLength);
		}

		const v = this.view as unknown as {
			set(array: ArrayLike<unknown>, offset: number): void;
			[key: number]: unknown;
		};

		let offset = this._length;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (typeof item === "object" && item !== null && "length" in item) {
				v.set(item as ArrayLike<ElementType<T>>, offset);
				offset += (item as ArrayLike<ElementType<T>>).length;
			} else {
				v[offset++] = item;
			}
		}

		this._length = newLength;
		return this._length;
	}

	/**
	 * Remove and return the last element.
	 */
	pop(): ElementType<T> | undefined {
		if (this._length === 0) {
			return undefined;
		}

		const value = this.getElement(--this._length);

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

		const newLength = this._length + count;
		if (newLength > this.capacity) {
			this.growCapacity(newLength);
		}

		// Shift existing elements to the right using native copyWithin
		if (this._length > 0) {
			(
				this.view as unknown as {
					copyWithin(t: number, s: number, e?: number): void;
				}
			).copyWithin(count, 0, this._length);
		}

		// Insert new elements
		if (count === 1) {
			const first = values[0];
			if (first !== undefined) {
				this.setElement(0, first);
			}
		} else {
			(
				this.view as unknown as {
					set(v: ElementType<T>[], o?: number): void;
				}
			).set(values, 0);
		}

		this._length = newLength;
		return this._length;
	}

	/**
	 * Remove and return the first element.
	 */
	shift(): ElementType<T> | undefined {
		if (this._length === 0) return undefined;

		const value = this.getElement(0);

		// One native call instead of loop
		(
			this.view as unknown as {
				copyWithin(t: number, s: number, e?: number): void;
			}
		).copyWithin(0, 1, this._length);

		this._length--;
		if (this.shouldShrink()) this.shrinkCapacity();

		return value;
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
				normalizedStart,
				normalizedStart + actualDeleteCount,
			) as unknown as Iterable<ElementType<T>>,
		);

		const netChange = items.length - actualDeleteCount;
		const newLength = this._length + netChange;

		if (newLength > this.capacity) {
			this.growCapacity(newLength);
		}

		if (netChange !== 0 && normalizedStart + actualDeleteCount < this._length) {
			// Shift elements to the left or right to make room or fill gaps
			(
				this.view as unknown as {
					copyWithin(t: number, s: number, e?: number): void;
				}
			).copyWithin(
				normalizedStart + items.length,
				normalizedStart + actualDeleteCount,
				this._length,
			);
		}

		// Insert new items
		if (items.length > 0) {
			(
				this.view as unknown as {
					set(v: ElementType<T>[], o?: number): void;
				}
			).set(items, normalizedStart);
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
	 * @warn Use with caution, no bounds checking is performed.
	 */
	public unsafeGet(index: number): ElementType<T> {
		return this.getElement(index, true);
	}

	/**
	 * Get element at index, supporting negative indices (like Array.prototype.at).
	 * Returns undefined for out-of-bounds access.
	 */
	at(index: number): ElementType<T> | undefined {
		const normalizedIndex = index < 0 ? this._length + index : index;
		if (normalizedIndex < 0 || normalizedIndex >= this._length) {
			return undefined;
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
				normalizedStart,
				normalizedEnd,
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
			this.view.subarray(0, this._length) as TypedArrayInstance<T>,
		);
		this.copyFromSubarray(
			result.view,
			other.view.subarray(0, other._length) as TypedArrayInstance<T>,
			this._length,
		);
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

	// ============= Fill & Search =============

	/**
	 * Fill a range with a value.
	 */
	fill(value: ElementType<T>, start = 0, end = this._length): this {
		const normalizedStart = this.normalizeIndex(start);
		const normalizedEnd = this.normalizeIndex(end);
		(
			this.view as unknown as {
				fill(v: ElementType<T>, s?: number, e?: number): void;
			}
		).fill(value, normalizedStart, normalizedEnd);
		return this;
	}

	/**
	 * Find the first index of an element.
	 */
	indexOf(searchElement: ElementType<T>, fromIndex: number = 0): number {
		const startIndex = this.normalizeIndex(fromIndex);
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = startIndex; i < this._length; i++) {
			if (v[i] === searchElement) {
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
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = startIndex; i >= 0; i--) {
			if (v[i] === searchElement) {
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
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
			if (value !== undefined && predicate(value, i, this)) {
				return value;
			}
		}
		return undefined;
	}

	/**
	 * Find the index of the first element that satisfies the predicate.
	 */
	findIndex(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): number {
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
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
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
			if (value !== undefined) {
				callback(value, i, this);
			}
		}
	}

	/**
	 * Execute a callback for each element, using a snapshot of the array.
	 */
	forEachSnapshot(
		callback: (value: ElementType<T>, index: number, array: this) => void,
	): void {
		const v = this.view as unknown as Record<number, ElementType<T>>;
		const len = this._length; // Snapshot length
		for (let i = 0; i < len; i++) { // Use snapshot
			const value = v[i];
			if (value !== undefined) callback(value, i, this);
		}
	}

	/**
	 * Iterate over the array using a for...of loop.
	 */
	forOf(
		callback: (value: ElementType<T>, index: number, array: this) => void,
	): void {
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
			if (value !== undefined) callback(value, i, this);
		}
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

		const v = this.view as unknown as Record<number, ElementType<T>>;
		const rv = result.view as unknown as Record<number, ElementType<U>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
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

		const v = this.view as unknown as Record<number, ElementType<T>>;
		const rv = result.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
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
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
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
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
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
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
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
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (
			let left = 0, right = this._length - 1;
			left < right;
			left++, right--
		) {
			const tmp = v[left];
			const valRight = v[right];
			if (tmp !== undefined && valRight !== undefined) {
				v[left] = valRight;
				v[right] = tmp;
			}
		}
		return this;
	}

	/**
	 * Sort elements in-place.
	 */
	sort(compareFn?: (a: ElementType<T>, b: ElementType<T>) => number): this {
		// Convert to array, sort, copy back (generic-safe approach)
		const arr = this.toArray();
		if (compareFn) {
			arr.sort(compareFn);
		} else {
			arr.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
		}
		const v = this.view as unknown as Record<number, ElementType<T>>;
		arr.forEach((item, i) => {
			v[i] = item;
		});
		return this;
	}

	nativeSort(): this {
		this.view.subarray(0, this._length).sort();
		return this;
	}

	// ============= Conversion =============

	/**
	 * Create a new regular JavaScript array with copies of the elements.
	 * Modifications to the returned array won't affect this DynamicArray.
	 */
	toArray(): ElementType<T>[] {
		const result: ElementType<T>[] = [];
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
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
		return this.view.subarray(0, this._length) as TypedArrayInstance<T>;
	}

	*[Symbol.iterator](): Iterator<ElementType<T>> {
		const v = this.view as unknown as Record<number, ElementType<T>>;
		for (let i = 0; i < this._length; i++) {
			const value = v[i];
			if (value !== undefined) {
				yield value;
			}
		}
	}

	toString(): string {
		return `DynamicArray(${this._length}/${this.capacity}) [${this.toArray().join(", ")}]`;
	}
}

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
		this.array.push(...SerializedDynamicArray.encoder.encode(bytes));
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
