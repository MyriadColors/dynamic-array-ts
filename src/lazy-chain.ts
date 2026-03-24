import { DynamicArray } from './dynamic-array';
import type { ElementType, TypedArrayConstructor } from './types';

interface IteratorResultYield<T> {
  done?: false;
  value: T;
}

interface IteratorResultDone<T> {
  done: true;
  value?: T;
}

type IteratorResult<T, TReturn = unknown> =
  | IteratorResultYield<T>
  | IteratorResultDone<TReturn>;

interface Iterator<T, TReturn = unknown, TNext = undefined> {
  next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
}

type AnyIterator = Iterator<unknown, unknown, unknown>;

export class LazyChain<T extends TypedArrayConstructor, U> {
  private _source: DynamicArray<T>;
  private _operations: Array<(source: AnyIterator) => AnyIterator>;
  private _consumed: boolean = false;

  private constructor(source: DynamicArray<T>) {
    this._source = source;
    this._operations = [];
  }

  static from<T extends TypedArrayConstructor>(
    source: DynamicArray<T>,
  ): LazyChain<T, ElementType<T>> {
    return new LazyChain(source) as LazyChain<T, ElementType<T>>;
  }

  private addOperation<V>(
    op: (source: AnyIterator) => AnyIterator,
  ): LazyChain<T, V> {
    const chain = new LazyChain(this._source);
    chain._operations = [...this._operations, op];
    return chain as unknown as LazyChain<T, V>;
  }

  private execute(): AnyIterator {
    let iter: AnyIterator = this._source[Symbol.iterator]();
    for (const op of this._operations) {
      iter = op(iter);
    }
    return iter;
  }

  private checkConsumed(): void {
    if (this._consumed) {
      throw new Error('LazyChain has already been consumed');
    }
  }

  map<V extends TypedArrayConstructor = T>(
    transform: (value: U, index: number) => ElementType<V>,
  ): LazyChain<T, ElementType<V>> {
    let idx = 0;
    return this.addOperation<ElementType<V>>((source) => ({
      next(): IteratorResult<unknown> {
        const result = source.next();
        if (result.done) return result;
        const transformed = transform(result.value as U, idx++);
        return { value: transformed, done: false };
      },
    }));
  }

  filter(predicate: (value: U, index: number) => boolean): LazyChain<T, U> {
    let idx = 0;
    return this.addOperation<U>((source) => ({
      next(): IteratorResult<unknown> {
        while (true) {
          const result = source.next();
          if (result.done) return result;
          if (predicate(result.value as U, idx++)) {
            return result;
          }
        }
      },
    }));
  }

  take(n: number): LazyChain<T, U> {
    let taken = 0;
    return this.addOperation<U>((source) => ({
      next(): IteratorResult<unknown> {
        if (taken >= n) return { done: true };
        taken++;
        return source.next();
      },
    }));
  }

  drop(n: number): LazyChain<T, U> {
    let dropped = 0;
    return this.addOperation<U>((source) => ({
      next(): IteratorResult<unknown> {
        while (dropped < n) {
          dropped++;
          const result = source.next();
          if (result.done) return result;
        }
        return source.next();
      },
    }));
  }

  takeWhile(predicate: (value: U, index: number) => boolean): LazyChain<T, U> {
    let idx = 0;
    let taking = true;
    return this.addOperation<U>((source) => ({
      next(): IteratorResult<unknown> {
        if (!taking) return { done: true };
        const result = source.next();
        if (result.done) return result;
        if (!predicate(result.value as U, idx++)) {
          taking = false;
          return { done: true };
        }
        return result;
      },
    }));
  }

  dropWhile(predicate: (value: U, index: number) => boolean): LazyChain<T, U> {
    let idx = 0;
    let dropping = true;
    return this.addOperation<U>((source) => ({
      next(): IteratorResult<unknown> {
        while (dropping) {
          const result = source.next();
          if (result.done) return result;
          if (!predicate(result.value as U, idx++)) {
            dropping = false;
            return result;
          }
        }
        return source.next();
      },
    }));
  }

  flatMap<V extends TypedArrayConstructor = T>(
    transform: (value: U, index: number) => Iterable<ElementType<V>>,
  ): LazyChain<T, ElementType<V>> {
    let idx = 0;
    let currentIter: AnyIterator | null = null;
    return this.addOperation<ElementType<V>>((source) => ({
      next(): IteratorResult<unknown> {
        while (true) {
          if (!currentIter) {
            const result = source.next();
            if (result.done) return result;
            currentIter = transform(result.value as U, idx++)[
              Symbol.iterator
            ]() as AnyIterator;
          }
          const innerResult = currentIter.next();
          if (!innerResult.done) return innerResult;
          currentIter = null;
        }
      },
    }));
  }

  enumerate(): LazyChain<T, [number, U]> {
    let idx = 0;
    return this.addOperation<[number, U]>((source) => ({
      next(): IteratorResult<unknown> {
        const result = source.next();
        if (result.done) return result;
        return { value: [idx++, result.value as U], done: false };
      },
    }));
  }

  collect(): DynamicArray<T> {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    const result = new DynamicArray<T>();
    let r = iter.next();
    while (!r.done) {
      result.push(r.value as ElementType<T>);
      r = iter.next();
    }
    return result;
  }

  toArray(): U[] {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    const result: U[] = [];
    let r = iter.next();
    while (!r.done) {
      result.push(r.value as U);
      r = iter.next();
    }
    return result;
  }

  reduce<V>(
    callback: (accumulator: V, value: U, index: number) => V,
    initialValue: V,
  ): V {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let accumulator = initialValue;
    let idx = 0;
    let r = iter.next();
    while (!r.done) {
      accumulator = callback(accumulator, r.value as U, idx++);
      r = iter.next();
    }
    return accumulator;
  }

  first(): U | undefined {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    const r = iter.next();
    return r.done ? undefined : (r.value as U);
  }

  find(predicate: (value: U, index: number) => boolean): U | undefined {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let idx = 0;
    let r = iter.next();
    while (!r.done) {
      if (predicate(r.value as U, idx++)) {
        return r.value as U;
      }
      r = iter.next();
    }
    return undefined;
  }

  some(predicate: (value: U, index: number) => boolean): boolean {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let idx = 0;
    let r = iter.next();
    while (!r.done) {
      if (predicate(r.value as U, idx++)) {
        return true;
      }
      r = iter.next();
    }
    return false;
  }

  every(predicate: (value: U, index: number) => boolean): boolean {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let idx = 0;
    let r = iter.next();
    while (!r.done) {
      if (!predicate(r.value as U, idx++)) {
        return false;
      }
      r = iter.next();
    }
    return true;
  }

  forEach(callback: (value: U, index: number) => void): void {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let idx = 0;
    let r = iter.next();
    while (!r.done) {
      callback(r.value as U, idx++);
      r = iter.next();
    }
  }

  toMap(): Map<number, U> {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    const result = new Map<number, U>();
    let idx = 0;
    let r = iter.next();
    while (!r.done) {
      result.set(idx++, r.value as U);
      r = iter.next();
    }
    return result;
  }

  count(): number {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let count = 0;
    while (iter.next().done === false) {
      count++;
    }
    return count;
  }

  last(): U | undefined {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let lastValue: U | undefined;
    let r = iter.next();
    while (!r.done) {
      lastValue = r.value as U;
      r = iter.next();
    }
    return lastValue;
  }

  sum(): number {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let sum = 0;
    let r = iter.next();
    while (!r.done) {
      sum += r.value as number;
      r = iter.next();
    }
    return sum;
  }

  min(): U | undefined {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let min: U | undefined;
    let r = iter.next();
    while (!r.done) {
      const value = r.value as U;
      if (min === undefined || (value as number) < (min as number)) {
        min = value;
      }
      r = iter.next();
    }
    return min;
  }

  max(): U | undefined {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let max: U | undefined;
    let r = iter.next();
    while (!r.done) {
      const value = r.value as U;
      if (max === undefined || (value as number) > (max as number)) {
        max = value;
      }
      r = iter.next();
    }
    return max;
  }

  average(): number | undefined {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    let sum = 0;
    let count = 0;
    let r = iter.next();
    while (!r.done) {
      sum += r.value as number;
      count++;
      r = iter.next();
    }
    return count > 0 ? sum / count : undefined;
  }

  distinct(): LazyChain<T, U> {
    return this.addOperation<U>((source) => {
      const seen = new Set<U>();
      return {
        next(): IteratorResult<unknown> {
          while (true) {
            const result = source.next();
            if (result.done) return result;
            if (!seen.has(result.value as U)) {
              seen.add(result.value as U);
              return result;
            }
          }
        },
      };
    });
  }

  reverse(): LazyChain<T, U> {
    const arr = this.toArray();
    arr.reverse();
    const sourceArr = this._source as unknown as {
      length: number;
      TypedArrayCtor: T;
    };
    return LazyChain.from(
      DynamicArray.from(
        arr as unknown as ArrayLike<ElementType<T>>,
        sourceArr.TypedArrayCtor,
      ),
    ) as LazyChain<T, U>;
  }

  sorted(compareFn?: (a: U, b: U) => number): LazyChain<T, U> {
    const arr = this.toArray();
    arr.sort(compareFn as (a: U, b: U) => number);
    const sourceArr = this._source as unknown as {
      length: number;
      TypedArrayCtor: T;
    };
    return LazyChain.from(
      DynamicArray.from(
        arr as unknown as ArrayLike<ElementType<T>>,
        sourceArr.TypedArrayCtor,
      ),
    ) as LazyChain<T, U>;
  }

  collectInto<V extends TypedArrayConstructor>(
    TypedArrayCtor: V,
  ): DynamicArray<V> {
    this.checkConsumed();
    this._consumed = true;
    const iter = this.execute();
    const result = new DynamicArray<V>(10, Infinity, TypedArrayCtor);
    let r = iter.next();
    while (!r.done) {
      result.push(r.value as ElementType<V>);
      r = iter.next();
    }
    return result;
  }

  toDynamicArray(): DynamicArray<T> {
    return this.collect();
  }

  [Symbol.iterator](): Iterator<U> {
    const iter = this.execute();
    let consumed = false;

    return {
      next(): IteratorResult<U> {
        if (consumed) {
          return { done: true, value: undefined as unknown as U };
        }
        const result = iter.next();
        if (result.done) {
          consumed = true;
          return { done: true, value: undefined as unknown as U };
        }
        return { done: false, value: result.value as U };
      },
    };
  }
}
