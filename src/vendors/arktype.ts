import type { BaseType } from 'arktype';
import type { ToFormInputFn } from './utils.js';

type ArkTypeNode = BaseType['internal'];

export default async function (): Promise<ToFormInputFn> {
	return (schema, formData) => {
		if (!isArkTypeSchema(schema)) return formData;
		let structure: ArkTypeNode | undefined = schema.internal;
		while (structure && getValue(structure, 'kind') === 'morph') {
			const inner = getValue(structure, 'inner');
			const input = getValue(inner, 'in');
			structure = isNode(input) ? input : undefined;
		}
		const nestedStructure = structure && getValue(structure, 'structure');
		if (isNode(nestedStructure)) structure = nestedStructure;
		if (!structure || !hasObjectProperties(structure)) return formData;
		return convertObject(formData, structure);
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

function convertObject(formData: FormData, node: ArkTypeNode, prefix = '') {
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
			result[key] = isNode(branch) ? convertObject(formData, branch, `${name}.`) : null;
		} else if (Array.isArray(sequence)) {
			result[key] = formData.getAll(name).map((value) => coerce(value, sequence[0]));
		} else if (isArrayExpression(childNode)) {
			result[key] = formData.getAll(name).map((value) => coerce(value, childNode));
		} else if (isNode(getValue(childNode, 'structure')) || hasObjectProperties(childNode)) {
			const nestedPrefix = `${name}.`;
			const hasNestedKeys = [...formData.keys()].some((formKey) => formKey.startsWith(nestedPrefix));
			const nested = getValue(childNode, 'structure');
			const defaultValue = getValue(property, 'default');
			result[key] = hasNestedKeys && isNode(nested)
				? convertObject(formData, nested, nestedPrefix)
				: typeof defaultValue === 'function'
					? defaultValue()
					: {};
		} else if (matches(childNode, 'boolean')) {
			const value = formData.get(name);
			result[key] = value === 'true' ? true : value === 'false' ? false : formData.has(name);
		} else if (matches(childNode, 'number')) {
			const value = formData.get(name);
			result[key] = value === null ? getValue(childNode, 'default') ?? value : value === '' ? value : Number(value);
		} else {
			result[key] = formData.get(name);
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

function coerce(value: FormDataEntryValue, node: unknown) {
	if (matches(node, 'number')) return Number(value);
	if (matches(node, 'boolean')) return value === 'true';
	return value;
}
