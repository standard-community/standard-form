import { type } from 'arktype';
import { testVendorContract } from './vendor-contract.js';

testVendorContract('arktype', {
	validSchema: type({
		name: 'string',
		age: 'number',
		newsletter: 'boolean',
		address: { city: 'string' },
	}),
	invalidSchema: type({ age: 'number' }),
	// ArkType does not support async morphs: https://arktype.io/docs/faq#is-there-a-way-to-create-an-async-morph
	asyncSchema: null,
	formDataSchema: type.instanceOf(FormData),
	booleanArraySchema: type({ flags: type('boolean[]') }),
	nestedSchema: type({
		settings: type({ theme: 'string' }).default(() => ({ theme: 'dark' })),
	}),
	discriminatedUnionSchema: type({
		contact: type({ type: "'email'", email: 'string' }).or({
			type: "'phone'",
			phone: 'string',
		}),
	}),
	passthroughSchema: type({ expected: 'number', unexpected: 'string' }),
});
