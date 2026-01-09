import { bench, do_not_optimize, group } from "mitata";
import { SerializedDynamicArray } from "../index";

// Test Data Generators
const createSmallObject = (i: number) => ({
	id: i,
	x: Math.random(),
	y: Math.random(),
	active: true,
});

const createLargeObject = (i: number) => ({
	id: i,
	name: `User ${i} with a somewhat long name to take up space`,
	tags: ["admin", "editor", "contributor", "viewer"],
	meta: {
		created: Date.now(),
		updated: Date.now(),
		nested: {
			a: [1, 2, 3, 4, 5],
			b: "Some more string data here to inflate the size",
		},
	},
	description: "x".repeat(256), // ~256 bytes of string data
});

group("Serialization: Write (pushObject)", () => {
	const COUNTS = [100, 1000, 10000];

	for (const count of COUNTS) {
		bench(`SerializedDynamicArray.pushObject (Small) x${count}`, () => {
			const sda = new SerializedDynamicArray();
			for (let i = 0; i < count; i++) {
				sda.pushObject(createSmallObject(i));
			}
			return do_not_optimize(sda);
		});

		bench(`Native Array.push (Small Object) x${count}`, () => {
			const arr = [];
			for (let i = 0; i < count; i++) {
				arr.push(createSmallObject(i));
			}
			return do_not_optimize(arr);
		});
        
        bench(`Native Array.push (JSON String) x${count}`, () => {
			const arr = [];
			for (let i = 0; i < count; i++) {
				arr.push(JSON.stringify(createSmallObject(i)));
			}
			return do_not_optimize(arr);
		});
	}

    // Large objects test (Fixed count to avoid timeout/excessive memory in bench)
    const largeCount = 1000;
    bench(`SerializedDynamicArray.pushObject (Large) x${largeCount}`, () => {
        const sda = new SerializedDynamicArray();
        for (let i = 0; i < largeCount; i++) {
            sda.pushObject(createLargeObject(i));
        }
        return do_not_optimize(sda);
    });

    bench(`Native Array.push (Large Object) x${largeCount}`, () => {
        const arr = [];
        for (let i = 0; i < largeCount; i++) {
            arr.push(createLargeObject(i));
        }
        return do_not_optimize(arr);
    });
});

group("Serialization: Read (getObjectAt / Random Access)", () => {
    const count = 1000;
    const sdaSmall = new SerializedDynamicArray();
    const arrSmall: any[] = [];
    
    for(let i=0; i<count; i++) {
        const obj = createSmallObject(i);
        sdaSmall.pushObject(obj);
        arrSmall.push(obj);
    }

    const sdaLarge = new SerializedDynamicArray();
    const arrLarge: any[] = [];
    
    for(let i=0; i<count; i++) {
        const obj = createLargeObject(i);
        sdaLarge.pushObject(obj);
        arrLarge.push(obj);
    }
    
    // Random indices
    const indices = Array.from({ length: 100 }, () => Math.floor(Math.random() * count));

    bench("SerializedDynamicArray.getObjectAt (Small)", () => {
        for(const idx of indices) {
            do_not_optimize(sdaSmall.getObjectAt(idx));
        }
    });

    bench("Native Array[i] (Small - Reference)", () => {
        for(const idx of indices) {
            do_not_optimize(arrSmall[idx]);
        }
    });

    bench("SerializedDynamicArray.getObjectAt (Large)", () => {
        for(const idx of indices) {
            do_not_optimize(sdaLarge.getObjectAt(idx));
        }
    });
});

group("Serialization: Sequential Read (popObject)", () => {
    const count = 1000;
    
    bench("SerializedDynamicArray.popObject (Small) x1000", () => {
        const sda = new SerializedDynamicArray();
        for(let i=0; i<count; i++) sda.pushObject(createSmallObject(i));
        
        for(let i=0; i<count; i++) {
            do_not_optimize(sda.popObject());
        }
    });

    bench("Native Array.pop (Small) x1000", () => {
        const arr: any[] = [];
        for(let i=0; i<count; i++) arr.push(createSmallObject(i));
        
        for(let i=0; i<count; i++) {
            do_not_optimize(arr.pop());
        }
    });
});
