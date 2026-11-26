import type { BaseType } from 'arktype';
import {
	hasFormDataKeyWithPrefix,
	coerceFormNumber,
	isTrueFormValue,
	type ToFormInputFn,
	type Options,
} from './utils.js';

type ArkTypeNode = BaseType['internal'];

export default async function (): Promise<ToFormInputFn> {
	return (schema, formData, options) => {
		if (!isArkTypeSchema(schema)) return formData;
		let structure: ArkTypeNode | undefined = schema.internal;
		while (structure && getValue(structure, 'kind') === 'morph') {
			const inner = getValue(structure, 'inner');
			const input = getValue(inner, 'in');
			structure = isNode(input) ? input : undefined;
		}
		const nestedStructure = structure && getValue(structure, 'structure');
		if (isNode(nestedStructure)) structure = nestedStructure;
		return !structure || !hasObjectProperties(structure)
			? formData
			: convertObject(formData, structure, '', options);
	};
}

function isArkTypeSchema(schema: unknown): schema is BaseType {
	return typeof schema === 'function' && 'internal' in schema;
}

function isNode(value: unknown): value is ArkTypeNode {
	return (typeof value === 'object' || typeof value === 'function') && value !== null && 'kind' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function getValue(value: unknown, key: string): unknown {
	return isRecord(value) ? value[key] : undefined;
}

function convertObject(formData: FormData, node: ArkTypeNode, prefix = '', options: Options) {
	const result: Record<string, unknown> = {};
	const structure = getValue(node, 'structure');
	const properties = isNode(structure) ? structure : node;
	const propsByKey = getValue(properties, 'propsByKey');
	const required = getValue(node, 'required');
	const inner = getValue(node, 'inner');
	const innerRequired = getValue(inner, 'required');
	const entries: [string, ArkTypeNode, unknown][] = [];
	if (isRecord(propsByKey)) {
		for (const [key, property] of Object.entries(propsByKey)) {
			const value = getValue(property, 'value');
			if (isNode(value)) entries.push([key, value, property]);
		}
	} else {
		const requiredEntries = Array.isArray(required)
			? required
			: Array.isArray(innerRequired)
				? innerRequired
				: [];
		for (const entry of requiredEntries) {
			const key = getValue(entry, 'key');
			const value = getValue(entry, 'value');
			if (typeof key === 'string' && isNode(value)) entries.push([key, value, undefined]);
		}
	}
	for (const [key, childNode, property] of entries) {
		const name = prefix + key;
		const branches = getValue(childNode, 'branches');
		const sequence = getValue(childNode, 'sequence');
		if (
			getValue(childNode, 'kind') === 'union' &&
			Array.isArray(branches) &&
			branches.some((branch) => isNode(getValue(branch, 'structure')))
		) {
			const variant = formData.get(`${name}.type`);
			const branch = branches.find((option) => {
				const branchStructure = getValue(option, 'structure');
				const branchProps = getValue(branchStructure, 'propsByKey');
				const typeProperty = getValue(branchProps, 'type');
				const typeValue = getValue(typeProperty, 'value');
				return getValue(typeValue, 'unit') === variant;
			});
			result[key] = isNode(branch) ? convertObject(formData, branch, `${name}.`, options) : null;
		} else if (Array.isArray(sequence)) {
			result[key] = formData.getAll(name).map((value) => coerce(value, sequence[0], options));
		} else if (isArrayExpression(childNode)) {
			result[key] = formData.getAll(name).map((value) => coerce(value, childNode, options));
		} else if (isNode(getValue(childNode, 'structure')) || hasObjectProperties(childNode)) {
			const nestedPrefix = `${name}.`;
			const hasNestedKeys = hasFormDataKeyWithPrefix(formData.keys(), nestedPrefix);
			const nested = getValue(childNode, 'structure');
			const defaultValue = getValue(property, 'default');
			result[key] = hasNestedKeys && isNode(nested)
				? convertObject(formData, nested, nestedPrefix, options)
				: typeof defaultValue === 'function'
					? defaultValue()
					: {};
		} else if (matches(childNode, 'boolean')) {
			const value = formData.get(name);
			result[key] = isTrueFormValue(value)
				? true
				: value === 'false'
					? false
					: formData.has(name);
		} else if (matches(childNode, 'number')) {
			const value = formData.get(name);
			result[key] =
				value === null
					? getValue(childNode, 'default') ?? value
					: coerceFormNumber(value);
		} else {
			const value = formData.get(name);
			result[key] = options.convertEmptyStringsToNull && value === '' && matches(childNode, 'string')
				? null
				: value;
		}
	}
	return result;
}

function hasObjectProperties(node: ArkTypeNode) {
	const inner = getValue(node, 'inner');
	return Boolean(
		getValue(node, 'propsByKey') ||
			Array.isArray(getValue(node, 'required')) ||
			Array.isArray(getValue(inner, 'required')),
	);
}

function isArrayExpression(node: unknown) {
	const expression = getValue(node, 'expression');
	return typeof expression === 'string' && expression.endsWith('[]');
}

function matches(node: unknown, kind: string) {
	const expression = getValue(node, 'expression');
	return getValue(node, 'domain') === kind || expression === kind || (typeof expression === 'string' && expression.includes(kind));
}

function coerce(value: FormDataEntryValue, node: unknown, options: Options) {
	if (options.convertEmptyStringsToNull && value === '' && matches(node, 'string')) return null;
	if (matches(node, 'number')) return coerceFormNumber(value);
	if (matches(node, 'boolean')) {
		return isTrueFormValue(value);
	}
	return value;
}
