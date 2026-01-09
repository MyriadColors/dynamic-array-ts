import { run } from "mitata";

// Import all benchmark suites to register them
await import("./mutations");
await import("./access");
await import("./buffer");
await import("./transform");
await import("./usecases");
await import("./scenarios");
await import("./iteration");
await import("./serialization");
// Run all registered benchmarks
await run();
