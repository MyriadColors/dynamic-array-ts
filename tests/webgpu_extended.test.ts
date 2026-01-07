import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../index";
// @ts-ignore
import { setupGlobals } from "bun-webgpu";

// Polyfill globals for this test file
setupGlobals();

describe("WebGPU Extended Integration", () => {
	
	test("Should correctly structure data for Indirect Draw calls", async () => {
		if (typeof navigator === 'undefined' || !navigator.gpu) return;

		// Indirect draw parameters are 4 x Uint32:
		// vertexCount, instanceCount, firstVertex, firstInstance
		const indirectData = new DynamicArray(4, Infinity, Uint32Array);
		
		// Add two draw commands
		// Draw 1: 6 vertices, 1 instance, start 0, start 0
		indirectData.push(6, 1, 0, 0); 
		// Draw 2: 3 vertices, 2 instances, start 6, start 1
		indirectData.push(3, 2, 6, 1);

		expect(indirectData.length).toBe(8);
		expect(indirectData.byteLength).toBe(32);

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("No adapter");
		const device = await adapter.requestDevice();

		// Create buffer with INDIRECT usage and STORAGE (to verify content via compute)
		const buffer = device.createBuffer({
			size: indirectData.byteLength,
			usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			mappedAtCreation: true,
		});

		// Write data
		new Uint32Array(buffer.getMappedRange()).set(indirectData.raw());
		buffer.unmap();

		// Read back via another buffer to verify integrity
		const readBuffer = device.createBuffer({
			size: indirectData.byteLength,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		});

		const encoder = device.createCommandEncoder();
		encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, indirectData.byteLength);
		device.queue.submit([encoder.finish()]);

		await readBuffer.mapAsync(GPUMapMode.READ);
		const result = new Uint32Array(readBuffer.getMappedRange());
		
		expect(result[0]).toBe(6);
		expect(result[1]).toBe(1);
		expect(result[4]).toBe(3);
		expect(result[5]).toBe(2);

		readBuffer.unmap();
	});

	test("Should handle struct alignments in Compute Shader (Particle System)", async () => {
		if (typeof navigator === 'undefined' || !navigator.gpu) return;

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("No adapter");
		const device = await adapter.requestDevice();

		// Struct Particle {
		//   pos: vec2<f32>, (0, 4)
		//   vel: vec2<f32>, (8, 12)
		// }
		// Size: 16 bytes. Alignment: 8 bytes.
		// DynamicArray (Float32) packs them tightly, which matches vec2<f32> x 2.
		
		const particleCount = 10;
		const particles = new DynamicArray(particleCount * 4, Infinity, Float32Array);
		
		// Initialize particles: Pos(0,0), Vel(1, 1)
		for (let i = 0; i < particleCount; i++) {
			particles.push(0.0, 0.0); // pos
			particles.push(1.0, 1.0); // vel
		}

		const bufferSize = particles.byteLength;
		const storageBuffer = device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
			mappedAtCreation: true
		});

		new Float32Array(storageBuffer.getMappedRange()).set(particles.raw());
		storageBuffer.unmap();

		// Compute shader to update position: pos += vel
		const shaderCode = `
			struct Particle {
				pos: vec2<f32>,
				vel: vec2<f32>,
			};

			@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;

			@compute @workgroup_size(1)
			fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
				let index = global_id.x;
				if (index < arrayLength(&particles)) {
					particles[index].pos = particles[index].pos + particles[index].vel;
				}
			}
		`;

		const module = device.createShaderModule({ code: shaderCode });
		const pipeline = device.createComputePipeline({
			layout: "auto",
			compute: { module, entryPoint: "main" }
		});

		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: storageBuffer } }]
		});

		const encoder = device.createCommandEncoder();
		const pass = encoder.beginComputePass();
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.dispatchWorkgroups(particleCount);
		pass.end();

		const readBuffer = device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		});
		encoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, bufferSize);
		device.queue.submit([encoder.finish()]);

		await readBuffer.mapAsync(GPUMapMode.READ);
		const result = new Float32Array(readBuffer.getMappedRange());
		
		// Verify first particle
		// Pos should be (0+1, 0+1) = (1, 1)
		expect(result[0]).toBe(1.0); 
		expect(result[1]).toBe(1.0);
		// Vel should remain (1, 1)
		expect(result[2]).toBe(1.0);
		expect(result[3]).toBe(1.0);

		// Verify last particle
		const lastIdx = (particleCount - 1) * 4;
		expect(result[lastIdx]).toBe(1.0);
		expect(result[lastIdx + 1]).toBe(1.0);

		readBuffer.unmap();
	});

	test("Should handle dynamic updates to mapped buffers", async () => {
		if (typeof navigator === 'undefined' || !navigator.gpu) return;

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("No adapter");
		const device = await adapter.requestDevice();

		// Create a mappable buffer
		const bufferSize = 1024;
		const buffer = device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
		});

		await buffer.mapAsync(GPUMapMode.WRITE);
		const mappedRange = buffer.getMappedRange();

		// Use DynamicArray to build data dynamically
		const dataBuilder = new DynamicArray(10, Infinity, Float32Array);
		dataBuilder.push(10, 20, 30);
		
		// ... some complex logic adding more data ...
		for(let i=0; i<5; i++) dataBuilder.push(i);

		// Write to mapped range
		// We only write the used portion
		new Float32Array(mappedRange).set(dataBuilder.raw());
		
		buffer.unmap();

		// Verify by reading back (requires copy to MAP_READ buffer usually, 
		// but since we just wrote it, let's trust the set() worked if no error. 
		// Or we can do a round trip.)
		
		const readBuffer = device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
		});
		
		const encoder = device.createCommandEncoder();
		encoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, bufferSize);
		device.queue.submit([encoder.finish()]);

		await readBuffer.mapAsync(GPUMapMode.READ);
		const result = new Float32Array(readBuffer.getMappedRange());

		expect(result[0]).toBe(10);
		expect(result[1]).toBe(20);
		expect(result[2]).toBe(30);
		expect(result[3]).toBe(0); // Loop start
		expect(result[7]).toBe(4); // Loop end

		readBuffer.unmap();
	});
});
