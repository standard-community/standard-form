import * as assert from 'node:assert/strict';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { describe, it } from 'vitest';
import { parseFormData } from '../dist/index.js';

export type VendorContract = {
	validSchema: StandardSchemaV1<unknown, { name: string; age: number; newsletter: boolean; address: { city: string } }>;
	invalidSchema: StandardSchemaV1<unknown, unknown>;
	asyncSchema: StandardSchemaV1<unknown, { name: string }>;
	formDataSchema: StandardSchemaV1<unknown, FormData>;
	booleanArraySchema: StandardSchemaV1<unknown, { flags: boolean[] }>;
	nestedSchema: StandardSchemaV1<unknown, { settings: { theme: string } }>;
	discriminatedUnionSchema: StandardSchemaV1<
		unknown,
		{ contact: { type: 'email'; email: string } | { type: 'phone'; phone: string } }
	>;
	passthroughSchema: StandardSchemaV1<unknown, { expected: number; [key: string]: unknown }>;
};

export function testVendorContract(name: string, schemas: VendorContract) {
	describe(`${name} vendor contract`, () => {
		it('coerces and validates form data', async () => {
			const formData = new FormData();
			formData.set('name', 'Ben');
			formData.set('age', '25');
			formData.set('newsletter', 'true');
			formData.set('address.city', 'Paris');

			const result = await parseFormData(schemas.validSchema, formData);

			assert.equal(result.issues, undefined);
			assert.deepEqual(result.value, {
				name: 'Ben',
				age: 25,
				newsletter: true,
				address: { city: 'Paris' },
			});
		});

		it('returns standard schema issues when validation fails', async () => {
			const formData = new FormData();
			formData.set('age', 'not-a-number');

			const result = await parseFormData(schemas.invalidSchema, formData);

			assert.ok(result.issues);
			assert.equal(result.issues.length, 1);
			assert.deepEqual(
				result.issues[0].path?.map((segment) =>
					typeof segment === 'object' ? segment.key : segment,
				),
				['age'],
			);
		});

		it('awaits async validation', async () => {
			const formData = new FormData();
			formData.set('name', 'Ben');

			const result = await parseFormData(schemas.asyncSchema, formData);

			assert.equal(result.issues, undefined);
			assert.deepEqual(result.value, { name: 'Ben' });
		});

		it('passes FormData through when the schema is not an object', async () => {
			const formData = new FormData();
			formData.set('name', 'Ben');

			const result = await parseFormData(schemas.formDataSchema, formData);

			assert.equal(result.issues, undefined);
			assert.equal(result.value, formData);
		});

		it('coerces boolean arrays without losing false values', async () => {
			const formData = new FormData();
			formData.append('flags', 'false');
			formData.append('flags', 'true');
			formData.append('flags', 'false');

			const result = await parseFormData(schemas.booleanArraySchema, formData);

			assert.equal(result.issues, undefined);
			assert.deepEqual(result.value, { flags: [false, true, false] });
		});

		it('coerces nested objects when keys are present and uses defaults when absent', async () => {
			const withNestedKeys = new FormData();
			withNestedKeys.set('settings.theme', 'light');

			const parsedNested = await parseFormData(schemas.nestedSchema, withNestedKeys);
			assert.equal(parsedNested.issues, undefined);
			assert.deepEqual(parsedNested.value, { settings: { theme: 'light' } });

			const withoutNestedKeys = new FormData();
			const parsedDefault = await parseFormData(schemas.nestedSchema, withoutNestedKeys);
			assert.equal(parsedDefault.issues, undefined);
			assert.deepEqual(parsedDefault.value, { settings: { theme: 'dark' } });
		});

		it('coerces the matching nested discriminated union variant', async () => {
			const formData = new FormData();
			formData.set('contact.type', 'phone');
			formData.set('contact.phone', '555-1234');

			const result = await parseFormData(schemas.discriminatedUnionSchema, formData);

			assert.equal(result.issues, undefined);
			assert.deepEqual(result.value, { contact: { type: 'phone', phone: '555-1234' } });
		});

		it('preserves unknown fields when the object schema allows passthrough', async () => {
			const formData = new FormData();
			formData.set('expected', '42');
			formData.set('unexpected', 'extra');

			const result = await parseFormData(schemas.passthroughSchema, formData);

			assert.equal(result.issues, undefined);
			assert.deepEqual(result.value, { expected: 42, unexpected: 'extra' });
		});
	});
}
