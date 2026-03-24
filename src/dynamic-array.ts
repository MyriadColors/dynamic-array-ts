import { DEBUG, SAFE_OVERRIDES, SECURED_METHODS } from './constants';
import { LazyChain } from './lazy-chain';
import type { DynamicArraySecureView } from './secure-view';
import type {
  ElementType,
  TypedArrayConstructor,
  TypedArrayInstance,
} from './types';

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

  getTypedArrayCtor(): T {
    return this.TypedArrayCtor;
  }

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

  static isStructuredData(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      '__isDynamicArray' in data &&
      data.__isDynamicArray === true
    );
  }

  static fromStructured<U extends TypedArrayConstructor>(
    data: unknown,
  ): DynamicArray<U> {
    if (!DynamicArray.isStructuredData(data)) {
      throw new TypeError('Invalid structured data for DynamicArray');
    }

    // biome-ignore lint/suspicious/noExplicitAny: data is validated as structured data
    const typedData = data as any;

    const ctorName = typedData.type;
    const globalObj =
      typeof globalThis !== 'undefined'
        ? globalThis
        : typeof window !== 'undefined'
          ? window
          : global;
    // biome-ignore lint/suspicious/noExplicitAny: Global object dynamic access
    const TypedArrayCtor = (globalObj as any)[ctorName] as U;

    if (typeof TypedArrayCtor !== 'function') {
      throw new Error(`Unknown TypedArray constructor: ${ctorName}`);
    }

    const da = new DynamicArray<U>(
      Math.max(typedData.capacity || 1, 1),
      typedData.maxCapacity ?? Infinity,
      TypedArrayCtor,
      { debug: typedData.debug },
    );

    da._buffer = typedData.buffer;
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

  private setElement(index: number, value: ElementType<T>): void {
    this.checkDetached();
    const realIndex = this._head + index;
    if (DEBUG || this._debug) {
      this._assert(
        this.v[realIndex] !== undefined,
        `Index ${index} out of buffer bounds (real index ${realIndex}, capacity ${this._capacity})`,
      );
    } else if (this.v[realIndex] === undefined) {
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
      if (typeof item === 'object' && item !== null && 'length' in item) {
        addedLength += (item as ArrayLike<ElementType<T>>).length;
      } else {
        addedLength++;
      }
    }
    return addedLength;
  }

  private _assert(condition: boolean, message: string): void {
    if ((DEBUG || this._debug) && !condition) {
      throw new Error(`[DynamicArray Assertion Failed] ${message}`);
    }
  }

  private checkDetached(): void {
    if (this._isDetached) {
      throw new TypeError(
        'Cannot perform operation on a detached DynamicArray',
      );
    }
  }

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

  private zeroRange(start: number, end: number): void {
    if (start >= end) return;
    this.v.fill(this.zeroElement, start, end);
  }

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

  private createView(buffer: ArrayBuffer): TypedArrayInstance<T> {
    return new this.TypedArrayCtor(buffer) as TypedArrayInstance<T>;
  }

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
    this.supportsResize = 'resize' in ArrayBuffer.prototype;
    this.supportsTransfer = 'transfer' in ArrayBuffer.prototype;
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
      if (typeof item === 'object' && item !== null && 'length' in item) {
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

  pushAligned(alignment: number, ...values: ElementType<T>[]): this {
    const remainder = this._length % alignment;
    const padding = remainder !== 0 ? alignment - remainder : 0;

    const totalNewLength = this._length + padding + values.length;

    if (this._head + totalNewLength > this.capacity) {
      if (this._head > this.capacity * DynamicArray.AUTO_COMPACT_HEAD_THRESHOLD)
        this.compact();
      if (totalNewLength > this.capacity) {
        this.growCapacity(totalNewLength);
      }
    }

    if (padding > 0) {
      const oldLength = this._length;
      this._length += padding;
      this.zeroRange(this._head + oldLength, this._head + this._length);
    }

    this.push(...values);
    return this;
  }

  pushed(
    ...items: (ElementType<T> | ArrayLike<ElementType<T>>)[]
  ): DynamicArray<T> {
    const copy = this.slice();
    copy.push(...items);
    return copy;
  }

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

  unsafePop(): ElementType<T> {
    this.checkDetached();
    if (DEBUG || this._debug) {
      this._assert(this._length > 0, 'unsafePop() called on empty array');
    }
    const value = this.v[this._head + --this._length] as ElementType<T>;
    if (DEBUG || this._debug) this._checkInvariants();
    return value;
  }

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

  unshifted(...values: ElementType<T>[]): DynamicArray<T> {
    const copy = this.slice();
    copy.unshift(...values);
    return copy;
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

  shift(): ElementType<T> | undefined {
    if (this._length === 0) return;
    const value = this.v[this._head];
    this._head++;
    this._length--;

    if (this._length === 0) this._head = 0;
    if (this._head > this.capacity * DynamicArray.MANUAL_COMPACT_HEAD_THRESHOLD)
      this.compact();

    if (DEBUG || this._debug) this._checkInvariants();
    return value;
  }

  safeShift(): ElementType<T> | undefined {
    if (this._length === 0) return;

    const oldHead = this._head;
    const value = this.v[oldHead];
    this._head++;
    this._length--;

    this.zeroRange(this._head - 1, this._head);

    if (this._length === 0) this._head = 0;
    if (this._head > this.capacity * DynamicArray.MANUAL_COMPACT_HEAD_THRESHOLD)
      this.compact();

    if (DEBUG || this._debug) this._checkInvariants();
    return value;
  }

  shifted(): DynamicArray<T> {
    const copy = this.slice();
    copy.shift();
    return copy;
  }

  compact(): void {
    if (this._head === 0) return;

    this._version++;
    const oldEnd = this._head + this._length;

    this.v.copyWithin(0, this._head, oldEnd);

    this.zeroRange(this._length, oldEnd);

    this._head = 0;

    if (DEBUG || this._debug) this._checkInvariants();
  }

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
      typeof args[0] === 'object' &&
      args[0] !== null &&
      !('length' in args[0])
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
      typeof args[0] === 'object' &&
      args[0] !== null &&
      !('length' in args[0])
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

  spliced(
    start: number,
    deleteCount: number = this._length - start,
    ...args: (ElementType<T> | { returnDeleted?: boolean })[]
  ): DynamicArray<T> {
    const copy = this.slice();
    copy.splice(start, deleteCount, ...args);
    return copy;
  }

  get(index: number): ElementType<T> {
    this.validateIndex(index);
    return this.getElement(index);
  }

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

  public unsafeSet(index: number, value: ElementType<T>): void {
    this.checkDetached();
    if (DEBUG || this._debug) {
      this._assert(
        index >= 0 && index < this._length,
        `unsafeSet(${index}) out of bounds [0, ${this._length})`,
      );
    }
    this.v[this._head + index] = value;
    if (DEBUG || this._debug) this._checkInvariants();
  }

  at(index: number): ElementType<T> | undefined {
    const normalizedIndex = index < 0 ? this._length + index : index;
    if (normalizedIndex < 0 || normalizedIndex >= this._length) {
      return;
    }
    return this.getElement(normalizedIndex);
  }

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

  clear(shrink: boolean = false): void {
    this._length = 0;

    if (shrink) {
      this.resizeBuffer(this._initialCapacity);
    }

    if (DEBUG || this._debug) this._checkInvariants();
  }

  safeClear(): void {
    this._length = 0;
    this._head = 0;
    this.v.fill(this.zeroElement, 0, this._capacity);

    if (DEBUG || this._debug) this._checkInvariants();
  }

  cleared(shrink: boolean = false): DynamicArray<T> {
    const copy = this.slice();
    copy.clear(shrink);
    return copy;
  }

  reserve(minimumCapacity: number): void {
    if (minimumCapacity > this.capacity) {
      this.resizeBuffer(minimumCapacity);
    }

    if (DEBUG || this._debug) this._checkInvariants();
  }

  shrinkToFit(): void {
    if (this._length < this.capacity) {
      this.resizeBuffer(Math.max(this._length, 1));
    }
  }

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

  truncated(newLength: number): DynamicArray<T> {
    const copy = this.slice();
    copy.truncate(newLength);
    return copy;
  }

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

  filled(
    value: ElementType<T>,
    start = 0,
    end = this._length,
  ): DynamicArray<T> {
    const copy = this.slice();
    copy.fill(value, start, end);
    return copy;
  }

  indexOf(searchElement: ElementType<T>, fromIndex: number = 0): number {
    const startIndex = this.normalizeIndex(fromIndex);
    for (let i = startIndex; i < this._length; i++) {
      if (this.v[this._head + i] === searchElement) {
        return i;
      }
    }
    return -1;
  }

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

  includes(searchElement: ElementType<T>): boolean {
    return this.indexOf(searchElement) !== -1;
  }

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

  forEachStable(
    callback: (value: ElementType<T>, index: number, array: this) => void,
  ): void {
    const snapshot = this.toArray();
    for (let i = 0; i < snapshot.length; i++) {
      callback(snapshot[i] as ElementType<T>, i, this);
    }
  }

  forEachSnapshot(
    callback: (value: ElementType<T>, index: number, array: this) => void,
  ): void {
    this.forEachStable(callback);
  }

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

  reversed(): DynamicArray<T> {
    const copy = this.slice();
    copy.reverse();
    return copy;
  }

  sort(): this {
    this.view.subarray(this._head, this._head + this._length).sort();
    return this;
  }

  sorted(): DynamicArray<T> {
    const copy = this.slice();
    copy.sort();
    return copy;
  }

  sortWith(compareFn: (a: ElementType<T>, b: ElementType<T>) => number): this {
    const arr = this.toArray();
    arr.sort(compareFn);
    for (let i = 0; i < arr.length; i++) {
      this.v[this._head + i] = arr[i] as ElementType<T>;
    }
    return this;
  }

  sortedWith(
    compareFn: (a: ElementType<T>, b: ElementType<T>) => number,
  ): DynamicArray<T> {
    const copy = this.slice();
    copy.sortWith(compareFn);
    return copy;
  }

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

  raw(): TypedArrayInstance<T> {
    return this.view.subarray(
      this._head,
      this._head + this._length,
    ) as TypedArrayInstance<T>;
  }

  withRaw<R>(fn: (view: TypedArrayInstance<T>) => R): R {
    return fn(this.raw());
  }

  getRawBuffer(): TypedArrayInstance<T> {
    return this.view;
  }

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

  peekFront(): ElementType<T> | undefined {
    this.checkDetached();
    if (this._length === 0) return;
    return this.getElement(0);
  }

  peekBack(): ElementType<T> | undefined {
    this.checkDetached();
    if (this._length === 0) return;
    return this.getElement(this._length - 1);
  }

  transfer(): ArrayBuffer {
    this.checkDetached();
    this._isDetached = true;
    const buffer = this._buffer;

    this._length = 0;
    this._capacity = 0;

    if (this.supportsTransfer) {
      const detached = this._buffer.transfer();
      this._buffer = new ArrayBuffer(0);
      this.view = this.createView(this._buffer);
      return detached;
    }

    this._buffer = new ArrayBuffer(0);
    this.view = this.createView(this._buffer);
    return buffer;
  }

  [Symbol.for('structuredClone')](): object {
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
      return `DynamicArray(${this.TypedArrayCtor.name}) [ ${buffer.join(', ')} ] (head: ${this._head}, len: ${this._length}, cap: ${this._capacity})`;
    }
    return this.toArray().toString();
  }

  secured(): DynamicArraySecureView<T> {
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          const override = SAFE_OVERRIDES[prop];
          if (override) {
            return (...args: unknown[]) =>
              // biome-ignore lint/suspicious/noExplicitAny: target as any is needed for dynamic override dispatch
              (target as any)[override](...args);
          }

          const value = Reflect.get(target, prop, receiver);
          if (typeof value === 'function') {
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

  lazy(): LazyChain<T, ElementType<T>> {
    return LazyChain.from(this);
  }
}
