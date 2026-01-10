type ZodModule = typeof import("zod");

const specifier = typeof Deno !== "undefined" ? "npm:zod@3.22.4" : "zod";
const mod: ZodModule = await import(specifier);

export const z = mod.z;
