import { type ToFormInputFn, UnsupportedSchemaError } from './utils.js';

type RecordValue = Record<string, unknown>;

export default async function (): Promise<ToFormInputFn> {
	return (schema, formData) => {
		if (!isSchema(schema)) {
			throw new UnsupportedSchemaError('zod', 'Zod 4 and higher is required');
		}
		const objectSchema = getObjectSchema(schema, formData);
		return objectSchema ? convertObject(formData, objectSchema) : formData;
	};
}

function isRecord(value: unknown): value is RecordValue {
	return typeof value === 'object' && value !== null;
}

function get(value: unknown, key: string): unknown {
	return isRecord(value) ? value[key] : undefined;
}

function definition(schema: unknown): RecordValue | undefined {
	const internal = get(schema, '_zod');
	const def = get(internal, 'def');
	return isRecord(def) ? def : undefined;
}

function isSchema(value: unknown): boolean {
	return typeof get(definition(value), 'type') === 'string';
}

function schemaType(schema: unknown): string | undefined {
	const type = get(definition(schema), 'type');
	return typeof type === 'string' ? type : undefined;
}

function unwrap(schema: unknown): unknown {
	while (true) {
		const kind = schemaType(schema);
		const def = definition(schema);
		if (!def) return schema;
		if (kind === 'optional' || kind === 'nullable' || kind === 'default') {
			schema = def.innerType;
		} else if (kind === 'pipe') {
			schema = def.in;
		} else {
			return schema;
		}
	}
}

function isDiscriminatedUnion(schema: unknown): boolean {
	return schemaType(schema) === 'union' && typeof get(definition(schema), 'discriminator') === 'string';
}

function objectShape(schema: unknown): RecordValue | undefined {
	const shape = get(definition(schema), 'shape');
	return isRecord(shape) ? shape : undefined;
}

function getObjectSchema(schema: unknown, formData: FormData): unknown {
	const base = unwrap(schema);
	if (schemaType(base) === 'object') return base;
	if (!isDiscriminatedUnion(base)) return;
	const def = definition(base);
	if (!def) return;
	const discriminator = def.discriminator;
	if (typeof discriminator !== 'string') return;
	const value = formData.get(discriminator);
	if (typeof value !== 'string' || !Array.isArray(def.options)) return;
	return def.options.find((option) => {
		const literal = objectShape(option)?.[discriminator];
		return schemaType(literal) === 'literal' && containsLiteral(literal, value);
	});
}

function convertObject(formData: FormData, schema: unknown, prefix = '') {
	const result: Record<string, unknown> = {};
	const keys = [...formData.keys()];
	const def = definition(schema);
	const shape = objectShape(schema);
	if (!def || !shape) return result;
	if (def.catchall) {
		for (const [key, value] of formData.entries()) {
			if (key.startsWith(prefix)) result[key.slice(prefix.length)] = value;
		}
	}
	for (const [key, original] of Object.entries(shape)) {
		const name = prefix + key;
		let child = original;
		let defaultValue: unknown;
		while (isSchema(child)) {
			const kind = schemaType(child);
			const childDef = definition(child);
			if (!childDef) break;
			if (kind === 'default') {
				const value = childDef.defaultValue;
				defaultValue = typeof value === 'function' ? value() : value;
				child = childDef.innerType;
			} else if (kind === 'optional' || kind === 'nullable' || kind === 'pipe') {
				child = childDef.innerType ?? childDef.in;
			} else {
				break;
			}
		}
		if (defaultValue !== undefined && !hasKeyOrChild(keys, name)) result[key] = defaultValue;
		if (schemaType(child) === 'object') {
			const nestedPrefix = `${name}.`;
			if (keys.some((formKey) => formKey.startsWith(nestedPrefix))) {
				result[key] = convertObject(formData, child, nestedPrefix);
			} else if (!(key in result)) {
				result[key] = schemaType(original) === 'nullable' ? null : undefined;
			}
		} else if (isDiscriminatedUnion(child)) {
			const union = definition(child);
			const discriminator = union?.discriminator;
			const value = typeof discriminator === 'string'
				? formData.get(`${name}.${discriminator}`)
				: null;
			const options = union?.options;
			const variant = Array.isArray(options) && typeof discriminator === 'string'
				? options.find((option) => {
						const literal = objectShape(option)?.[discriminator];
						return schemaType(literal) === 'literal' && containsLiteral(literal, value);
					})
				: undefined;
			result[key] = variant ? convertObject(formData, variant, `${name}.`) : null;
		} else if (schemaType(child) === 'boolean') {
			const value = formData.get(name);
			result[key] = value === 'true' ? true : value === 'false' ? false : formData.has(name);
		} else if (schemaType(child) === 'array') {
			const element = get(definition(child), 'element');
			result[key] = formData.getAll(name).map((value) => convertValue(value, element));
		} else if (!(defaultValue !== undefined && !formData.has(name))) {
			const value = formData.get(name);
			result[key] = value === null
				? schemaType(original) === 'optional' ? undefined : null
				: convertValue(value, child);
		}
	}
	return result;
}

function hasKeyOrChild(keys: string[], name: string) {
	return keys.some((key) => key === name || key.startsWith(`${name}.`));
}

function containsLiteral(schema: unknown, value: unknown) {
	const values = get(definition(schema), 'values');
	return Array.isArray(values)
		? values.includes(value)
		: values instanceof Set && values.has(value);
}

function convertValue(value: FormDataEntryValue, schema: unknown) {
	if (schemaType(schema) === 'number') return value === '' ? value : Number(value);
	if (schemaType(schema) === 'boolean') return value === 'true';
	return value;
}
