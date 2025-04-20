// See https://github.com/prisma/prisma/issues/26841#issuecomment-2788215418
// The regex replacement can be removed once https://github.com/prisma/prisma/pull/26867 is released
// But the @ts-nocheck might have to stay for a while :/
import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(import.meta.dirname, '../src/generated/prisma/client.ts');

let content = fs.readFileSync(filePath, 'utf8');

content = '// @ts-nocheck\n' + content.replace(
  /export const (DbNull|JsonNull|AnyNull) = runtime\.objectEnumValues\.instances\.\1/g,
  'export const $1 = NullTypes.$1',
);

fs.writeFileSync(filePath, content);

console.log('✅ Prisma types have been successfully modified.');
