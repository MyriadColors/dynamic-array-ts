/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: these are just tests */
import { describe, expect, test } from 'bun:test';
import { RingBuffer, RingBufferError } from '../../index';

describe('RingBuffer', () => {
  test('should create empty buffer', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    expect(rb.length).toBe(0);
    expect(rb.isEmpty).toBe(true);
    expect(rb.isFull).toBe(false);
  });

  test('should have correct capacity', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(10);
    expect(rb.capacity).toBe(10);
    expect(rb.maxCapacity).toBe(10);
  });

  test('should reject zero capacity', () => {
    expect(() => {
      new RingBuffer(0);
    }).toThrow(RangeError);
  });

  test('should reject negative capacity', () => {
    expect(() => {
      new RingBuffer(-1);
    }).toThrow(RangeError);
  });
});

describe('RingBuffer write/read', () => {
  test('write should add elements', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    expect(rb.length).toBe(3);
    expect(rb.isEmpty).toBe(false);
  });

  test('read should remove and return elements in FIFO order', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    expect(rb.read()).toBe(1);
    expect(rb.read()).toBe(2);
    expect(rb.read()).toBe(3);
    expect(rb.isEmpty).toBe(true);
  });

  test('peek should return next element without removing', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    rb.write(10);
    rb.write(20);
    expect(rb.peek()).toBe(10);
    expect(rb.length).toBe(2);
  });

  test('write to full buffer should throw', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(2);
    rb.write(1);
    rb.write(2);
    expect(() => {
      rb.write(3);
    }).toThrow(RingBufferError);
  });

  test('read from empty buffer should throw', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    expect(() => {
      rb.read();
    }).toThrow(RingBufferError);
  });

  test('peek from empty buffer should throw', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    expect(() => {
      rb.peek();
    }).toThrow(RingBufferError);
  });
});

describe('RingBuffer wrap-around', () => {
  test('should wrap around after reaching capacity', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(3);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    expect(rb.read()).toBe(1);
    rb.write(4);
    expect(rb.read()).toBe(2);
    expect(rb.read()).toBe(3);
    expect(rb.read()).toBe(4);
  });

  test('should maintain correct order through multiple wrap-arounds', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(4);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    rb.write(4);
    rb.read();
    rb.read();
    rb.write(5);
    rb.write(6);
    expect(rb.length).toBe(4);
    const arr = rb.toArray();
    expect(arr).toEqual([3, 4, 5, 6]);
  });
});

describe('RingBuffer available', () => {
  test('should report correct available space', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    expect(rb.available).toBe(5);
    rb.write(1);
    expect(rb.available).toBe(4);
    rb.write(2);
    rb.write(3);
    expect(rb.available).toBe(2);
    rb.read();
    expect(rb.available).toBe(3);
  });
});

describe('RingBuffer clear', () => {
  test('clear should reset to empty state', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    rb.clear();
    expect(rb.length).toBe(0);
    expect(rb.isEmpty).toBe(true);
  });

  test('clear should reset read and write positions', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(3);
    rb.write(1);
    rb.write(2);
    rb.read();
    rb.clear();
    rb.write(10);
    expect(rb.read()).toBe(10);
  });
});

describe('RingBuffer toArray', () => {
  test('toArray should return elements in correct order', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    expect(rb.toArray()).toEqual([1, 2, 3]);
  });

  test('toArray should work after wrap-around', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(4);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    rb.write(4);
    rb.read();
    rb.read();
    rb.write(5);
    rb.write(6);
    expect(rb.toArray()).toEqual([3, 4, 5, 6]);
  });
});

describe('RingBuffer Symbol.iterator', () => {
  test('should be iterable', () => {
    const rb = new RingBuffer<Uint8ArrayConstructor>(5);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    const values: number[] = [];
    for (const v of rb) {
      values.push(v);
    }
    expect(values).toEqual([1, 2, 3]);
  });
});

describe('RingBuffer with different TypedArrays', () => {
  test('should work with Int32Array', () => {
    const rb = new RingBuffer(10, Int32Array);
    rb.write(1);
    rb.write(2);
    rb.write(3);
    expect(rb.read()).toBe(1);
    expect(rb.read()).toBe(2);
    expect(rb.read()).toBe(3);
  });

  test('should work with Float64Array', () => {
    const rb = new RingBuffer(10, Float64Array);
    rb.write(1.5);
    rb.write(2.5);
    expect(rb.read()).toBe(1.5);
    expect(rb.read()).toBe(2.5);
  });

  test('should work with BigUint64Array', () => {
    const rb = new RingBuffer(10, BigUint64Array);
    rb.write(1n);
    rb.write(2n);
    rb.write(3n);
    expect(rb.read()).toBe(1n);
    expect(rb.read()).toBe(2n);
    expect(rb.read()).toBe(3n);
  });
});

describe('RingBuffer debug mode', () => {
  test('should accept debug option', () => {
    const rb = new RingBuffer(5, undefined, { debug: true });
    expect(rb.length).toBe(0);
  });

  test('should work correctly in debug mode', () => {
    const rb = new RingBuffer(5, undefined, { debug: true });
    rb.write(1);
    rb.write(2);
    expect(rb.read()).toBe(1);
    expect(rb.read()).toBe(2);
  });
});
