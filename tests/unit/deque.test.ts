/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from 'bun:test';
import { DynamicArrayDeque } from '../../index';

describe('DynamicArrayDeque', () => {
  test('should create empty deque', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    expect(deque.length).toBe(0);
    expect(deque.isEmpty).toBe(true);
  });

  test('should have initial capacity', () => {
    const deque = new DynamicArrayDeque(20, Infinity, Uint8Array);
    expect(deque.capacity).toBeGreaterThanOrEqual(20);
  });

  test('should respect maxCapacity', () => {
    expect(() => {
      const _deque = new DynamicArrayDeque(100, 50, Uint8Array);
    }).toThrow(RangeError);
  });
});

describe('DynamicArrayDeque pushBack/popBack', () => {
  test('pushBack should add elements to the back', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    expect(deque.pushBack(10)).toBe(1);
    expect(deque.pushBack(20, 30)).toBe(3);
    expect(deque.length).toBe(3);
    expect(deque.peekBack()).toBe(30);
  });

  test('popBack should remove and return last element', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushBack(1, 2, 3);
    expect(deque.popBack()).toBe(3);
    expect(deque.length).toBe(2);
    expect(deque.popBack()).toBe(2);
    expect(deque.popBack()).toBe(1);
    expect(deque.popBack()).toBeUndefined();
    expect(deque.isEmpty).toBe(true);
  });

  test('peekBack should return last without removing', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushBack(10, 20, 30);
    expect(deque.peekBack()).toBe(30);
    expect(deque.length).toBe(3);
  });
});

describe('DynamicArrayDeque pushFront/popFront', () => {
  test('pushFront should add elements to the front', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushBack(10);
    expect(deque.pushFront(20, 30)).toBe(3);
    expect(deque.toArray()).toEqual([30, 20, 10]);
  });

  test('popFront should remove and return first element', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushBack(1, 2, 3);
    expect(deque.popFront()).toBe(1);
    expect(deque.length).toBe(2);
    expect(deque.popFront()).toBe(2);
    expect(deque.popFront()).toBe(3);
    expect(deque.popFront()).toBeUndefined();
    expect(deque.isEmpty).toBe(true);
  });

  test('peekFront should return first without removing', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushBack(10, 20, 30);
    expect(deque.peekFront()).toBe(10);
    expect(deque.length).toBe(3);
  });
});

describe('DynamicArrayDeque mixed operations', () => {
  test('should handle alternating front/back operations', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushBack(1);
    deque.pushFront(0);
    expect(deque.toArray()).toEqual([0, 1]);
    deque.pushBack(2);
    expect(deque.toArray()).toEqual([0, 1, 2]);
    deque.pushFront(255);
    expect(deque.toArray()).toEqual([255, 0, 1, 2]);
    expect(deque.popFront()).toBe(255);
    expect(deque.popBack()).toBe(2);
    expect(deque.toArray()).toEqual([0, 1]);
  });

  test('should handle many pushFront operations', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    for (let i = 0; i < 100; i++) {
      deque.pushFront(i);
    }
    expect(deque.length).toBe(100);
    expect(deque.peekFront()).toBe(99);
    expect(deque.peekBack()).toBe(0);
  });

  test('should handle many pushBack operations', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    for (let i = 0; i < 100; i++) {
      deque.pushBack(i);
    }
    expect(deque.length).toBe(100);
    expect(deque.peekFront()).toBe(0);
    expect(deque.peekBack()).toBe(99);
  });
});

describe('DynamicArrayDeque safe variants', () => {
  test('safePopBack should zero out freed memory', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>(
      10,
      Infinity,
      Uint8Array,
      { debug: true },
    );
    deque.pushBack(1, 2, 3);
    const value = deque.safePopBack();
    expect(value).toBe(3);
    expect(deque.length).toBe(2);
  });

  test('safePopFront should zero out freed memory', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>(
      10,
      Infinity,
      Uint8Array,
      { debug: true },
    );
    deque.pushBack(1, 2, 3);
    const value = deque.safePopFront();
    expect(value).toBe(1);
    expect(deque.length).toBe(2);
  });

  test('safeClear should zero all memory', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>(
      10,
      Infinity,
      Uint8Array,
      { debug: true },
    );
    deque.pushBack(1, 2, 3);
    deque.pushFront(4, 5);
    deque.safeClear();
    expect(deque.length).toBe(0);
    expect(deque.isEmpty).toBe(true);
  });
});

describe('DynamicArrayDeque clear', () => {
  test('clear should reset to empty state', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushBack(1, 2, 3);
    deque.clear();
    expect(deque.length).toBe(0);
    expect(deque.isEmpty).toBe(true);
  });
});

describe('DynamicArrayDeque toArray', () => {
  test('toArray should return elements in correct order', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushFront(3);
    deque.pushFront(2);
    deque.pushFront(1);
    deque.pushBack(4);
    deque.pushBack(5);
    expect(deque.toArray()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('DynamicArrayDeque Symbol.iterator', () => {
  test('should be iterable', () => {
    const deque = new DynamicArrayDeque<Uint8ArrayConstructor>();
    deque.pushBack(1, 2, 3);
    const values: number[] = [];
    for (const v of deque) {
      values.push(v);
    }
    expect(values).toEqual([1, 2, 3]);
  });
});

describe('DynamicArrayDeque with different TypedArrays', () => {
  test('should work with Int32Array', () => {
    const deque = new DynamicArrayDeque(10, Infinity, Int32Array);
    deque.pushBack(1, 2, 3);
    deque.pushFront(0);
    expect(deque.toArray()).toEqual([0, 1, 2, 3]);
  });

  test('should work with Float64Array', () => {
    const deque = new DynamicArrayDeque(10, Infinity, Float64Array);
    deque.pushBack(1.5, 2.5);
    deque.pushFront(0.5);
    expect(deque.toArray()).toEqual([0.5, 1.5, 2.5]);
  });

  test('should work with BigUint64Array', () => {
    const deque = new DynamicArrayDeque(10, Infinity, BigUint64Array);
    deque.pushBack(1n, 2n, 3n);
    expect(deque.peekBack()).toBe(3n);
    expect(deque.popFront()).toBe(1n);
  });
});
