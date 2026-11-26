/**
 * Turns `formData` into a value the validator's schema can validate.
 *
 * The Standard Schema spec covers validation, but not introspection: there is no
 * portable way to ask a schema "is this field a number?", which is exactly what turning
 * the flat, stringly typed shape of `FormData` into the value a schema expects requires.
 * Each validator therefore contributes its own coercion step, and the spec takes over
 * from there.
 *
 * Implementations should return `formData` untouched when handed a schema they cannot
 * introspect, so that validation — rather than the coercion — reports the mismatch.
 */
export type ToFormInputFn = (schema: unknown, formData: FormData, options: Options) => unknown;

export interface Options {
	convertEmptyStringsToNull?: boolean | undefined;
};

const trueFormValues = new Set(['on', '1', 'yes', 'true']);

export function isTrueFormValue(value: unknown): boolean {
	return typeof value === 'string' && trueFormValues.has(value);
}

export function coerceFormNumber(value: FormDataEntryValue | null): FormDataEntryValue | number | null {
	return value === null || value === '' ? value : Number(value);
}

export function hasFormDataKeyWithPrefix(keys: Iterable<string>, prefix: string): boolean {
	for (const key of keys) {
		if (key.startsWith(prefix)) return true;
	}
	return false;
}

export function hasFormDataKeyOrNested(keys: Iterable<string>, key: string): boolean {
	return hasFormDataKeyWithPrefix(keys, `${key}.`) || hasFormDataKeyWithPrefix(keys, key);
}

export const validationMapper = new Map<string, ToFormInputFn>();

export class UnsupportedVendorError extends Error {
	constructor(vendor: string) {
		super(
			`standard-form: Unsupported schema vendor "${vendor}". Request built-in support at https://github.com/standard-community/standard-form/issues or register a handler with loadVendor().`,
		);
	}
}

export class MissingDependencyError extends Error {
	constructor(packageName: string) {
		super(`standard-form: Missing dependencies "${packageName}".`);
	}
}

export class UnsupportedSchemaError extends Error {
	constructor(vendor: string, requirement: string) {
		super(`standard-form: Unsupported schema for vendor "${vendor}". ${requirement}.`);
	}
}
