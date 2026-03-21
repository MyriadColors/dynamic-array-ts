type TypedArrayConstructor =
	| Uint8ArrayConstructor
	| Uint8ClampedArrayConstructor
	| Uint16ArrayConstructor
	| Uint32ArrayConstructor
	| Int8ArrayConstructor
	| Int16ArrayConstructor
	| Int32ArrayConstructor
	| Float32ArrayConstructor
	| Float64ArrayConstructor
	| BigUint64ArrayConstructor
	| BigInt64ArrayConstructor;

type TypedArrayInstanceMapLookup = {
	Uint8ArrayConstructor: Uint8Array;
	Uint8ClampedArrayConstructor: Uint8ClampedArray;
	Uint16ArrayConstructor: Uint16Array;
	Uint32ArrayConstructor: Uint32Array;
	Int8ArrayConstructor: Int8Array;
	Int16ArrayConstructor: Int16Array;
	Int32ArrayConstructor: Int32Array;
	Float32ArrayConstructor: Float32Array;
	Float64ArrayConstructor: Float64Array;
	BigUint64ArrayConstructor: BigUint64Array;
	BigInt64ArrayConstructor: BigInt64Array;
};

type TypedArrayInstance<T extends TypedArrayConstructor> =
	T extends Uint8ArrayConstructor
		? Uint8Array
		: T extends Uint8ClampedArrayConstructor
			? Uint8ClampedArray
			: T extends Uint16ArrayConstructor
				? Uint16Array
				: T extends Uint32ArrayConstructor
					? Uint32Array
					: T extends Int8ArrayConstructor
						? Int8Array
						: T extends Int16ArrayConstructor
							? Int16Array
							: T extends Int32ArrayConstructor
								? Int32Array
								: T extends Float32ArrayConstructor
									? Float32Array
									: T extends Float64ArrayConstructor
										? Float64Array
										: T extends BigUint64ArrayConstructor
											? BigUint64Array
											: T extends BigInt64ArrayConstructor
												? BigInt64Array
												: never;

type ElementType<T extends TypedArrayConstructor> = T extends
	| BigUint64ArrayConstructor
	| BigInt64ArrayConstructor
	? bigint
	: number;

export type { TypedArrayConstructor, TypedArrayInstance, ElementType };
