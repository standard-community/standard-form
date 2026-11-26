# @standard-community/standard-form

Parse browser [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) with any [Standard Schema](https://standardschema.dev)-compatible validator.

## Install

Install this package and one supported validator:

```sh
npm install @standard-community/standard-form zod
```

```sh
yarn add @standard-community/standard-form zod
```

```sh
pnpm add @standard-community/standard-form zod
```

The built-in adapters support Zod 4 and higher, Valibot, and ArkType. Install only the validator your project uses.

## Parse form data

`FormData` stores string values and repeated keys. `parseFormData` uses the schema's validator adapter to build the input shape, coerce values, and then validate the result.

```ts
import { parseFormData } from '@standard-community/standard-form';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  newsletter: z.boolean(),
  address: z.object({ city: z.string() }),
});

const formData = new FormData();
formData.set('name', 'Ben');
formData.set('age', '32');
formData.set('newsletter', 'true');
formData.set('address.city', 'Paris');

const result = await parseFormData(schema, formData);
if (result.issues) {
  handleIssues(result.issues);
} else {
  result.value;
}
```

Adapters handle these form values:

- Numeric strings become numbers.
- Boolean strings become booleans.
- Checkbox values `"on"`, `"1"`, `"yes"`, and `"true"` become `true`. An omitted checkbox field becomes `false`.
- Dotted names such as `address.city` become nested objects.
- Repeated names become array values.

## Convert empty strings to null

Pass an `Options` object as the third argument to convert empty values for schema-declared string fields to `null` before validation. This applies to nested string fields and string array items. It does not modify unknown fields or non-object inputs such as `FormData`.

```ts
import { parseFormData } from '@standard-community/standard-form';
import type { Options } from '@standard-community/standard-form';

const options: Options = { convertEmptyStringsToNull: true };
const result = await parseFormData(schema, formData, options);
```

## Register a vendor handler

The package includes built-in handlers for these validators:

| Validator | Support |
| --- | --- |
| Zod | Version 4 and higher |
| Valibot | Built in |
| ArkType | Built in |

For another Standard Schema validator, register a handler with `loadVendor`. If you want built-in support for a validator, [open an issue](https://github.com/standard-community/standard-form/issues):

```ts
import { loadVendor } from '@standard-community/standard-form';

loadVendor('custom', (schema, formData, options) => {
  return Object.fromEntries(formData.entries());
});
```

The handler receives the schema, the original `FormData`, and the `Options` object. Implement schema-specific coercion in the handler. `loadVendor` can also replace a built-in handler:

```ts
import { loadVendor } from '@standard-community/standard-form';
import zodHandler from '@standard-community/standard-form/zod';

loadVendor('zod', await zodHandler());
```
