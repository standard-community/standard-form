import type * as v from 'valibot';
import {
	hasFormDataKeyWithPrefix,
	coerceFormNumber,
	isTrueFormValue,
	type ToFormInputFn,
	type Options,
} from './utils.js';

type AnySchema = v.GenericSchema | v.GenericSchemaAsync;
type AnyObjectSchema =
	| v.ObjectSchema<any, any>
	| v.ObjectSchemaAsync<any, any>
	| v.ObjectWithRestSchema<any, any, any>
	| v.ObjectWithRestSchemaAsync<any, any, any>;

export default async function (): Promise<ToFormInputFn> {
	return (schema, formData, options) => {
		if (!isValibotSchema(schema)) return formData;
		return isObjectSchema(schema)
			? convertObject(formData, schema, '', options)
			: formData;
	};
}

function isValibotSchema(schema: unknown): schema is AnySchema {
	return typeof schema === 'object' && schema !== null && '~standard' in schema;
}

function isObjectSchema(schema: AnySchema): schema is AnyObjectSchema {
	return (
		schema.type === 'object' ||
		schema.type === 'object_with_rest' ||
		schema.type === 'loose_object' ||
		schema.type === 'strict_object'
	);
}

function isSchema(schema: unknown): schema is AnySchema {
	return typeof schema === 'object' && schema !== null && 'kind' in schema && 'type' in schema;
}

function isArraySchema(
	schema: AnySchema,
): schema is v.ArraySchema<any, any> | v.ArraySchemaAsync<any, any> {
	return schema.type === 'array';
}

function isVariantSchema(
	schema: AnySchema,
): schema is v.VariantSchema<any, any, any> | v.VariantSchemaAsync<any, any, any> {
	return schema.type === 'variant';
}

function isLiteralSchema(schema: AnySchema): schema is v.LiteralSchema<any, any> {
	return schema.type === 'literal';
}

function convertObject(formData: FormData, schema: AnyObjectSchema, prefix = '', options: Options) {
	const result: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(schema.entries)) {
		const name = prefix + key;
		if (!isSchema(child)) continue;
		const base = unwrap(child);
		if (isObjectSchema(base)) {
			const nested = convertObject(formData, base, `${name}.`, options);
			const hasNestedKeys = hasFormDataKeyWithPrefix(formData.keys(), `${name}.`);
			result[key] = hasNestedKeys ? nested : getDefault(child) ?? nested;
		} else if (base.type === 'boolean') {
			const value = formData.get(name);
			result[key] = isTrueFormValue(value)
				? true
				: value === 'false'
					? false
					: formData.has(name);
		} else if (base.type === 'number') {
			const value = formData.get(name);
			result[key] = coerceFormNumber(value);
		} else if (base.type === 'array') {
			if (!isArraySchema(base)) continue;
			result[key] = formData.getAll(name).map((value) => convertValue(value, base.item, options));
		} else if (base.type === 'variant') {
			if (!isVariantSchema(base)) continue;
			const variant = base;
			const discriminator = formData.get(`${name}.${variant.key}`);
			const option = variant.options.find((candidate: AnySchema) => {
				if (!isObjectSchema(candidate)) return false;
				const discriminatorSchema = candidate.entries[variant.key];
				return isSchema(discriminatorSchema) &&
					isLiteralSchema(discriminatorSchema) &&
					discriminatorSchema.literal === discriminator;
			});
			result[key] = option && isObjectSchema(option)
				? convertObject(formData, option, `${name}.`, options)
				: null;
		} else {
			result[key] = convertValue(formData.get(name), base, options);
		}
	}
	if (schema.type === 'object_with_rest') {
		formData.forEach((value, key) => {
			if (key.startsWith(prefix) && !(key.slice(prefix.length) in result)) {
				result[key.slice(prefix.length)] = value;
			}
		});
	}
	return result;
}

function unwrap(schema: AnySchema): AnySchema {
	if ('wrapped' in schema && isSchema(schema.wrapped)) return unwrap(schema.wrapped);
	if ('pipe' in schema) {
		const pipe: unknown = schema.pipe;
		if (Array.isArray(pipe) && isSchema(pipe[0])) return unwrap(pipe[0]);
	}
	return schema;
}

function getDefault(schema: AnySchema) {
	return 'default' in schema ? schema.default : undefined;
}

function convertValue(value: FormDataEntryValue | null, schema: AnySchema, options: Options) {
	const base = unwrap(schema);
	if (options.convertEmptyStringsToNull && value === '' && base.type === 'string') return null;
	if (value === null) return getDefault(schema) ?? null;
	if (base.type === 'number') return coerceFormNumber(value);
	if (base.type === 'boolean') {
		return isTrueFormValue(value)
			? true
			: value === 'false'
				? false
				: Boolean(value);
	}
	return value;
}
