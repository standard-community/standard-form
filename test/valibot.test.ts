import * as v from 'valibot';
import { testVendorContract } from './vendor-contract.js';

testVendorContract('valibot', {
	validSchema: v.object({
		name: v.string(),
		age: v.number(),
		newsletter: v.boolean(),
		address: v.object({ city: v.string() }),
	}),
	invalidSchema: v.object({ age: v.number() }),
	asyncSchema: v.objectAsync({
		name: v.pipeAsync(v.string(), v.checkAsync(async (value) => value === 'Ben')),
	}),
	formDataSchema: v.instance(FormData),
	booleanArraySchema: v.object({ flags: v.array(v.boolean()) }),
	checkboxSchema: v.object({ checked: v.boolean(), unchecked: v.boolean() }),
	nullableStringSchema: v.object({
		value: v.nullable(v.string()),
		nested: v.object({ value: v.nullable(v.string()) }),
	}),
	nestedSchema: v.object({
		settings: v.optional(v.object({ theme: v.string() }), { theme: 'dark' }),
	}),
	discriminatedUnionSchema: v.object({
		contact: v.variant('type', [
			v.object({ type: v.literal('email'), email: v.string() }),
			v.object({ type: v.literal('phone'), phone: v.string() }),
		]),
	}),
	passthroughSchema: v.objectWithRest(
		{ expected: v.number() },
		v.unknown(),
	),
});
