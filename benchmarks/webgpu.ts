import { bench, group } from "mitata";
import { DynamicArray } from "../index";
import NumArray from "typed-numarray";
// @ts-ignore
import { setupGlobals } from "bun-webgpu";

// Polyfill globals
setupGlobals();

// Initialize WebGPU resources once
let device: GPUDevice;
let pipeline: GPUComputePipeline;
let bindGroupLayout: GPUBindGroupLayout;

const WORKGROUP_SIZE = 64;

async function initWebGPU() {
	if (!navigator.gpu) throw new Error("WebGPU not supported");
	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) throw new Error("No WebGPU adapter found");
	device = await adapter.requestDevice();

	const shaderCode = `
        @group(0) @binding(0) var<storage, read_write> data : array<f32>;

        @compute @workgroup_size(${WORKGROUP_SIZE})
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            let index = global_id.x;
            if (index < arrayLength(&data)) {
                data[index] = data[index] * 2.0;
            }
        }
    `;

	const shaderModule = device.createShaderModule({ code: shaderCode });
	pipeline = device.createComputePipeline({
		layout: "auto",
		compute: {
			module: shaderModule,
			entryPoint: "main",
		},
	});
	bindGroupLayout = pipeline.getBindGroupLayout(0);
}

// Setup data sizes
const SIZES = [1_000, 100_000, 1_000_000];

// Prepare benchmarks
await initWebGPU();

group("WebGPU Compute: Upload (CPU -> GPU)", () => {
	for (const size of SIZES) {
		const da = new DynamicArray(size, size, Float32Array);
		for (let i = 0; i < size; i++) da.push(Math.random());
        const rawData = da.raw();
        const byteLength = rawData.byteLength;

		// Create a mapped buffer to simulate "upload" overhead cleanly
		// (In real apps, you might use queue.writeBuffer, but mappedAtCreation is often used for initial data)
		// actually queue.writeBuffer is more representative of "uploading" to an existing storage buffer.
        // Let's measure queue.writeBuffer to a private storage buffer.

        const storageBuffer = device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });

		bench(`writeBuffer ${size} floats`, async () => {
			device.queue.writeBuffer(storageBuffer, 0, rawData);
			await device.queue.onSubmittedWorkDone();
		});
	}
});

group("Compute: Execution (WebGPU vs CPU)", () => {
	for (const size of SIZES) {
        const byteLength = size * 4;
		const storageBuffer = device.createBuffer({
			size: byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});

        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{ binding: 0, resource: { buffer: storageBuffer } }]
        });

		bench(`WebGPU dispatch ${size}`, async () => {
			const commandEncoder = device.createCommandEncoder();
			const passEncoder = commandEncoder.beginComputePass();
			passEncoder.setPipeline(pipeline);
			passEncoder.setBindGroup(0, bindGroup);
			passEncoder.dispatchWorkgroups(Math.ceil(size / WORKGROUP_SIZE));
			passEncoder.end();
			device.queue.submit([commandEncoder.finish()]);
			
            // Ensure GPU is done
            await device.queue.onSubmittedWorkDone();
		});

        // Float32Array Baseline
        const cpuArr = new Float32Array(size).fill(1);
        bench(`Float32Array Loop ${size}`, () => {
             for(let i=0; i<size; i++) {
                 cpuArr[i] *= 2;
             }
        });

        // Plain JS Array Baseline
        const jsArr = new Array(size);
        for(let i=0; i<size; i++) jsArr[i] = 1;
        bench(`Plain JS Array Loop ${size}`, () => {
            for(let i=0; i<size; i++) {
                jsArr[i] = jsArr[i] * 2;
            }
        });

        // NumArray Baseline
        const numArr = NumArray("float32", size);
        for(let i=0; i<size; i++) numArr.set(i, 1);
        bench(`NumArray Loop ${size}`, () => {
             for(let i=0; i<size; i++) {
                 numArr.set(i, numArr.at(i) * 2);
             }
        });
	}
});

group("WebGPU Compute: Readback (GPU -> CPU)", () => {
    for (const size of SIZES) {
        const byteLength = size * 4;
        // Source buffer (on GPU)
        const storageBuffer = device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, // COPY_SRC needed to copy TO read buffer
        });

        // Destination buffer (for reading)
        const readBuffer = device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });

        bench(`mapAsync/read ${size} floats`, async () => {
            // 1. Copy storage -> read buffer
            const commandEncoder = device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, byteLength);
            device.queue.submit([commandEncoder.finish()]);

            // 2. Map
            await readBuffer.mapAsync(GPUMapMode.READ);
            
            // 3. Read (simulate getting data out)
            const range = readBuffer.getMappedRange();
            // In a real app we might copy this out, but access is enough to verify availability
            // const view = new Float32Array(range); 
            
            // 4. Unmap for next run
            readBuffer.unmap();
        });
    }
});

group("Compute: End-to-End (WebGPU vs CPU)", () => {
    for (const size of SIZES) {
        const da = new DynamicArray(size, size, Float32Array);
        for(let i=0; i<size; i++) da.push(1);
        const inputData = da.raw();
        const byteLength = inputData.byteLength;

        // We'll reuse buffers to avoid allocation noise, focusing on data moving/compute
        const storageBuffer = device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
        const readBuffer = device.createBuffer({
            size: byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        const bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{ binding: 0, resource: { buffer: storageBuffer } }]
        });

        bench(`WebGPU E2E ${size}`, async () => {
            // 1. Upload
            device.queue.writeBuffer(storageBuffer, 0, inputData);

            // 2. Compute
            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(Math.ceil(size / WORKGROUP_SIZE));
            passEncoder.end();

            // 3. Copy to Read Buffer
            commandEncoder.copyBufferToBuffer(storageBuffer, 0, readBuffer, 0, byteLength);
            device.queue.submit([commandEncoder.finish()]);

            // 4. Readback
            await readBuffer.mapAsync(GPUMapMode.READ);
            const range = readBuffer.getMappedRange();
            // const result = new Float32Array(range);
            readBuffer.unmap();
        });

        // Float32Array E2E (same as execution for CPU)
        const cpuArr = new Float32Array(size).fill(1);
        bench(`Float32Array E2E ${size}`, () => {
             for(let i=0; i<size; i++) {
                 cpuArr[i] *= 2;
             }
        });

        // Plain JS Array E2E (Convert -> Compute)
        bench(`Plain JS Array E2E ${size}`, () => {
            // 1. Convert (Upload equivalent)
            const arr = new Array(size);
            for(let i=0; i<size; i++) arr[i] = inputData[i];
            
            // 2. Compute
            for(let i=0; i<size; i++) arr[i] = arr[i] * 2;
        });

         // NumArray E2E
        const numArr = NumArray("float32", size);
        for(let i=0; i<size; i++) numArr.set(i, 1);
        bench(`NumArray E2E ${size}`, () => {
             for(let i=0; i<size; i++) {
                 numArr.set(i, numArr.at(i) * 2);
             }
        });
    }
});
