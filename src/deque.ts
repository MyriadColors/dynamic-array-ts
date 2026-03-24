import { DEBUG } from './constants';
import { DynamicArray } from './dynamic-array';
import type { ElementType, TypedArrayConstructor } from './types';

export class DynamicArrayDeque<
  T extends TypedArrayConstructor = Uint8ArrayConstructor,
> {
  private _front: DynamicArray<T>;
  private _back: DynamicArray<T>;
  private _debug: boolean = false;

  private static readonly DEFAULT_INITIAL_CAPACITY = 10;

  constructor(
    initialCapacity: number = DynamicArrayDeque.DEFAULT_INITIAL_CAPACITY,
    maxCapacity: number = Infinity,
    TypedArrayCtor: T = Uint8Array as T,
    options: { debug?: boolean } = {},
  ) {
    this._front = new DynamicArray<T>(
      initialCapacity,
      maxCapacity,
      TypedArrayCtor,
      options,
    );
    this._back = new DynamicArray<T>(
      initialCapacity,
      maxCapacity,
      TypedArrayCtor,
      options,
    );
    this._debug = options.debug ?? false;
  }

  private _assert(condition: boolean, message: string): void {
    if ((DEBUG || this._debug) && !condition) {
      throw new Error(`[DynamicArrayDeque Assertion Failed] ${message}`);
    }
  }

  private _checkInvariants(): void {
    if (!(DEBUG || this._debug)) return;

    this._assert(this._front.length >= 0, `_front.length must be non-negative`);
    this._assert(this._back.length >= 0, `_back.length must be non-negative`);
  }

  private _rebalanceFrontToBack(): void {
    const frontLen = this._front.length;
    if (frontLen === 0) return;

    const items = this._front.slice(0).reverse().toArray();
    this._front.clear(true);
    this._back.unshift(...items);
  }

  private _rebalanceBackToFront(): void {
    const backLen = this._back.length;
    if (backLen === 0) return;

    const items = this._back.slice(0).reverse().toArray();
    this._back.clear(true);
    this._front.push(...items);
  }

  get length(): number {
    return this._front.length + this._back.length;
  }

  get capacity(): number {
    return this._front.capacity + this._back.capacity;
  }

  get maxCapacity(): number {
    return this._front.maxCapacity;
  }

  get isEmpty(): boolean {
    return this._front.isEmpty && this._back.isEmpty;
  }

  pushBack(...values: ElementType<T>[]): number {
    this._back.push(...values);
    if (DEBUG || this._debug) this._checkInvariants();
    return this.length;
  }

  popBack(): ElementType<T> | undefined {
    if (this.isEmpty) {
      return undefined;
    }

    let value: ElementType<T> | undefined;
    if (this._back.isEmpty) {
      this._rebalanceFrontToBack();
      value = this._back.pop();
    } else {
      value = this._back.pop();
    }

    if (DEBUG || this._debug) this._checkInvariants();
    return value;
  }

  safePopBack(): ElementType<T> | undefined {
    if (this.isEmpty) {
      return undefined;
    }

    let value: ElementType<T> | undefined;
    if (this._back.isEmpty) {
      this._rebalanceFrontToBack();
      value = this._back.safePop();
    } else {
      value = this._back.safePop();
    }

    if (DEBUG || this._debug) this._checkInvariants();
    return value;
  }

  peekBack(): ElementType<T> | undefined {
    if (this.isEmpty) {
      return undefined;
    }

    if (!this._back.isEmpty) {
      return this._back.peekBack();
    }

    return this._front.peekFront();
  }

  pushFront(...values: ElementType<T>[]): number {
    this._front.push(...values);
    if (DEBUG || this._debug) this._checkInvariants();
    return this.length;
  }

  popFront(): ElementType<T> | undefined {
    if (this.isEmpty) {
      return undefined;
    }

    let value: ElementType<T> | undefined;
    if (this._front.isEmpty) {
      this._rebalanceBackToFront();
      value = this._front.pop();
    } else {
      value = this._front.pop();
    }

    if (DEBUG || this._debug) this._checkInvariants();
    return value;
  }

  safePopFront(): ElementType<T> | undefined {
    if (this.isEmpty) {
      return undefined;
    }

    let value: ElementType<T> | undefined;
    if (this._front.isEmpty) {
      this._rebalanceBackToFront();
      value = this._front.safePop();
    } else {
      value = this._front.safePop();
    }

    if (DEBUG || this._debug) this._checkInvariants();
    return value;
  }

  peekFront(): ElementType<T> | undefined {
    if (this.isEmpty) {
      return undefined;
    }

    if (!this._front.isEmpty) {
      return this._front.peekBack();
    }

    return this._back.peekFront();
  }

  clear(): void {
    this._front.clear(true);
    this._back.clear(true);
    if (DEBUG || this._debug) this._checkInvariants();
  }

  safeClear(): void {
    this._front.safeClear();
    this._back.safeClear();
    if (DEBUG || this._debug) this._checkInvariants();
  }

  toArray(): ElementType<T>[] {
    const frontReversed = [...this._front].reverse();
    const backArray = this._back.toArray();
    return frontReversed.concat(backArray);
  }

  [Symbol.iterator](): Iterator<ElementType<T>> {
    const frontReversed = [...this._front].reverse();
    const backArray = this._back.toArray();
    const combined = frontReversed.concat(backArray);
    return combined[Symbol.iterator]();
  }
}
