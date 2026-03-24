import { DynamicArray } from './dynamic-array';
import type { ElementType, TypedArrayConstructor } from './types';

export class DynamicArrayStack<
  T extends TypedArrayConstructor = Uint8ArrayConstructor,
> {
  private _array: DynamicArray<T>;

  constructor(
    initialCapacity?: number,
    maxCapacity?: number,
    TypedArrayCtor?: T,
    options?: { debug?: boolean },
  ) {
    this._array = new DynamicArray<T>(
      initialCapacity,
      maxCapacity,
      TypedArrayCtor,
      options,
    );
  }

  get length(): number {
    return this._array.length;
  }

  get isEmpty(): boolean {
    return this._array.isEmpty;
  }

  get capacity(): number {
    return this._array.capacity;
  }

  get maxCapacity(): number {
    return this._array.maxCapacity;
  }

  get buffer(): ArrayBuffer {
    return this._array.buffer;
  }

  get byteLength(): number {
    return this._array.byteLength;
  }

  push(...values: ElementType<T>[]): number {
    return this._array.push(values);
  }

  pop(): ElementType<T> | undefined {
    return this._array.pop();
  }

  peek(): ElementType<T> | undefined {
    return this._array.peekBack();
  }

  unsafePop(): ElementType<T> {
    return this._array.unsafePop();
  }

  unsafePeek(): ElementType<T> {
    return this._array.unsafeGet(this._array.length - 1);
  }

  safePop(): ElementType<T> | undefined {
    return this._array.safePop();
  }

  safePeek(): ElementType<T> | undefined {
    if (this._array.isEmpty) {
      return;
    }
    const raw = this._array.raw();
    const lastIndex = raw.length - 1;
    const value = raw[lastIndex] as ElementType<T>;
    const TypedArrayCtor = raw.constructor;
    const zeroValue: ElementType<T> =
      TypedArrayCtor === BigUint64Array || TypedArrayCtor === BigInt64Array
        ? (0n as ElementType<T>)
        : (0 as ElementType<T>);
    raw[lastIndex] = zeroValue;
    return value;
  }

  clear(shrink?: boolean): void {
    this._array.clear(shrink);
  }

  safeClear(): void {
    this._array.safeClear();
  }

  compact(): void {
    this._array.compact();
  }

  [Symbol.iterator](): Iterator<ElementType<T>> {
    return this._array[Symbol.iterator]();
  }

  toArray(): ElementType<T>[] {
    return this._array.toArray();
  }

  getRawBuffer(): ReturnType<DynamicArray<T>['getRawBuffer']> {
    return this._array.getRawBuffer();
  }

  raw(): ReturnType<DynamicArray<T>['raw']> {
    return this._array.raw();
  }
}
