# @standard-community/standard-form

Parse [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) with any [Standard Schema](https://standardschema.dev) validator.

```ts
import { parseFormData } from '@standard-community/standard-form';
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.number(),
  newsletter: z.boolean(),
  address: z.object({ city: z.string() }),
});

const result = await parseFormData(schema, formData);
if (result.issues) {
  handleIssues(result.issues);
} else {
  result.value;
}
```

`FormData` is flat and stringly typed, and the Standard Schema specification covers validation but not schema introspection. Each validator therefore provides its own handler for coercion. Validation uses the Standard Schema interface.

Handlers are resolved from the schema's `~standard.vendor` and imported lazily, so a project only needs to install the validators it uses.

| Vendor | Support |
| ------ | ------- |
| `zod` | Built in for Zod 4 and higher |

Other vendors throw an `UnsupportedVendorError` until you register a handler:

```ts
import { loadVendor } from '@standard-community/standard-form';

loadVendor('valibot', (_schema, formData) => Object.fromEntries(formData.entries()));
```

`loadVendor` also replaces a built-in handler:

```ts
import { loadVendor } from '@standard-community/standard-form';
import zodHandler from '@standard-community/standard-form/zod';

loadVendor('zod', await zodHandler());
```
