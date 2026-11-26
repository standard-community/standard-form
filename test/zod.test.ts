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
	booleanArraySchema: z.object({ flags: z.array(z.boolean()) }),
	nestedSchema: z.object({
		settings: z.object({ theme: z.string() }).default({ theme: 'dark' }),
	}),
	discriminatedUnionSchema: z.object({
		contact: z.discriminatedUnion('type', [
			z.object({ type: z.literal('email'), email: z.string() }),
			z.object({ type: z.literal('phone'), phone: z.string() }),
		]),
	}),
	passthroughSchema: z.object({ expected: z.number() }).passthrough(),
});
