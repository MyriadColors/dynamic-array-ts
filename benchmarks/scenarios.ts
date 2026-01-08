import { bench, do_not_optimize, group } from "mitata";
import { DynamicArray } from "../index";

// Helper to generate random data chunks
function generateChunk(size: number): Uint8Array {
	const chunk = new Uint8Array(size);
	for (let i = 0; i < size; i++) chunk[i] = (Math.random() * 256) | 0;
	return chunk;
}

group("Scenario: TCP/Network Packet Reassembly", () => {
	// Simulate receiving 100 packets of variable size (64b to 1kb),
	// appending them to a buffer, and then processing/clearing.

	const PACKET_COUNT = 100;
	const packets: Uint8Array[] = [];
	for (let i = 0; i < PACKET_COUNT; i++) {
		packets.push(generateChunk(64 + Math.floor(Math.random() * 1000)));
	}

	bench("DynamicArray Packet Buffer (Spread)", () => {
		const buffer = new DynamicArray(1024);
		for (const packet of packets) {
			// Push all bytes from packet using spread (Legacy/Slow path)
			buffer.push(...packet);
		}

		// Simulate processing: read the whole thing
		const data = buffer.raw();
		do_not_optimize(data);

		// Reset for next stream
		buffer.clear();
		return buffer;
	});

	bench("DynamicArray Packet Buffer (Bulk)", () => {
		const buffer = new DynamicArray(1024);
		for (const packet of packets) {
			// Push entire typed array (Optimized path)
			buffer.push(packet);
		}

		const data = buffer.raw();
		do_not_optimize(data);

		buffer.clear();
		return buffer;
	});

	bench("Native Array Packet Buffer", () => {
		const buffer: number[] = [];
		for (const packet of packets) {
			buffer.push(...packet);
		}

		// Simulate processing: convert to Uint8Array for 'binary' usage
		const data = new Uint8Array(buffer);
		do_not_optimize(data);

		// Native array doesn't really 'clear' keeping capacity,
		// usually we just make a new one or set length = 0.
		buffer.length = 0;
		return buffer;
	});

	// Manual buffer management (Simulating a raw implementation)
	bench("Manual Uint8Array Resize Buffer", () => {
		let buffer = new Uint8Array(1024);
		let length = 0;

		for (const packet of packets) {
			const required = length + packet.length;
			if (required > buffer.length) {
				let newCap = buffer.length * 2;
				while (newCap < required) newCap *= 2;
				const newBuffer = new Uint8Array(newCap);
				newBuffer.set(buffer.subarray(0, length));
				buffer = newBuffer;
			}
			buffer.set(packet, length);
			length += packet.length;
		}

		const data = buffer.subarray(0, length);
		do_not_optimize(data);
		return buffer;
	});
});

group("Scenario: 3D Mesh Generation (Vertex Builder)", () => {
	// Simulating building a mesh with Position (3), Normal (3), UV (2) = 8 floats per vertex.
	const VERTEX_COUNT = 5000;

	bench("DynamicArray<Float32Array>", () => {
		// Pre-allocate decent size to avoid too many early resizes
		const mesh = new DynamicArray(1024, Infinity, Float32Array);

		for (let i = 0; i < VERTEX_COUNT; i++) {
			// Push vertex data: x, y, z, nx, ny, nz, u, v
			mesh.push(i * 1.0, i * 1.0, i * 0.5, 0, 1, 0, 0.5, 0.5);
		}

		// Upload to GPU (get underlying buffer)
		return do_not_optimize(mesh.raw());
	});

	bench("Native Array -> Float32Array", () => {
		const mesh: number[] = [];
		for (let i = 0; i < VERTEX_COUNT; i++) {
			mesh.push(i * 1.0, i * 1.0, i * 0.5, 0, 1, 0, 0.5, 0.5);
		}

		// Upload (conversion cost)
		return do_not_optimize(new Float32Array(mesh));
	});
});

group("Scenario: Sliding Window (DSP)", () => {
	// Maintain a window of 1024 samples. Push 1, Shift 1.
	// Calculate average.

	bench("DynamicArray Sliding Window", () => {
		const window = new DynamicArray(1024, Infinity, Float64Array);
		// Fill initial
		for (let i = 0; i < 1024; i++) window.push(Math.random());

		// Process 100 steps
		for (let i = 0; i < 100; i++) {
			window.shift(); // Remove oldest
			window.push(Math.random()); // Add newest

			// Calculate avg
			let sum = 0;
			const raw = window.raw();
			for (let k = 0; k < raw.length; k++) sum += raw[k]!;
			do_not_optimize(sum / raw.length);
		}
	});

	bench("Native Array Sliding Window", () => {
		const window: number[] = [];
		for (let i = 0; i < 1024; i++) window.push(Math.random());

		for (let i = 0; i < 100; i++) {
			window.shift();
			window.push(Math.random());

			let sum = 0;
			for (let k = 0; k < window.length; k++) sum += window[k]!;
			do_not_optimize(sum / window.length);
		}
	});
});
