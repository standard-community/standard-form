import * as z from 'zod/v4';
import { testVendorContract } from './vendor-contract.js';

testVendorContract('zod', {
	validSchema: z.object({
		name: z.string(),
		age: z.number(),
		newsletter: z.boolean(),
		address: z.object({ city: z.string() }),
	}),
	invalidSchema: z.object({ age: z.number() }),
	asyncSchema: z.object({ name: z.string().refine(async (value) => value === 'Ben') }),
	formDataSchema: z.instanceof(FormData),
});
