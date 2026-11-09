import type {
	ElementType,
	TypedArrayConstructor,
	TypedArrayInstance,
} from "./types";

export declare const OwnerBrand: unique symbol;
declare const BorrowScope: unique symbol;
declare const BorrowedBufferBrand: unique symbol;

type Invariant<Scope> = (scope: Scope) => Scope;

interface Scoped<Scope> {
	readonly [BorrowScope]: Invariant<Scope>;
}

export interface ReadonlyTypedArray<T extends TypedArrayConstructor>
	extends ArrayBufferView {
	readonly [index: number]: ElementType<T>;
	readonly buffer: ArrayBufferLike;
	readonly byteLength: number;
	readonly byteOffset: number;
	readonly length: number;

	slice(begin?: number, end?: number): ReadonlyTypedArray<T>;
	subarray(begin?: number, end?: number): ReadonlyTypedArray<T>;
	indexOf(searchElement: ElementType<T>, fromIndex?: number): number;
	includes(searchElement: ElementType<T>, fromIndex?: number): boolean;
	forEach(
		callback: (value: ElementType<T>, index: number, array: this) => void,
		thisArg?: unknown,
	): void;
	map(
		callback: (
			value: ElementType<T>,
			index: number,
			array: this,
		) => ElementType<T>,
		thisArg?: unknown,
	): ReadonlyTypedArray<T>;
	filter(
		callback: (value: ElementType<T>, index: number, array: this) => unknown,
		thisArg?: unknown,
	): ReadonlyTypedArray<T>;
	reduce(
		callback: (
			previousValue: ElementType<T>,
			currentValue: ElementType<T>,
			currentIndex: number,
			array: this,
		) => ElementType<T>,
	): ElementType<T>;
	reduce<U>(
		callback: (
			previousValue: U,
			currentValue: ElementType<T>,
			currentIndex: number,
			array: this,
		) => U,
		initialValue: U,
	): U;
	every(
		callback: (value: ElementType<T>, index: number, array: this) => unknown,
		thisArg?: unknown,
	): boolean;
	some(
		callback: (value: ElementType<T>, index: number, array: this) => unknown,
		thisArg?: unknown,
	): boolean;
	find(
		callback: (value: ElementType<T>, index: number, array: this) => unknown,
		thisArg?: unknown,
	): ElementType<T> | undefined;
	findIndex(
		callback: (value: ElementType<T>, index: number, array: this) => unknown,
		thisArg?: unknown,
	): number;
	join(separator?: string): string;
	entries(): IterableIterator<[number, ElementType<T>]>;
	keys(): IterableIterator<number>;
	values(): IterableIterator<ElementType<T>>;
	[Symbol.iterator](): IterableIterator<ElementType<T>>;
}

export interface BorrowedBuffer {
	readonly [BorrowedBufferBrand]: true;
	readonly byteLength: number;
	readonly maxByteLength: number;
	readonly resizable: boolean;
	slice(begin?: number, end?: number): ArrayBuffer;
}

export type ScopedMutableView<
	T extends TypedArrayConstructor,
	Scope,
> = TypedArrayInstance<T> & Scoped<Scope>;

export type ScopedReadonlyView<
	T extends TypedArrayConstructor,
	Scope,
> = ReadonlyTypedArray<T> & Scoped<Scope>;

export type ScopedBorrowedBuffer<Scope> = BorrowedBuffer & Scoped<Scope>;

export type { TypedArrayConstructor, TypedArrayInstance };
