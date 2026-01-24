# DynamicArray

**A high-performance, dynamically resizing wrapper around JavaScript TypedArrays.**

Native JavaScript Arrays (`[]`) are dynamic but memory-inefficient for numbers. Native TypedArrays (`new Uint8Array(10)`) are memory-efficient but fixed-size.

**DynamicArray** combines the best of both worlds: the raw speed and memory density of TypedArrays with the automatic growth and ease-of-use of standard Arrays.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-blue)
![Coverage](https://img.shields.io/badge/performance-high-green)

## Features

- **High Performance:** Optimized "hot paths" for `push`, `unshift`, and iterations. Supports **efficient bulk insertion** from other arrays/TypedArrays.
- **Memory Efficient:** Uses densely packed binary memory. No boxing/unboxing overhead for numbers.
- **Auto-Resizing:** Automatically grows and shrinks the underlying `ArrayBuffer` as needed.
- **Zero-Copy Interop:** Access the underlying buffer directly for WebAssembly, WebWorkers, or network packets.
- **Type Safe:** Built with TypeScript. Supports all TypedArray constructors (`Uint8Array`, `Float64Array`, `BigInt64Array`, etc.).
- **Modern APIs:** Uses `ArrayBuffer.prototype.transfer` and `resize` where available.
- **Advanced Operations:** Includes methods like `compact()`, `pushAligned()`, `unsafeGet()`, `unsafePop()`, and more for performance-critical applications.
- **Comprehensive API:** Full compatibility with standard Array methods (`map`, `filter`, `reduce`, `forEach`, `sort`, `reverse`, `find`, `some`, `every`, etc.)

## Installation

```bash
npm install dynamic-array
# or
bun add dynamic-array
```

## Usage

### Basic Usage

The API mirrors the standard JavaScript Array API heavily.

```typescript
import { DynamicArray } from 'dynamic-array';

// Defaults to Uint8Array, initial capacity of 10
const list = new DynamicArray();

// Add elements (Automatic resizing)
list.push(10, 20, 30); 

// Efficient bulk insertion (Accepts Arrays, TypedArrays, etc.)
const extra = new Uint8Array([40, 50, 60]);
list.push(extra); 

// Access elements
console.log(list.get(1)); // 20
console.log(list.at(-1)); // 60

// Standard methods
list.pop(); // 60
console.log(list.length); // 5
```

### Specific Types

You can use any TypedArray constructor (e.g., `Float64Array`, `Int32Array`, `BigInt64Array`).

```typescript
// Create a Dynamic Array of 64-bit floats
const scores = new DynamicArray(10, Infinity, Float64Array);

scores.push(3.14159);
scores.push(2.71828);

// Map returns a new DynamicArray
const doubled = scores.map(n => n * 2);
console.log(doubled.get(0)); // 6.28318
```

### Zero-Copy Access (WASM / Workers)

This is where `DynamicArray` shines. You can get the raw view without copying data.

```typescript
const array = new DynamicArray(1024, Infinity, Uint8Array);
array.push(1, 2, 3, 4);

// Get a raw view of valid data (subarray)
const view = array.raw(); 

// Get the entire underlying buffer (useful for transfer)
const buffer = array.buffer;

postMessage(buffer, [buffer]); // Zero-copy transfer to a worker
```

### Advanced Usage Examples

#### Capacity Management

```typescript
// Pre-allocate capacity to avoid repeated resizing
const arr = new DynamicArray(1000);
arr.reserve(5000); // Pre-allocate memory

// Shrink to fit when done
arr.shrinkToFit(); // Release unused memory

// Truncate to specific length
arr.truncate(100); // Keep only first 100 elements
```

#### Performance-Critical Operations

```typescript
// Unsafe methods for performance-critical code (no bounds checking)
const arr = new DynamicArray();
arr.push(1, 2, 3);
console.log(arr.unsafeGet(0)); // Direct access, no bounds checking
console.log(arr.unsafePop());  // Direct pop, no bounds checking

// Push with alignment (useful for binary protocols)
const aligned = new DynamicArray(10, Infinity, Uint8Array);
aligned.push(1); // length 1
aligned.pushAligned(4, 2, 3); // Pads with zeros to align: [1, 0, 0, 0, 2, 3]
```

#### Iteration and Functional Methods

```typescript
const arr = new DynamicArray();
arr.push(1, 2, 3, 4, 5);

// Standard iteration
for (const value of arr) {
  console.log(value);
}

// Functional methods
const evens = arr.filter(x => x % 2 === 0);
const doubled = arr.map(x => x * 2);
const sum = arr.reduce((acc, val) => acc + val, 0);

// Search methods
const index = arr.indexOf(3);
const found = arr.find(x => x > 3);
const hasEven = arr.some(x => x % 2 === 0);
```

#### Type Conversion with Map

```typescript
// Convert between TypedArray types
const intArr = new DynamicArray(10, Infinity, Uint8Array);
intArr.push(1, 2, 3);

// Map to different TypedArray type
const floatArr = intArr.map(val => val + 0.5, Float64Array);
console.log(floatArr.get(0)); // 1.5
```

## Performance

Benchmarks run on Bun v1.3.5. `DynamicArray` is optimized to reduce function call overhead and leverage native memory moves (`copyWithin`).

| Operation              | Native Array (`[]`) | DynamicArray        | Improvement
|:-----------------------|:--------------------|:--------------------|:----------------------------|
| **Push** (single)      | ~1.1 µs             | **~0.05 µs**        | **20x Faster** (Hot path)   |
| **Push** (bulk/array)  | ~3.6 ms             | **~0.06 ms**        | **60x Faster** (Bulk insert)|
| **Map**                | ~3.03 µs            | **~2.87 µs**        | **~10% Faster**             |
| **Filter**             | ~5.35 µs            | **~4.08 µs**        | **25% Faster**              |
| **WASM Interop**       | ~78.9 µs            | **~0.06 µs**        | **1300x Faster** (Zero-copy)|

*Note: `push` benchmarks vary based on batch size. Bulk insertion uses native `.set()` for maximum throughput.*

## Best Use Cases

### 1. Game Development & ECS

Store entity IDs, coordinates, or particle states in continuous memory. Iterating over a `DynamicArray` of coordinates is significantly more cache-friendly than iterating over an array of JS Objects.

### 2. Binary Data Construction

Building a network packet or file buffer? Instead of guessing the size or manually managing `offset` variables with a raw `Uint8Array`, use `DynamicArray` to `push` bytes and `truncate` or `raw()` when done.

### 3. WebAssembly Interop

WASM modules require linear memory (`ArrayBuffer`). `DynamicArray` manages the growing memory on the JS side, allowing you to pass `array.raw()` directly into WASM heaps without converting from a generic JS Array.

### 4. High-Frequency Time Series

Storing large sequences of sensor data, audio samples, or financial ticks. Using `Float64Array` via `DynamicArray` uses 8 bytes per number, whereas a standard JS Array uses pointers + boxed values (often 16-24+ bytes per item).

### 5. Performance-Critical Applications

When you need the convenience of dynamic arrays with the performance of TypedArrays. The internal `_head` optimization allows efficient `shift()` and `unshift()` operations without full array copies.

## API Overview

### Constructor

```typescript
new DynamicArray<TypedArrayConstructor>(
  initialCapacity = 10,    // Initial capacity
  maxCapacity = Infinity,  // Maximum capacity
  TypedArrayCtor = Uint8Array // TypedArray constructor
)
```

### Core Mutation Methods

- `push(...items)`: Add to end. O(1) amortized. Accepts scalars and Array-like objects.
- `pushAligned(alignment, ...values)`: Push with padding to align to boundary.
- `pop()`: Remove from end.
- `unshift(...items)`: Add to front. **Optimized O(N)** using internal buffer management.
- `shift()`: Remove from front. Uses internal `_head` optimization.
- `splice(start, deleteCount, ...items)`: Insert/Remove at index.
- `reverse()`: Reverse elements in-place.
- `sort(compareFn?)`: In-place sort.
- `fill(value, start?, end?)`: Fill range with value.

### Access Methods

- `get(index)`: Get element at index (throws on out-of-bounds).
- `set(index, value)`: Set element at index (throws on out-of-bounds).
- `at(index)`: Get element at index, supporting negative indices (returns undefined if out of bounds).
- `unsafeGet(index)`: Get element without bounds checking (faster).
- `unsafePop()`: Pop without bounds checking (faster).
- `raw()`: Returns the underlying TypedArray view of valid elements (zero-copy).
- `toArray()`: Create a JavaScript array copy of elements.

### Search Methods

- `indexOf(searchElement, fromIndex?)`: Find first index of element.
- `lastIndexOf(searchElement, fromIndex?)`: Find last index of element.
- `includes(searchElement)`: Check if element exists.
- `find(predicate)`: Find first element matching predicate.
- `findIndex(predicate)`: Find index of first element matching predicate.

### Functional Methods

- `map(callback, TypedArrayCtor?)`: Transform to new `DynamicArray`. Optionally change TypedArray type.
- `filter(predicate)`: Return new `DynamicArray` with matching elements.
- `reduce(callback, initialValue)`: Reduce to single value.
- `forEach(callback)`: Execute callback for each element.
- `some(predicate)`: Test if any element satisfies predicate.
- `every(predicate)`: Test if all elements satisfy predicate.

### Capacity & Memory Methods

- `capacity`: Get current capacity.
- `length`: Get current length.
- `byteLength`: Get underlying buffer byte length.
- `reserve(minimumCapacity)`: Pre-allocate memory to avoid resizing during inserts.
- `shrinkToFit()`: Release unused memory.
- `clear(shrink?)`: Reset length to 0. Optionally shrink buffer.
- `truncate(newLength)`: Reduce length to specified value.
- `isEmpty`: Boolean property indicating if array is empty.

### Utility Methods

- `slice(start?, end?)`: Create new `DynamicArray` with copied range.
- `concat(other)`: Concatenate with another `DynamicArray`.
- `compact()`: Move elements to start of buffer, reset internal `_head`.
- `peekFront()`: Get first element without removing (undefined if empty).
- `peekBack()`: Get last element without removing (undefined if empty).
- `toString()`: String representation of array.

### Iteration

- `[Symbol.iterator]()`: Support for `for...of` loops.
- `forOf(callback)`: Execute callback for each element.
- `forEachSnapshot(callback)`: Execute callback with length snapshot (safe during mutations).

## Additional Features

The library also includes a `SerializedDynamicArray` class for storing JSON-serializable objects:

```typescript
import { SerializedDynamicArray } from 'dynamic-array';

const serArr = new SerializedDynamicArray();
serArr.pushObject({ name: "John", age: 30 });
serArr.pushObject({ name: "Jane", age: 25 });

const obj = serArr.popObject(); // { name: "Jane", age: 25 }
const firstObj = serArr.getObjectAt(0); // { name: "John", age: 30 }
```

## 🧪 Testing

Run the test suite with:

```bash
bun test
```

## 📈 Benchmarks

Run benchmarks with:

```bash
bun benchmarks/index.ts
```

## 📄 License

MIT
