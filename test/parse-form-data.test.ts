import * as assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { loadVendor, parseFormData, UnsupportedVendorError } from '../dist/index.js';

describe('parseFormData', () => {
	it('throws for a validator without an adapter', async () => {
		const schema: StandardSchemaV1<unknown, unknown> = {
			'~standard': {
				version: 1,
				vendor: 'not-a-real-validator',
				validate: (value) => ({ value }),
			},
		};

		await assert.rejects(() => parseFormData(schema, new FormData()), UnsupportedVendorError);
	});

	it('uses a registered vendor', async () => {
		const formData = new FormData();
		formData.set('name', 'Ben');

		loadVendor('custom', (_schema, data) => Object.fromEntries(data.entries()));

		const schema: StandardSchemaV1<unknown, unknown> = {
			'~standard': {
				version: 1,
				vendor: 'custom',
				validate: (value) => ({ value }),
			},
		};

		const result = await parseFormData(schema, formData);

		assert.equal(result.issues, undefined);
		assert.deepEqual(result.value, { name: 'Ben' });
	});
});
