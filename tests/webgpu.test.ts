import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../index";

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: <explanation>
describe("WebGPU Integration Scenarios", () => {
	test("Should produce an ArrayBuffer compatible with writeBuffer source", () => {
		// Scenario: Creating a vertex buffer (Position: Float32x3, UV: Float32x2)
		// Stride = 5 floats = 20 bytes.
		const vertexCount = 3;
		const vertices = new DynamicArray(vertexCount * 5, Infinity, Float32Array);

		// Triangle
		// V1
		vertices.push(0.0, 0.5, 0.0, 0.5, 1.0);
		// V2
		vertices.push(-0.5, -0.5, 0.0, 0.0, 0.0);
		// V3
		vertices.push(0.5, -0.5, 0.0, 1.0, 0.0);

		expect(vertices.length).toBe(15);

		// Access the underlying buffer
		const buffer = vertices.buffer;
		expect(buffer).toBeInstanceOf(ArrayBuffer);
		expect(buffer.byteLength).toBeGreaterThanOrEqual(15 * 4); // Capacity might be larger

		// In WebGPU, we often pass the offset and size to writeBuffer
		// queue.writeBuffer(gpuBuffer, 0, vertices.buffer, 0, vertices.byteLength);

		// Verify that we can create a view for the exact data range (simulating what writeBuffer does internally or what user sends)
		const dataView = new Float32Array(buffer, 0, vertices.length);
		expect(dataView[0]).toBe(0.0);
		expect(dataView[1]).toBe(0.5);
		expect(dataView[14]).toBe(0.0);
	});

	test("Should handle alignment/padding simulation for Uniform Buffers", () => {
		// WebGPU Uniform buffers often require 16-byte alignment for certain types (vec4).
		// DynamicArray doesn't enforce alignment on 'push', but users might rely on it for packing.

		const uboData = new DynamicArray(16, Infinity, Float32Array);

		// push vec3 color (r, g, b)
		uboData.push(1.0, 0.0, 0.0);
		// Padding float to align next vec4 to 16 bytes (if starting at 0)
		// 3 floats * 4 bytes = 12 bytes. Need 1 more float (4 bytes) to reach 16 bytes.
		uboData.push(0.0); // padding

		// push time (float), padding (3 floats)
		uboData.push(123.0, 0.0, 0.0, 0.0);

		expect(uboData.length).toBe(8); // 32 bytes
		expect(uboData.byteLength).toBeGreaterThanOrEqual(32);

		const raw = uboData.raw(); // Float32Array view
		expect(raw.byteLength).toBe(32);
		expect(raw[0]).toBe(1.0);
		expect(raw[4]).toBe(123.0);
	});

	test("Should work with Resizable ArrayBuffer if supported (maxCapacity set)", () => {
		// When maxCapacity is finite, the library tries to create a Resizable ArrayBuffer
		const maxFloats = 100;
		const arr = new DynamicArray(10, maxFloats, Float32Array);

		arr.push(1.0, 2.0, 3.0);

		const buffer = arr.buffer;

		// If the environment supports resizable buffers, maxByteLength should be set
		if ((buffer as any).resizable) {
			expect((buffer as any).maxByteLength).toBe(maxFloats * 4);
		}

		// WebGPU APIs should handle this buffer.
		// We verify we can read it via standard views.
		const view = new Float32Array(buffer, 0, 3);
		expect(view[0]).toBe(1.0);

		// Grow it
		for (let i = 0; i < 20; i++) arr.push(i);

		// Buffer reference might change if resize happened via transfer,
		// or stay same if resize happened in place.
		// The key is that the new data is accessible.
		const newView = arr.raw();
		expect(newView.length).toBe(23);
		expect(newView[3]).toBe(0);
	});
});
