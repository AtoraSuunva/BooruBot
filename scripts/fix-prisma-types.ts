// See https://github.com/prisma/prisma/issues/26884#issuecomment-2840063551
// They added `/* @ts-nocheck */` to the generated files, but typescript only supports `// @ts-nocheck` (the single-line comment version).
// So until they fix this, we need to change it manually.
import fs from 'node:fs/promises';
import path from 'node:path';

const generatedPath = path.join(import.meta.dirname, '../src/generated/prisma/');

for await (const file of fs.glob('**/*.ts', { cwd: generatedPath })) {
    const filePath = path.join(generatedPath, file);

    let content = await fs.readFile(filePath, 'utf8');

    content = content.replaceAll(
      '/* @ts-nocheck */',
      '// @ts-nocheck',
    );

    await fs.writeFile(filePath, content);

    console.log(`✔️  Fixed ${filePath}`);
}

console.log('✅ Prisma types have been successfully modified.');
