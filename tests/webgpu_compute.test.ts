import { describe, expect, test } from "bun:test";
import { DynamicArray } from "../index";
// @ts-ignore
import { setupGlobals } from "bun-webgpu";

// Polyfill globals for this test file
setupGlobals();

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: <explanation>
describe("WebGPU Compute Integration (Real Hardware/Software)", () => {
	// biome-ignore lint/complexity/noExcessiveLinesPerFunction: <explanation>
	test("Should run a compute shader on DynamicArray data", async () => {
		// Verify globals are set
		if (typeof navigator === 'undefined' || !navigator.gpu) {
			console.warn("WebGPU not supported/loaded in this environment.");
			return;
		}

		// 1. Initialize data using DynamicArray
		// We'll create an array of 4 floats: [1, 2, 3, 4]
		const inputData = new DynamicArray(4, Infinity, Float32Array);
		inputData.push(1.0, 2.0, 3.0, 4.0);

		// 2. Setup WebGPU
		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) {
			throw new Error("No WebGPU adapter found");
		}
		const device = await adapter.requestDevice();

		// 3. Create GPU Buffer
		// Size: 4 floats * 4 bytes = 16 bytes
		const bufferSize = inputData.byteLength;
		
		// Create a buffer directly mapped at creation? Or create and write?
		// Common pattern: Create STORAGE | COPY_SRC | COPY_DST buffer
		const gpuBuffer = device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});

		// 4. Load data into the buffer (Integration Point)
		// We copy directly from DynamicArray's view/buffer into the mapped range
		const mappedRange = new Float32Array(gpuBuffer.getMappedRange());
		// DynamicArray.raw() gives us a TypedArray view of valid data
		mappedRange.set(inputData.raw()); 
		gpuBuffer.unmap();

		// 5. Create Compute Shader
		// Simple shader: multiply each element by 10.
		const shaderCode = `
			@group(0) @binding(0) var<storage, read_write> data : array<f32>;

			@compute @workgroup_size(1)
			fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
				let index = global_id.x;
				if (index < arrayLength(&data)) {
					data[index] = data[index] * 10.0;
				}
			}
		`;
		const shaderModule = device.createShaderModule({ code: shaderCode });

		// 6. Pipeline Setup
		const pipeline = device.createComputePipeline({
			layout: "auto",
			compute: {
				module: shaderModule,
				entryPoint: "main",
			},
		});

		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{
					binding: 0,
					resource: {
						buffer: gpuBuffer,
					},
				},
			],
		});

		// 7. Dispatch
		const commandEncoder = device.createCommandEncoder();
		const passEncoder = commandEncoder.beginComputePass();
		passEncoder.setPipeline(pipeline);
		passEncoder.setBindGroup(0, bindGroup);
		// Dispatch 4 items (workgroup_size=1, so 4 workgroups)
		passEncoder.dispatchWorkgroups(4);
		passEncoder.end();

		// Add a command to copy the result to a readback buffer
		// (Or map_read, but we need a separate buffer for that usually in WebGPU specs, 
		// unless we use MAP_READ usage, which can't be STORAGE usually)
		
		const readBuffer = device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
		
		commandEncoder.copyBufferToBuffer(gpuBuffer, 0, readBuffer, 0, bufferSize);
		
		device.queue.submit([commandEncoder.finish()]);

		// 8. Read back results
		await readBuffer.mapAsync(GPUMapMode.READ);
		const resultBuffer = readBuffer.getMappedRange();
		const resultData = new Float32Array(resultBuffer);

		// 9. Verify
		// [1, 2, 3, 4] * 10 = [10, 20, 30, 40]
		expect(resultData[0]).toBe(10);
		expect(resultData[1]).toBe(20);
		expect(resultData[2]).toBe(30);
		expect(resultData[3]).toBe(40);

		readBuffer.unmap();
	});
});
