import { DynamicArray } from "./dynamic-array";

export class SerializedDynamicArray {
	private array: DynamicArray<Uint8ArrayConstructor>;
	private offsets: DynamicArray<Uint32ArrayConstructor>;
	private static readonly encoder = new TextEncoder();
	private static readonly decoder = new TextDecoder();

	constructor() {
		this.array = new DynamicArray<Uint8ArrayConstructor>(
			1,
			Infinity,
			Uint8Array,
		);
		this.offsets = new DynamicArray<Uint32ArrayConstructor>(
			1,
			Infinity,
			Uint32Array,
		);
	}

	pushObject(obj: object): void {
		const bytes = JSON.stringify(obj);
		this.offsets.push(this.array.length);
		this.array.push(SerializedDynamicArray.encoder.encode(bytes));
	}

	popObject(): object {
		if (this.offsets.isEmpty) {
			throw new RangeError("No objects to pop");
		}
		const offset = this.offsets.unsafePop();
		const bytes = this.array.raw().subarray(offset);
		const obj = JSON.parse(SerializedDynamicArray.decoder.decode(bytes));
		this.array.truncate(offset);
		return obj;
	}

	getObjectAt(index: number): object {
		if (index < 0 || index >= this.offsets.length) {
			throw new RangeError("Index out of bounds");
		}
		const offset = this.offsets.unsafeGet(index);
		if (offset >= this.array.length) {
			throw new RangeError("Offset is no longer valid - array was modified");
		}
		const nextOffset = index + 1 < this.offsets.length ? this.offsets.unsafeGet(index + 1) : this.array.length;

		const bytes = this.array.raw().subarray(offset, nextOffset);
		return JSON.parse(SerializedDynamicArray.decoder.decode(bytes));
	}

	length(): number {
		return this.offsets.length;
	}

	clear(): void {
		this.array.clear();
		this.offsets.clear();
	}
}
