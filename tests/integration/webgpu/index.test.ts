/** biome-ignore-all lint/complexity/noExcessiveLinesPerFunction: Those are just tests. */
import { describe, expect, test } from "bun:test";
import { setupGlobals } from "bun-webgpu";
import { DynamicArray } from "../../../index";
import { WebGPU } from "../../../utils";

// Polyfill globals for this test file
setupGlobals();

// Note: DXC is required for Dawn's D3D12 backend on Windows. If the DLLs
// are not present, skip the entire suite to keep CI green until provisioning
// is standardized. Configure one of the env vars below or add DXC to PATH.
const describeWebGpu = WebGPU.hasDxc() ? describe : describe.skip;

describeWebGpu("WebGPU Integration", () => {
	test("Should produce an ArrayBuffer compatible with writeBuffer source", () => {
		const vertexCount = 3;
		const vertices = new DynamicArray(vertexCount * 5, Infinity, Float32Array);

		vertices.push(0.0, 0.5, 0.0, 0.5, 1.0);
		vertices.push(-0.5, -0.5, 0.0, 0.0, 0.0);
		vertices.push(0.5, -0.5, 0.0, 1.0, 0.0);

		expect(vertices.length).toBe(15);

		const buffer = vertices.buffer;
		expect(buffer).toBeInstanceOf(ArrayBuffer);
		expect(buffer.byteLength).toBeGreaterThanOrEqual(15 * 4);

		const dataView = new Float32Array(buffer, 0, vertices.length);
		expect(dataView[0]).toBe(0.0);
		expect(dataView[1]).toBe(0.5);
		expect(dataView[14]).toBe(0.0);
	});

	test("Should handle alignment/padding simulation for Uniform Buffers", () => {
		const uboData = new DynamicArray(16, Infinity, Float32Array);
		uboData.push(1.0, 0.0, 0.0);
		uboData.push(0.0); // padding
		uboData.push(123.0, 0.0, 0.0, 0.0);

		expect(uboData.length).toBe(8);
		expect(uboData.byteLength).toBeGreaterThanOrEqual(32);

		const raw = uboData.raw();
		expect(raw.byteLength).toBe(32);
		expect(raw[0]).toBe(1.0);
		expect(raw[4]).toBe(123.0);
	});

	test("Should work with Resizable ArrayBuffer if supported (maxCapacity set)", () => {
		const maxFloats = 100;
		const arr = new DynamicArray(10, maxFloats, Float32Array);
		arr.push(1.0, 2.0, 3.0);

		const buffer = arr.buffer;
		const resizableBuffer = buffer as ArrayBuffer & {
			resizable?: boolean;
			maxByteLength?: number;
		};
		if (resizableBuffer.resizable) {
			expect(resizableBuffer.maxByteLength).toBe(maxFloats * 4);
		}

		const view = new Float32Array(buffer, 0, 3);
		expect(view[0]).toBe(1.0);

		for (let i = 0; i < 20; i++) arr.push(i);

		const newView = arr.raw();
		expect(newView.length).toBe(23);
		expect(newView[3]).toBe(0);
	});

	test("Should run a compute shader on DynamicArray data", async () => {
		if (typeof navigator === "undefined" || !navigator.gpu) return;

		const inputData = new DynamicArray(4, Infinity, Float32Array);
		inputData.push(1.0, 2.0, 3.0, 4.0);

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("No WebGPU adapter found");
		const device = await adapter.requestDevice();

		const bufferSize = inputData.byteLength;
		const gpuBuffer = device.createBuffer({
			size: bufferSize,
			usage:
				GPUBufferUsage.STORAGE |
				GPUBufferUsage.COPY_SRC |
				GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});

		new Float32Array(gpuBuffer.getMappedRange()).set(inputData.raw());
		gpuBuffer.unmap();

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
		const pipeline = device.createComputePipeline({
			layout: "auto",
			compute: { module: shaderModule, entryPoint: "main" },
		});

		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: gpuBuffer } }],
		});

		const commandEncoder = device.createCommandEncoder();
		const passEncoder = commandEncoder.beginComputePass();
		passEncoder.setPipeline(pipeline);
		passEncoder.setBindGroup(0, bindGroup);
		passEncoder.dispatchWorkgroups(4);
		passEncoder.end();

		const readBuffer = device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
		commandEncoder.copyBufferToBuffer(gpuBuffer, 0, readBuffer, 0, bufferSize);
		device.queue.submit([commandEncoder.finish()]);

		await readBuffer.mapAsync(GPUMapMode.READ);
		const resultData = new Float32Array(readBuffer.getMappedRange());

		expect(resultData[0]).toBe(10);
		expect(resultData[1]).toBe(20);
		expect(resultData[2]).toBe(30);
		expect(resultData[3]).toBe(40);

		readBuffer.unmap();
	});

	test("Should correctly structure data for Indirect Draw calls", async () => {
		if (typeof navigator === "undefined" || !navigator.gpu) return;

		const indirectData = new DynamicArray(4, Infinity, Uint32Array);
		indirectData.push(6, 1, 0, 0);
		indirectData.push(3, 2, 6, 1);

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("No adapter");
		const device = await adapter.requestDevice();

		const buffer = device.createBuffer({
			size: indirectData.byteLength,
			usage:
				GPUBufferUsage.INDIRECT |
				GPUBufferUsage.STORAGE |
				GPUBufferUsage.COPY_DST |
				GPUBufferUsage.COPY_SRC,
			mappedAtCreation: true,
		});

		new Uint32Array(buffer.getMappedRange()).set(indirectData.raw());
		buffer.unmap();

		const readBuffer = device.createBuffer({
			size: indirectData.byteLength,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});

		const encoder = device.createCommandEncoder();
		encoder.copyBufferToBuffer(
			buffer,
			0,
			readBuffer,
			0,
			indirectData.byteLength,
		);
		device.queue.submit([encoder.finish()]);

		await readBuffer.mapAsync(GPUMapMode.READ);
		const result = new Uint32Array(readBuffer.getMappedRange());

		expect(result[0]).toBe(6);
		expect(result[1]).toBe(1);
		expect(result[4]).toBe(3);
		expect(result[5]).toBe(2);

		readBuffer.unmap();
	});

	test("Should handle struct alignments in Compute Shader", async () => {
		if (typeof navigator === "undefined" || !navigator.gpu) return;

		const adapter = await navigator.gpu.requestAdapter();
		if (!adapter) throw new Error("No adapter");
		const device = await adapter.requestDevice();

		const particleCount = 10;
		const particles = new DynamicArray(
			particleCount * 4,
			Infinity,
			Float32Array,
		);

		for (let i = 0; i < particleCount; i++) {
			particles.push(0.0, 0.0); // pos
			particles.push(1.0, 1.0); // vel
		}

		const bufferSize = particles.byteLength;
		const storageBuffer = device.createBuffer({
			size: bufferSize,
			usage:
				GPUBufferUsage.STORAGE |
				GPUBufferUsage.COPY_DST |
				GPUBufferUsage.COPY_SRC,
			mappedAtCreation: true,
		});

		new Float32Array(storageBuffer.getMappedRange()).set(particles.raw());
		storageBuffer.unmap();

		const shaderCode = `
			struct Particle { pos: vec2<f32>, vel: vec2<f32> };
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
			compute: { module, entryPoint: "main" },
		});

		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: storageBuffer } }],
		});

		const encoder = device.createCommandEncoder();
		const pass = encoder.beginComputePass();
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.dispatchWorkgroups(particleCount);
		pass.end();

		const readBuffer = device.createBuffer({
			size: bufferSize,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
		encoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, bufferSize);
		device.queue.submit([encoder.finish()]);

		await readBuffer.mapAsync(GPUMapMode.READ);
		const result = new Float32Array(readBuffer.getMappedRange());

		expect(result[0]).toBe(1.0);
		expect(result[1]).toBe(1.0);
		expect(result[2]).toBe(1.0);
		expect(result[3]).toBe(1.0);

		readBuffer.unmap();
	});
});
