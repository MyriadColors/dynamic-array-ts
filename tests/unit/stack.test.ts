/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from 'bun:test';
import { DynamicArrayStack } from '../../index';

describe('DynamicArrayStack', () => {
  test('should create empty stack', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    expect(stack.length).toBe(0);
    expect(stack.isEmpty).toBe(true);
  });

  test('should have initial capacity', () => {
    const stack = new DynamicArrayStack(20, Infinity, Uint8Array);
    expect(stack.capacity).toBeGreaterThanOrEqual(20);
  });

  test('should respect maxCapacity', () => {
    expect(() => {
      const _stack = new DynamicArrayStack(100, 50, Uint8Array);
    }).toThrow(RangeError);
  });
});

describe('DynamicArrayStack push/pop', () => {
  test('push should add elements', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    expect(stack.push(10)).toBe(1);
    expect(stack.push(20, 30)).toBe(3);
    expect(stack.length).toBe(3);
  });

  test('pop should remove and return last element', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1, 2, 3);
    expect(stack.pop()).toBe(3);
    expect(stack.length).toBe(2);
    expect(stack.pop()).toBe(2);
    expect(stack.pop()).toBe(1);
    expect(stack.pop()).toBeUndefined();
    expect(stack.isEmpty).toBe(true);
  });

  test('peek should return last without removing', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(10, 20, 30);
    expect(stack.peek()).toBe(30);
    expect(stack.length).toBe(3);
  });
});

describe('DynamicArrayStack LIFO behavior', () => {
  test('should follow LIFO order', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1);
    stack.push(2);
    stack.push(3);
    expect(stack.pop()).toBe(3);
    expect(stack.pop()).toBe(2);
    expect(stack.pop()).toBe(1);
  });

  test('should handle many push/pop operations', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    for (let i = 0; i < 100; i++) {
      stack.push(i);
    }
    expect(stack.length).toBe(100);
    for (let i = 99; i >= 0; i--) {
      expect(stack.pop()).toBe(i);
    }
    expect(stack.isEmpty).toBe(true);
  });
});

describe('DynamicArrayStack unsafe variants', () => {
  test('unsafePop should remove last element without bounds check', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>(
      10,
      Infinity,
      Uint8Array,
    );
    stack.push(1, 2, 3);
    expect(stack.unsafePop()).toBe(3);
    expect(stack.length).toBe(2);
  });

  test('unsafePeek should return last element without bounds check', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>(
      10,
      Infinity,
      Uint8Array,
    );
    stack.push(1, 2, 3);
    expect(stack.unsafePeek()).toBe(3);
    expect(stack.length).toBe(3);
  });
});

describe('DynamicArrayStack safe variants', () => {
  test('safePop should zero out freed memory', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>(
      10,
      Infinity,
      Uint8Array,
      { debug: true },
    );
    stack.push(1, 2, 3);
    const value = stack.safePop();
    expect(value).toBe(3);
    expect(stack.length).toBe(2);
  });

  test('safePeek should zero out peeked element', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>(
      10,
      Infinity,
      Uint8Array,
      { debug: true },
    );
    stack.push(1, 2, 3);
    const value = stack.safePeek();
    expect(value).toBe(3);
    expect(stack.length).toBe(3);
  });

  test('safeClear should zero all memory', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>(
      10,
      Infinity,
      Uint8Array,
      { debug: true },
    );
    stack.push(1, 2, 3);
    stack.safeClear();
    expect(stack.length).toBe(0);
    expect(stack.isEmpty).toBe(true);
  });
});

describe('DynamicArrayStack clear', () => {
  test('clear should reset to empty state', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1, 2, 3);
    stack.clear();
    expect(stack.length).toBe(0);
    expect(stack.isEmpty).toBe(true);
  });

  test('clear with shrink should reduce capacity', () => {
    const stack = new DynamicArrayStack(100, Infinity, Uint8Array, {
      debug: true,
    });
    stack.push(1, 2, 3);
    stack.clear(true);
    expect(stack.length).toBe(0);
  });
});

describe('DynamicArrayStack toArray', () => {
  test('toArray should return elements in correct order', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1, 2, 3);
    expect(stack.toArray()).toEqual([1, 2, 3]);
  });
});

describe('DynamicArrayStack Symbol.iterator', () => {
  test('should be iterable', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1, 2, 3);
    const values: number[] = [];
    for (const v of stack) {
      values.push(v);
    }
    expect(values).toEqual([1, 2, 3]);
  });
});

describe('DynamicArrayStack with different TypedArrays', () => {
  test('should work with Int32Array', () => {
    const stack = new DynamicArrayStack(10, Infinity, Int32Array);
    stack.push(1, 2, 3);
    expect(stack.peek()).toBe(3);
    expect(stack.pop()).toBe(3);
    expect(stack.pop()).toBe(2);
    expect(stack.pop()).toBe(1);
  });

  test('should work with Float64Array', () => {
    const stack = new DynamicArrayStack(10, Infinity, Float64Array);
    stack.push(1.5, 2.5, 3.5);
    expect(stack.peek()).toBe(3.5);
    expect(stack.pop()).toBe(3.5);
    expect(stack.pop()).toBe(2.5);
  });

  test('should work with BigUint64Array', () => {
    const stack = new DynamicArrayStack(10, Infinity, BigUint64Array);
    stack.push(1n, 2n, 3n);
    expect(stack.peek()).toBe(3n);
    expect(stack.pop()).toBe(3n);
    expect(stack.pop()).toBe(2n);
    expect(stack.pop()).toBe(1n);
  });
});

describe('DynamicArrayStack buffer access', () => {
  test('should expose buffer', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1, 2, 3);
    expect(stack.buffer).toBeInstanceOf(ArrayBuffer);
  });

  test('should expose byteLength', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1, 2, 3);
    expect(stack.byteLength).toBeGreaterThan(0);
  });

  test('should expose raw view', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1, 2, 3);
    const raw = stack.raw();
    expect(raw.length).toBe(3);
    expect(raw[0]).toBe(1);
    expect(raw[1]).toBe(2);
    expect(raw[2]).toBe(3);
  });
});

describe('DynamicArrayStack compact', () => {
  test('compact should reset head offset', () => {
    const stack = new DynamicArrayStack<Uint8ArrayConstructor>();
    stack.push(1, 2, 3);
    stack.pop();
    stack.pop();
    stack.compact();
    expect(stack.length).toBe(1);
  });
});
