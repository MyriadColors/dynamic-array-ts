/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from 'bun:test';
import { DynamicArray } from '../../index';

describe('LazyChain', () => {
  describe('Intermediate Operations', () => {
    test('map() should transform elements', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr
        .lazy()
        .map((v) => v * 2)
        .toArray();
      expect(result).toEqual([2, 4, 6]);
    });

    test('filter() should filter elements', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      const result = arr
        .lazy()
        .filter((v) => v % 2 === 0)
        .toArray();
      expect(result).toEqual([2, 4]);
    });

    test('take() should take first n elements', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      const result = arr.lazy().take(3).toArray();
      expect(result).toEqual([1, 2, 3]);
    });

    test('take() with count 0 should return empty', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().take(0).toArray();
      expect(result).toEqual([]);
    });

    test('drop() should drop first n elements', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      const result = arr.lazy().drop(2).toArray();
      expect(result).toEqual([3, 4, 5]);
    });

    test('drop() with count 0 should return all', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().drop(0).toArray();
      expect(result).toEqual([1, 2, 3]);
    });

    test('takeWhile() should take elements while predicate is true', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 1);
      const result = arr
        .lazy()
        .takeWhile((v) => v < 4)
        .toArray();
      expect(result).toEqual([1, 2, 3]);
    });

    test('dropWhile() should drop elements while predicate is true', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      const result = arr
        .lazy()
        .dropWhile((v) => v < 3)
        .toArray();
      expect(result).toEqual([3, 4, 5]);
    });

    test('flatMap() should flatten results', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr
        .lazy()
        .flatMap((v) => [v, v * 2])
        .toArray();
      expect(result).toEqual([1, 2, 2, 4, 3, 6]);
    });

    test('distinct() should remove duplicates', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 2, 3, 3, 3);
      const result = arr.lazy().distinct().toArray();
      expect(result).toEqual([1, 2, 3]);
    });

    test('enumerate() should add index to each element', () => {
      const arr = new DynamicArray();
      arr.push(10, 20, 30);
      const result = arr.lazy().enumerate().toArray();
      expect(result).toEqual([
        [0, 10],
        [1, 20],
        [2, 30],
      ]);
    });

    test('chaining multiple operations', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
      const result = arr
        .lazy()
        .filter((v) => v % 2 === 0)
        .map((v) => v * 2)
        .take(3)
        .toArray();
      expect(result).toEqual([4, 8, 12]);
    });
  });

  describe('Terminal Operations', () => {
    test('collect() should return DynamicArray', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().collect();
      expect(result).toBeInstanceOf(DynamicArray);
      expect(result.toArray()).toEqual([1, 2, 3]);
    });

    test('toArray() should return array', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().toArray();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([1, 2, 3]);
    });

    test('reduce() should accumulate values', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4);
      const result = arr.lazy().reduce((acc, v) => acc + v, 0);
      expect(result).toBe(10);
    });

    test('first() should return first element', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().first();
      expect(result).toBe(1);
    });

    test('first() on empty should return undefined', () => {
      const arr = new DynamicArray();
      const result = arr.lazy().first();
      expect(result).toBeUndefined();
    });

    test('last() should return last element', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().last();
      expect(result).toBe(3);
    });

    test('last() on empty should return undefined', () => {
      const arr = new DynamicArray();
      const result = arr.lazy().last();
      expect(result).toBeUndefined();
    });

    test('find() should find matching element', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      const result = arr.lazy().find((v) => v > 3);
      expect(result).toBe(4);
    });

    test('find() on no match should return undefined', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().find((v) => v > 10);
      expect(result).toBeUndefined();
    });

    test('some() should return true if any match', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().some((v) => v === 2);
      expect(result).toBe(true);
    });

    test('some() should return false if none match', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().some((v) => v === 5);
      expect(result).toBe(false);
    });

    test('every() should return true if all match', () => {
      const arr = new DynamicArray();
      arr.push(2, 4, 6);
      const result = arr.lazy().every((v) => v % 2 === 0);
      expect(result).toBe(true);
    });

    test("every() should return false if any don't match", () => {
      const arr = new DynamicArray();
      arr.push(2, 3, 4);
      const result = arr.lazy().every((v) => v % 2 === 0);
      expect(result).toBe(false);
    });

    test('count() should return element count', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      const result = arr.lazy().count();
      expect(result).toBe(5);
    });

    test('sum() should return sum of elements', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      const result = arr.lazy().sum();
      expect(result).toBe(15);
    });

    test('min() should return minimum element', () => {
      const arr = new DynamicArray();
      arr.push(3, 1, 4, 1, 5);
      const result = arr.lazy().min();
      expect(result).toBe(1);
    });

    test('max() should return maximum element', () => {
      const arr = new DynamicArray();
      arr.push(3, 1, 4, 1, 5);
      const result = arr.lazy().max();
      expect(result).toBe(5);
    });

    test('average() should return average', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      const result = arr.lazy().average();
      expect(result).toBe(3);
    });

    test('average() on empty should return undefined', () => {
      const arr = new DynamicArray();
      const result = arr.lazy().average();
      expect(result).toBeUndefined();
    });

    test('forEach() should iterate all elements', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result: number[] = [];
      arr.lazy().forEach((v) => {
        result.push(v);
      });
      expect(result).toEqual([1, 2, 3]);
    });

    test('toMap() should return Map', () => {
      const arr = new DynamicArray();
      arr.push(10, 20, 30);
      const result = arr.lazy().toMap();
      expect(result).toBeInstanceOf(Map);
      expect(result.get(0)).toBe(10);
      expect(result.get(1)).toBe(20);
      expect(result.get(2)).toBe(30);
    });
  });

  describe('Consumption', () => {
    test('should throw when consuming twice', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const chain = arr.lazy();
      chain.toArray();
      expect(() => chain.toArray()).toThrow();
    });

    test('collect() should consume chain', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const chain = arr.lazy();
      chain.collect();
      expect(() => chain.first()).toThrow();
    });
  });

  describe('reverse and sorted', () => {
    test('reverse() should reverse elements', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr.lazy().reverse().toArray();
      expect(result).toEqual([3, 2, 1]);
    });

    test('sorted() should sort elements', () => {
      const arr = new DynamicArray();
      arr.push(3, 1, 2);
      const result = arr.lazy().sorted().toArray();
      expect(result).toEqual([1, 2, 3]);
    });

    test('sorted() with compareFn should sort with custom comparator', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result = arr
        .lazy()
        .sorted((a, b) => b - a)
        .toArray();
      expect(result).toEqual([3, 2, 1]);
    });
  });

  describe('Iterator', () => {
    test('Symbol.iterator should work with for...of', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result: number[] = [];
      for (const v of arr.lazy()) {
        result.push(v);
      }
      expect(result).toEqual([1, 2, 3]);
    });

    test('Symbol.iterator should work after map', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      const result: number[] = [];
      for (const v of arr.lazy().map((x) => x * 2)) {
        result.push(v);
      }
      expect(result).toEqual([2, 4, 6]);
    });
  });

  describe('Lazy evaluation', () => {
    test('should not execute until terminal operation', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      let counter = 0;
      const chain = arr
        .lazy()
        .map((v) => {
          counter++;
          return v * 2;
        })
        .filter((v) => v > 2);
      expect(counter).toBe(0);
      chain.first();
      expect(counter).toBe(2);
    });

    test('first() should short-circuit', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3);
      let counter = 0;
      const result = arr
        .lazy()
        .map((v) => {
          counter++;
          return v * 2;
        })
        .first();
      expect(result).toBe(2);
      expect(counter).toBe(1);
    });

    test('take() should not process extra elements', () => {
      const arr = new DynamicArray();
      arr.push(1, 2, 3, 4, 5);
      let counter = 0;
      const result = arr
        .lazy()
        .map((v) => {
          counter++;
          return v;
        })
        .take(2)
        .toArray();
      expect(result).toEqual([1, 2]);
      expect(counter).toBe(2);
    });
  });
});
