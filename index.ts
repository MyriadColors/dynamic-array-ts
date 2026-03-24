import type {
	ElementType,
	TypedArrayConstructor,
	TypedArrayInstance,
} from "./src/types";

/**
 * Build-time debug flag.
 * Can be overridden by build tools (e.g., esbuild --define:DEBUG=true).
 */
export const DEBUG = false;

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
	private _debug: boolean = false;
	private _isDetached: boolean = false;

	private static readonly DEFAULT_INITIAL_CAPACITY = 10;
	private static readonly GROWTH_FACTOR = 2;
	private static readonly SHRINK_THRESHOLD = 0.25;
	private static readonly MIN_SHRINK_CAPACITY = 10;
	private static readonly AUTO_COMPACT_HEAD_THRESHOLD = 0.2;
	private static readonly MANUAL_COMPACT_HEAD_THRESHOLD = 0.5;

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
			debug?: boolean;
		},
	): DynamicArray<U> {
		const arr = Array.isArray(source) ? source : Array.from(source);
		const {
			initialCapacity = arr.length,
			maxCapacity = Infinity,
			debug = false,
		} = options ?? {};
		const da = new DynamicArray<U>(
			Math.max(initialCapacity, 1),
			maxCapacity,
			TypedArrayCtor,
			{ debug },
		);
		da.push(arr as ArrayLike<ElementType<U>>);
		return da;
	}

	/**
	 * Check if an object is structured data from a DynamicArray.
	 */
	static isStructuredData(data: unknown): boolean {
		return (
			typeof data === "object" &&
			data !== null &&
			"__isDynamicArray" in data &&
			data.__isDynamicArray === true
		);
	}

	/**
	 * Reconstruct a DynamicArray from structured clone data.
	 */
	static fromStructured<U extends TypedArrayConstructor>(
		data: unknown,
	): DynamicArray<U> {
		if (!DynamicArray.isStructuredData(data)) {
			throw new TypeError("Invalid structured data for DynamicArray");
		}

		// biome-ignore lint/suspicious/noExplicitAny: data is validated as structured data
		const typedData = data as any;

		// Map constructor name back to constructor
		const ctorName = typedData.type;
		const globalObj =
			typeof globalThis !== "undefined"
				? globalThis
				: typeof window !== "undefined"
					? window
					: global;
		// biome-ignore lint/suspicious/noExplicitAny: Global object dynamic access
		const TypedArrayCtor = (globalObj as any)[ctorName] as U;

		if (typeof TypedArrayCtor !== "function") {
			throw new Error(`Unknown TypedArray constructor: ${ctorName}`);
		}

		const da = new DynamicArray<U>(
			Math.max(typedData.capacity || 1, 1),
			typedData.maxCapacity ?? Infinity,
			TypedArrayCtor,
			{ debug: typedData.debug },
		);

		// Replace the newly created buffer with the transferred/cloned one
		da._buffer = typedData.buffer;
		// Create view of the exact same size
		da.view = new TypedArrayCtor(da._buffer) as TypedArrayInstance<U>;
		da._length = typedData.length;
		da._capacity = typedData.capacity;
		da._head = typedData.head;

		return da;
	}

	constructor(
		initialCapacity: number = DynamicArray.DEFAULT_INITIAL_CAPACITY,
		maxCapacity: number = Infinity,
		TypedArrayCtor: T = Uint8Array as T,
		daOptions: { debug?: boolean } = {},
	) {
		this.TypedArrayCtor = TypedArrayCtor;
		this._debug = daOptions.debug ?? false;
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
		this.checkDetached();
		const value = this.v[this._head + index];
		if (DEBUG || this._debug) {
			this._assert(
				value !== undefined,
				`Index ${index} out of buffer bounds (real index ${this._head + index}, capacity ${this._capacity})`,
			);
		} else if (value === undefined) {
			throw new RangeError(`Index ${index} out of bounds`);
		}
		return value as ElementType<T>;
	}

	/** Set element at index (internal, assumes bounds valid) */
	private setElement(index: number, value: ElementType<T>): void {
		this.checkDetached();
		const realIndex = this._head + index;
		if (DEBUG || this._debug) {
			this._assert(
				this.v[realIndex] !== undefined,
				`Index ${index} out of buffer bounds (real index ${realIndex}, capacity ${this._capacity})`,
			);
		} else if (this.v[realIndex] === undefined) {
			// Check real buffer bounds
			throw new RangeError(`Index ${index} out of bounds`);
		}
		this.v[realIndex] = value;
		if (DEBUG || this._debug) this._checkInvariants();
	}

	private _calculateAddedLength(
		items: (ElementType<T> | ArrayLike<ElementType<T>>)[],
	): number {
		let addedLength = 0;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (typeof item === "object" && item !== null && "length" in item) {
				addedLength += (item as ArrayLike<ElementType<T>>).length;
			} else {
				addedLength++;
			}
		}
		return addedLength;
	}

	/**
	 * Internal assertion helper.
	 * Only active if global DEBUG is true or instance _debug is true.
	 */
	private _assert(condition: boolean, message: string): void {
		if ((DEBUG || this._debug) && !condition) {
			throw new Error(`[DynamicArray Assertion Failed] ${message}`);
		}
	}

	/**
	 * Ensures the array has not been detached (e.g. via transfer).
	 */
	private checkDetached(): void {
		if (this._isDetached) {
			throw new TypeError(
				"Cannot perform operation on a detached DynamicArray",
			);
		}
	}

	/**
	 * Verify internal invariants.
	 * Only active if global DEBUG is true or instance _debug is true.
	 */
	private _checkInvariants(): void {
		if (!(DEBUG || this._debug)) return;

		this._assert(
			this._head >= 0,
			`_head must be non-negative, got ${this._head}`,
		);
		this._assert(
			this._length >= 0,
			`_length must be non-negative, got ${this._length}`,
		);
		this._assert(
			this._head + this._length <= this._capacity,
			`_head + _length (${this._head + this._length}) exceeds _capacity (${this._capacity})`,
		);
		this._assert(
			this._capacity <= this._maxCapacity,
			`_capacity (${this._capacity}) exceeds _maxCapacity (${this._maxCapacity})`,
		);
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
		this.checkDetached();
		return this._length;
	}

	get capacity(): number {
		this.checkDetached();
		return this._capacity;
	}

	get maxCapacity(): number {
		return this._maxCapacity;
	}

	/**
	 * Get the underlying ArrayBuffer.
	 */
	get buffer(): ArrayBuffer {
		this.checkDetached();
		return this._buffer;
	}

	get byteLength(): number {
		this.checkDetached();
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
		const isResizable = this._buffer.resizable && maxByteLength !== undefined;
		const isShrink = newCapacity < this._capacity;

		if (isResizable && isShrink && newByteLength <= maxByteLength) {
			this._buffer.resize(newByteLength);
			this.view = this.createView(this._buffer);
		} else if (this.supportsTransfer) {
			this._buffer = this._buffer.transfer(newByteLength);
			this.view = this.createView(this._buffer);
		} else {
			const options = this.createBufferOptions(this._maxCapacity);
			const newBuffer = options
				? new ArrayBuffer(newByteLength, options)
				: new ArrayBuffer(newByteLength);
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
		const addedLength = this._calculateAddedLength(items);
		const newLength = this._length + addedLength;

		if (this._head + newLength > this.capacity) {
			if (this._head > this.capacity * DynamicArray.AUTO_COMPACT_HEAD_THRESHOLD)
				this.compact();
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
		if (DEBUG || this._debug) this._checkInvariants();
		return this._length;
	}

	/**
	 * Push elements to the array, with automatic padding to align to a given boundary.
	 */
	pushAligned(alignment: number, ...values: ElementType<T>[]): this {
		const remainder = this._length % alignment;
		const padding = remainder !== 0 ? alignment - remainder : 0;

		// Calculate total needed capacity first
		const totalNewLength = this._length + padding + values.length;

		// Ensure capacity before any modifications
		if (this._head + totalNewLength > this.capacity) {
			if (this._head > this.capacity * DynamicArray.AUTO_COMPACT_HEAD_THRESHOLD)
				this.compact();
			if (totalNewLength > this.capacity) {
				this.growCapacity(totalNewLength);
			}
		}

		// Now safe to modify - add padding
		if (padding > 0) {
			const oldLength = this._length;
			this._length += padding;
			// Defensive zeroing in case the buffer was manually modified past _length via getRawBuffer()
			this.zeroRange(this._head + oldLength, this._head + this._length);
		}

		// Now push the actual values normally
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

		if (DEBUG || this._debug) this._checkInvariants();
		return value;
	}

	/**
	 * Removes the last element without bounds checking or shrinking.
	 * ⚠️ undefined behavior if array is empty.
	 * ⚠️ Does not release memory (capacity stays same).
	 */
	unsafePop(): ElementType<T> {
		this.checkDetached();
		if (DEBUG || this._debug) {
			this._assert(this._length > 0, "unsafePop() called on empty array");
		}
		// Direct index access, no checks
		const value = this.v[this._head + --this._length] as ElementType<T>;
		if (DEBUG || this._debug) this._checkInvariants();
		return value;
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

		if (DEBUG || this._debug) this._checkInvariants();
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
			return this.unshiftFastPath(values, count);
		}

		return this.unshiftSlowPath(values, count);
	}

	private unshiftFastPath(values: ElementType<T>[], count: number): number {
		this._head -= count;
		this._length += count;
		if (count === 1) {
			const first = values[0];
			if (first !== undefined) this.setElement(0, first);
		} else {
			this.v.set(values, this._head);
		}
		if (DEBUG || this._debug) this._checkInvariants();
		return this._length;
	}

	private unshiftSlowPath(values: ElementType<T>[], count: number): number {
		if (this._head > 0) this.compact();

		const newLength = this._length + count;
		if (newLength > this.capacity) this.growCapacity(newLength);
		if (this._length > 0) this.v.copyWithin(count, 0, this._length);

		if (count === 1) {
			const first = values[0];
			if (first !== undefined) this.setElement(0, first);
		} else {
			this.v.set(values, 0);
		}

		this._length = newLength;
		if (DEBUG || this._debug) this._checkInvariants();
		return this._length;
	}

	private normalizeSpliceArgs(
		start: number,
		deleteCount: number,
	): { normalizedStart: number; actualDeleteCount: number } {
		const normalizedStart = this.normalizeIndex(start);
		const actualDeleteCount = Math.min(
			Math.max(0, deleteCount),
			this._length - normalizedStart,
		);
		return { normalizedStart, actualDeleteCount };
	}

	private prepareSpliceSpace(newLength: number): void {
		if (this._head + newLength > this.capacity) {
			this.growCapacity(newLength);
		}
	}

	private shiftForSplice(
		normalizedStart: number,
		actualDeleteCount: number,
		itemsLength: number,
	): void {
		const netChange = itemsLength - actualDeleteCount;
		if (netChange !== 0 && normalizedStart + actualDeleteCount < this._length) {
			this.v.copyWithin(
				this._head + normalizedStart + itemsLength,
				this._head + normalizedStart + actualDeleteCount,
				this._head + this._length,
			);
		}
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
		if (this._head > this.capacity * DynamicArray.MANUAL_COMPACT_HEAD_THRESHOLD)
			this.compact();

		if (DEBUG || this._debug) this._checkInvariants();
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
		if (this._head > this.capacity * DynamicArray.MANUAL_COMPACT_HEAD_THRESHOLD)
			this.compact();

		if (DEBUG || this._debug) this._checkInvariants();
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

		if (DEBUG || this._debug) this._checkInvariants();
	}

	/**
	 * Insert/remove elements at any position.
	 * @param start The index at which to start changing the array.
	 * @param deleteCount The number of elements to remove.
	 * @param options Optional options: returnDeleted (default true) - whether to return deleted elements.
	 * @param items Elements to insert at the start position.
	 * @returns An array containing the deleted elements (unless options.returnDeleted is false).
	 */
	splice(
		start: number,
		deleteCount: number = this._length - start,
		...args: (ElementType<T> | { returnDeleted?: boolean })[]
	): ElementType<T>[] {
		const { normalizedStart, actualDeleteCount } = this.normalizeSpliceArgs(
			start,
			deleteCount,
		);

		let options: { returnDeleted?: boolean } | undefined;
		let items: ElementType<T>[];

		if (
			args.length > 0 &&
			typeof args[0] === "object" &&
			args[0] !== null &&
			!("length" in args[0])
		) {
			options = args[0] as { returnDeleted?: boolean };
			items = args.slice(1) as ElementType<T>[];
		} else {
			items = args as ElementType<T>[];
		}

		const returnDeleted = options?.returnDeleted ?? true;
		const deleted = returnDeleted
			? Array.from(
					this.view.subarray(
						this._head + normalizedStart,
						this._head + normalizedStart + actualDeleteCount,
					) as unknown as Iterable<ElementType<T>>,
				)
			: [];

		const netChange = items.length - actualDeleteCount;
		const newLength = this._length + netChange;

		this.prepareSpliceSpace(newLength);
		this.shiftForSplice(normalizedStart, actualDeleteCount, items.length);

		if (items.length > 0) {
			this.v.set(items, this._head + normalizedStart);
		}

		this._length = newLength;

		if (this.shouldShrink()) {
			this.shrinkCapacity();
		}

		if (DEBUG || this._debug) this._checkInvariants();
		return deleted;
	}

	/**
	 * Insert/remove elements at any position, zeroing freed positions.
	 * Performance: ~2x slower than splice() depending on data moved.
	 * @param start The index at which to start changing the array.
	 * @param deleteCount The number of elements to remove.
	 * @param options Optional options: returnDeleted (default true) - whether to return deleted elements.
	 * @param items Elements to insert at the start position.
	 * @returns An array containing the deleted elements (unless options.returnDeleted is false).
	 */
	safeSplice(
		start: number,
		deleteCount: number = this._length - start,
		...args: (ElementType<T> | { returnDeleted?: boolean })[]
	): ElementType<T>[] {
		const { normalizedStart, actualDeleteCount } = this.normalizeSpliceArgs(
			start,
			deleteCount,
		);

		let options: { returnDeleted?: boolean } | undefined;
		let items: ElementType<T>[];

		if (
			args.length > 0 &&
			typeof args[0] === "object" &&
			args[0] !== null &&
			!("length" in args[0])
		) {
			options = args[0] as { returnDeleted?: boolean };
			items = args.slice(1) as ElementType<T>[];
		} else {
			items = args as ElementType<T>[];
		}

		const returnDeleted = options?.returnDeleted ?? true;
		const deleted = returnDeleted
			? Array.from(
					this.view.subarray(
						this._head + normalizedStart,
						this._head + normalizedStart + actualDeleteCount,
					) as unknown as Iterable<ElementType<T>>,
				)
			: [];

		const netChange = items.length - actualDeleteCount;
		const newLength = this._length + netChange;
		const oldLength = this._length;

		this.prepareSpliceSpace(newLength);
		this.shiftForSplice(normalizedStart, actualDeleteCount, items.length);

		if (items.length > 0) {
			this.v.set(items, this._head + normalizedStart);
		}

		if (actualDeleteCount > items.length) {
			this.zeroRange(this._head + newLength, this._head + oldLength);
		}

		this._length = newLength;

		if (this.shouldShrink()) {
			this.shrinkCapacity();
		}

		if (DEBUG || this._debug) this._checkInvariants();
		return deleted;
	}

	// ============= Element Access =============

	/**
	 * Get element at index (throws on out-of-bounds).
	 * @throws {RangeError} When index is out of bounds.
	 * @see at() for a variant that returns undefined on out-of-bounds access.
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
		this.checkDetached();
		if (DEBUG || this._debug) {
			this._assert(
				index >= 0 && index < this._length,
				`unsafeGet(${index}) out of bounds [0, ${this._length})`,
			);
		}
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
		this._version++;
		this.setElement(index, value);
	}

	private validateIndex(index: number): void {
		this.checkDetached();
		if (DEBUG || this._debug) {
			this._assert(
				index >= 0 && index < this._length,
				`Index ${index} out of bounds [0, ${this._length})`,
			);
		} else if (index < 0 || index >= this._length) {
			throw new RangeError(`Index ${index} out of bounds [0, ${this._length})`);
		}
	}

	// ============= Slicing & Copying =============

	/**
	 * Create a new DynamicArray with a copy of elements in the given range.
	 */
	slice(start: number = 0, end: number = this._length): DynamicArray<T> {
		this.checkDetached();
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
		this.checkDetached();
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

		if (DEBUG || this._debug) this._checkInvariants();
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

		if (DEBUG || this._debug) this._checkInvariants();
	}

	/**
	 * Ensure capacity is at least the given minimum.
	 */
	reserve(minimumCapacity: number): void {
		if (minimumCapacity > this.capacity) {
			this.resizeBuffer(minimumCapacity);
		}

		if (DEBUG || this._debug) this._checkInvariants();
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

		if (DEBUG || this._debug) this._checkInvariants();
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

		if (DEBUG || this._debug) this._checkInvariants();
	}

	// ============= Fill & Search =============

	/**
	 * Fill a range with a value.
	 */
	fill(value: ElementType<T>, start = 0, end = this._length): this {
		const normalizedStart = this.normalizeIndex(start);
		const normalizedEnd = this.normalizeIndex(end);
		this.v.fill(
			value,
			this._head + normalizedStart,
			this._head + normalizedEnd,
		);
		if (DEBUG || this._debug) this._checkInvariants();
		return this;
	}

	/**
	 * Find the first index of an element.
	 * @warn This implementation is vulnerable to timing attacks when used with secret data.
	 * The comparison uses short-circuit evaluation, so the time taken reveals how early the match is found.
	 * Do not use with sensitive data without adding constant-time comparison.
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
		this.checkDetached();
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
		this.checkDetached();
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
	 * Use this for native-speed numeric loops — no bounds checking, no method call
	 * overhead per element:
	 *
	 *   const view = arr.raw();
	 *   for (let i = 0; i < view.length; i++) sum += view[i];
	 *
	 * @warn This is a view into the underlying buffer. The view is invalidated by
	 * any operation that resizes the buffer (push past capacity, pop below shrink
	 * threshold, splice, reserve, shrinkToFit). Modifying values through this
	 * view WILL affect this DynamicArray.
	 */
	raw(): TypedArrayInstance<T> {
		return this.view.subarray(
			this._head,
			this._head + this._length,
		) as TypedArrayInstance<T>;
	}

	/**
	 * Execute a callback with a raw TypedArray view for the current elements.
	 *
	 * The view lifetime is scoped to the callback, making the invalidation rule
	 * explicit:
	 *
	 *   const sum = arr.withRaw((view) => {
	 *     let s = 0;
	 *     for (let i = 0; i < view.length; i++) s += view[i];
	 *     return s;
	 *   });
	 *
	 * @warn The `view` argument is only valid within `fn`. Do not store or return
	 * it. Any operation that resizes the buffer (push past capacity, pop below
	 * shrink threshold, splice, reserve, shrinkToFit) invalidates the view.
	 */
	withRaw<R>(fn: (view: TypedArrayInstance<T>) => R): R {
		return fn(this.raw());
	}

	/**
	 * Get the full underlying TypedArray view for testing purposes.
	 * Includes the entire buffer capacity, not just the logical length.
	 */
	getRawBuffer(): TypedArrayInstance<T> {
		return this.view;
	}

	/**
	 * Returns an iterator for the array elements.
	 *
	 * Note: This snapshots `_head` and `_length` at creation time.
	 * Mutations during iteration won't be reflected.
	 * Performance Note: Even with this custom iterator, `forEach` is
	 * slightly faster because the iterator protocol has unavoidable
	 * IteratorResult object allocation overhead. Recommend `forEach` for hot paths.
	 */
	[Symbol.iterator](): Iterator<ElementType<T>> {
		const v = this.v;
		const head = this._head;
		const len = this._length;
		let i = 0;

		return {
			next(): IteratorResult<ElementType<T>> {
				if (i < len) {
					return { value: v[head + i++] as ElementType<T>, done: false };
				}
				// biome-ignore lint/suspicious/noExplicitAny: undefined as element type required for IteratorResult
				return { value: undefined as any, done: true };
			},
		};
	}

	get isEmpty(): boolean {
		this.checkDetached();
		return this._length === 0;
	}

	/**
	 * Peek at the first element without removing it.
	 */
	peekFront(): ElementType<T> | undefined {
		this.checkDetached();
		if (this._length === 0) return;
		return this.getElement(0);
	}

	/**
	 * Peek at the last element without removing it.
	 */
	peekBack(): ElementType<T> | undefined {
		this.checkDetached();
		if (this._length === 0) return;
		return this.getElement(this._length - 1);
	}

	/**
	 * Returns the underlying ArrayBuffer, detaching it from this DynamicArray instance.
	 * After this, the DynamicArray is unusable and operations will throw.
	 */
	transfer(): ArrayBuffer {
		this.checkDetached();
		this._isDetached = true;
		const buffer = this._buffer;

		// Detach view locally
		this._length = 0;
		this._capacity = 0;

		if (this.supportsTransfer) {
			const detached = this._buffer.transfer();
			this._buffer = new ArrayBuffer(0);
			this.view = this.createView(this._buffer);
			return detached;
		}

		// Fallback for environments without ArrayBuffer.prototype.transfer
		this._buffer = new ArrayBuffer(0);
		this.view = this.createView(this._buffer);
		return buffer;
	}

	/**
	 * Support for DOM structured cloning algorithm (e.g. via core-js, worker postMessage, or native).
	 * Returns a plain object representation of the array that can be serialized/cloned.
	 */
	[Symbol.for("structuredClone")](): object {
		this.checkDetached();
		return {
			__isDynamicArray: true,
			buffer: this._buffer,
			length: this._length,
			capacity: this._capacity,
			maxCapacity: this._maxCapacity,
			head: this._head,
			type: this.TypedArrayCtor.name,
			debug: this._debug,
		};
	}

	/**
	 * Returns a string representation of the array.
	 * If debug mode is enabled, renders the full buffer including dead zones.
	 */
	toString(): string {
		if (DEBUG || this._debug) {
			const buffer: string[] = [];
			for (let i = 0; i < this._capacity; i++) {
				const val = this.v[i];
				if (i < this._head) {
					buffer.push(`_${val}_`);
				} else if (i < this._head + this._length) {
					buffer.push(String(val));
				} else {
					buffer.push(`_${val}_`);
				}
			}
			return `DynamicArray(${this.TypedArrayCtor.name}) [ ${buffer.join(", ")} ] (head: ${this._head}, len: ${this._length}, cap: ${this._capacity})`;
		}
		return this.toArray().toString();
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
export interface DynamicArraySecureView<T extends TypedArrayConstructor> {
	readonly length: number;
	readonly capacity: number;
	readonly TypedArrayCtor: T;
	readonly view: TypedArrayInstance<T>;

	get(index: number): ElementType<T>;
	at(index: number): ElementType<T> | undefined;
	unsafeGet(index: number): ElementType<T>;
	push(...items: ElementType<T>[]): number;
	pop(): ElementType<T> | undefined;
	safePop(): ElementType<T> | undefined;
	shift(): ElementType<T> | undefined;
	safeShift(): ElementType<T> | undefined;
	unshift(...items: ElementType<T>[]): number;
	set(index: number, value: ElementType<T>): void;
	splice(
		start: number,
		deleteCount?: number,
		...args: (ElementType<T> | { returnDeleted?: boolean })[]
	): ElementType<T>[];
	safeSplice(
		start: number,
		deleteCount?: number,
		...args: (ElementType<T> | { returnDeleted?: boolean })[]
	): ElementType<T>[];
	truncate(newLength: number): void;
	safeTruncate(newLength: number): void;
	clear(): void;
	safeClear(): void;
	slice(start?: number, end?: number): DynamicArraySecureView<T>;
	concat(
		other: DynamicArray<T> | DynamicArraySecureView<T>,
	): DynamicArraySecureView<T>;
	map<U extends TypedArrayConstructor = T>(
		callback: (
			value: ElementType<T>,
			index: number,
			array: this,
		) => ElementType<U>,
		TypedArrayCtor?: U,
	): DynamicArraySecureView<U>;
	filter(
		predicate: (value: ElementType<T>, index: number, array: this) => boolean,
	): DynamicArraySecureView<T>;
	secured(): DynamicArraySecureView<T>;
	includes(searchElement: ElementType<T>, fromIndex?: number): boolean;
	toArray(): ElementType<T>[];
	pushAligned(alignment: number, ...values: ElementType<T>[]): this;
	fill(value: ElementType<T>, start?: number, end?: number): this;
	reverse(): this;
	sort(): this;
	sortWith(compareFn: (a: ElementType<T>, b: ElementType<T>) => number): this;
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
		this.array.push(SerializedDynamicArray.encoder.encode(bytes));
	}

	popObject(): object {
		const offset = this.offsets.pop();
		if (offset === undefined) {
			throw new RangeError("No objects to pop");
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
		if (offset === undefined || offset >= this.array.length) {
			throw new RangeError("Offset is no longer valid - array was modified");
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
