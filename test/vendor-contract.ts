import * as assert from 'node:assert/strict';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { describe, it } from 'vitest';
import { parseFormData } from '../dist/index.js';

export type VendorContract = {
	validSchema: StandardSchemaV1<unknown, { name: string; age: number; newsletter: boolean; address: { city: string } }>;
	invalidSchema: StandardSchemaV1<unknown, unknown>;
	asyncSchema: StandardSchemaV1<unknown, { name: string }>;
	formDataSchema: StandardSchemaV1<unknown, FormData>;
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
	});
}
