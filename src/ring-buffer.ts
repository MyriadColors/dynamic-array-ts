import { DEBUG } from './constants';
import { DynamicArray } from './dynamic-array';
import type { ElementType, TypedArrayConstructor } from './types';

export class RingBufferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RingBufferError';
  }
}

export class RingBuffer<
  T extends TypedArrayConstructor = Uint8ArrayConstructor,
> {
  private _buffer: DynamicArray<T>;
  private _readPos: number = 0;
  private _writePos: number = 0;
  private _length: number = 0;
  private _debug: boolean;

  constructor(
    capacity: number,
    TypedArrayCtor?: T,
    options?: { debug?: boolean },
  ) {
    if (capacity <= 0) {
      throw new RangeError('Capacity must be greater than 0');
    }
    this._buffer = new DynamicArray(
      capacity,
      capacity,
      TypedArrayCtor,
      options,
    );
    this._debug = options?.debug ?? false;
  }

  private _assert(condition: boolean, message: string): void {
    if ((DEBUG || this._debug) && !condition) {
      throw new Error(`[RingBuffer Assertion Failed] ${message}`);
    }
  }

  private _checkInvariants(): void {
    if (!(DEBUG || this._debug)) return;

    this._assert(this._length >= 0, `_length must be non-negative`);
    this._assert(this._length <= this.capacity, `_length must be <= capacity`);
    this._assert(this._readPos >= 0, `_readPos must be non-negative`);
    this._assert(this._writePos >= 0, `_writePos must be non-negative`);
    this._assert(
      this._readPos < this.capacity,
      `_readPos must be less than capacity`,
    );
    this._assert(
      this._writePos < this.capacity,
      `_writePos must be less than capacity`,
    );
  }

  get length(): number {
    return this._length;
  }

  get capacity(): number {
    return this._buffer.capacity;
  }

  get maxCapacity(): number {
    return this._buffer.maxCapacity;
  }

  get available(): number {
    return this.capacity - this._length;
  }

  get isEmpty(): boolean {
    return this._length === 0;
  }

  get isFull(): boolean {
    return this._length === this.capacity;
  }

  private _advanceRead(): void {
    this._readPos = (this._readPos + 1) % this.capacity;
    this._length--;
  }

  private _advanceWrite(value: ElementType<T>): void {
    (this._buffer.getRawBuffer() as unknown as Record<number, ElementType<T>>)[
      this._writePos
    ] = value;
    this._writePos = (this._writePos + 1) % this.capacity;
    this._length++;
  }

  write(value: ElementType<T>): void {
    if (this.isFull) {
      throw new RingBufferError('Buffer is full');
    }
    this._advanceWrite(value);
    if (DEBUG || this._debug) this._checkInvariants();
  }

  read(): ElementType<T> {
    if (this.isEmpty) {
      throw new RingBufferError('Buffer is empty');
    }
    const value = (
      this._buffer.getRawBuffer() as unknown as Record<number, ElementType<T>>
    )[this._readPos] as ElementType<T>;
    this._advanceRead();
    if (DEBUG || this._debug) this._checkInvariants();
    return value;
  }

  peek(): ElementType<T> {
    if (this.isEmpty) {
      throw new RingBufferError('Buffer is empty');
    }
    return (
      this._buffer.getRawBuffer() as unknown as Record<number, ElementType<T>>
    )[this._readPos] as ElementType<T>;
  }

  clear(): void {
    this._buffer.safeClear();
    this._readPos = 0;
    this._writePos = 0;
    this._length = 0;
    if (DEBUG || this._debug) this._checkInvariants();
  }

  [Symbol.iterator](): Iterator<ElementType<T>> {
    const length = this._length;
    const raw = this._buffer.getRawBuffer() as unknown as Record<
      number,
      ElementType<T>
    >;
    let index = 0;
    return {
      next: () => {
        if (index >= length) {
          return { done: true, value: undefined };
        }
        const pos = (this._readPos + index) % this.capacity;
        const value = raw[pos] as ElementType<T>;
        index++;
        return { done: false, value };
      },
    };
  }

  toArray(): ElementType<T>[] {
    return Array.from(this);
  }
}
