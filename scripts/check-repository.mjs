import { inspectRepository } from './lib/repository.mjs';

const { errors, warnings } = await inspectRepository();

for (const warning of warnings) {
  console.warn(`warning: ${warning}`);
}

for (const error of errors) {
  console.error(`error: ${error}`);
}

if (errors.length > 0) {
  process.exitCode = 1;
} else {
  console.log('Repository invariants passed.');
}
