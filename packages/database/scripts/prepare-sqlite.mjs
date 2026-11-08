import { mkdir, open } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configured = process.env.DATABASE_URL || 'file:./latchwork.db';
if (!configured.startsWith('file:')) throw new Error('This prototype requires a SQLite file: DATABASE_URL');
const schemaDirectory = fileURLToPath(new URL('../prisma/', import.meta.url));
const filename = decodeURIComponent(configured.slice(5).split('?')[0]);
if (!filename || filename === ':memory:') throw new Error('A persistent SQLite file path is required');
const target = isAbsolute(filename) ? filename : resolve(schemaDirectory, filename);
await mkdir(dirname(target), { recursive: true });
const file = await open(target, 'a');
await file.close();
