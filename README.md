# DynamicArray

**A high-performance, dynamically resizing wrapper around JavaScript TypedArrays.**

Native JavaScript Arrays (`[]`) are dynamic but memory-inefficient for numbers. Native TypedArrays (`new Uint8Array(10)`) are memory-efficient but fixed-size.

**DynamicArray** combines the best of both worlds: the raw speed and memory density of TypedArrays with the automatic growth and ease-of-use of standard Arrays.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-blue)
![Coverage](https://img.shields.io/badge/performance-high-green)

## ✨ Features

- **🚀 High Performance:** Optimized "hot paths" for `push`, `unshift`, and iterations. Supports **efficient bulk insertion** from other arrays/TypedArrays.
- **💾 Memory Efficient:** Uses densely packed binary memory. No boxing/unboxing overhead for numbers.
- **🔄 Auto-Resizing:** Automatically grows and shrinks the underlying `ArrayBuffer` as needed.
- **⚡ Zero-Copy Interop:** Access the underlying buffer directly for WebAssembly, WebWorkers, or network packets.
- **🛡️ Type Safe:** Built with TypeScript. Supports all TypedArray constructors (`Uint8Array`, `Float64Array`, `BigInt64Array`, etc.).
- **🔧 Modern APIs:** Uses `ArrayBuffer.prototype.transfer` and `resize` where available.

## 📦 Installation

```bash
npm install dynamic-array
# or
bun add dynamic-array
```

## 🚀 Usage

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
const scores = new DynamicArray(100, Infinity, Float64Array);

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

## 📊 Performance

Benchmarks run on Bun v1.3.5. `DynamicArray` is optimized to reduce function call overhead and leverage native memory moves (`copyWithin`).

| Operation              | Native Array (`[]`) | DynamicArray      | Improvement                 |
|:-----------------------|:--------------------|:--------------------|:----------------------------|
| **Push** (single)      | ~1.1 µs             | **~0.05 µs**      | **20x Faster** (Hot path)   |
| **Push** (bulk/array)  | ~3.6 ms             | **~0.06 ms**      | **60x Faster** (Bulk insert)|
| **Map**                | ~3.03 µs            | **~2.87 µs**      | **~10% Faster**             |
| **Filter**             | ~5.35 µs            | **~4.08 µs**      | **25% Faster**              |
| **WASM Interop**       | ~78.9 µs            | **~0.06 µs**      | **1300x Faster** (Zero-copy)|

*Note: `push` benchmarks vary based on batch size. Bulk insertion uses native `.set()` for maximum throughput.*

## 🎯 Best Use Cases

### 1. Game Development & ECS

Store entity IDs, coordinates, or particle states in continuous memory. Iterating over a `DynamicArray` of coordinates is significantly more cache-friendly than iterating over an array of JS Objects.

### 2. Binary Data Construction

Building a network packet or file buffer? Instead of guessing the size or manually managing `offset` variables with a raw `Uint8Array`, use `DynamicArray` to `push` bytes and `truncate` or `raw()` when done.

### 3. WebAssembly Interop

WASM modules require linear memory (`ArrayBuffer`). `DynamicArray` manages the growing memory on the JS side, allowing you to pass `array.raw()` directly into WASM heaps without converting from a generic JS Array.

### 4. High-Frequency Time Series

Storing large sequences of sensor data, audio samples, or financial ticks. Using `Float64Array` via `DynamicArray` uses 8 bytes per number, whereas a standard JS Array uses pointers + boxed values (often 16-24+ bytes per item).

## 🧩 API Overview

### Core

- `push(...items)`: Add to end. O(1) amortized.

- `pop()`: Remove from end.
- `unshift(...items)`: Add to front. **Optimized O(N)** using `memmove`.
- `shift()`: Remove from front.
- `splice(start, count, ...items)`: Insert/Remove at index.

### Access

- `get(index)` / `set(index, value)`: Fast access.

- `at(index)`: Supports negative indices.
- `raw()`: Returns the underlying TypedArray view of valid elements.

### functional

- `map(callback)`: Returns a new `DynamicArray`.

- `filter(predicate)`: Returns a new `DynamicArray`.
- `reduce(callback)`: Reduces to value.
- `sort(compareFn?)`: In-place sort.

### Management

- `reserve(capacity)`: Pre-allocate memory to avoid resizing during inserts.

- `shrinkToFit()`: Release unused memory.
- `clear()`: Reset length to 0.

## 📄 License

MIT
