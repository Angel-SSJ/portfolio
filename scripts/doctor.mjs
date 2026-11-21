import { collectDoctorFacts, evaluateDoctor } from './lib/doctor.mjs';

const args = process.argv.slice(2);
const externalRequested = args.includes('--external');

if (args.some((arg) => arg !== '--external')) {
  console.error('Unknown argument');
  process.exitCode = 2;
} else {
  const facts = collectDoctorFacts({ externalRequested });
  const result = evaluateDoctor(facts);

  console.log(`runtime: ${facts.runtimeMatches ? 'ok' : 'mismatch'}`);
  console.log(`pnpm: ${facts.pnpmMatches ? 'ok' : 'mismatch'}`);
  console.log(`git identity: ${facts.identityMatches ? 'ok' : 'mismatch'}`);
  console.log(`hooks: ${facts.hooksInstalled ? 'ok' : 'missing'}`);
  console.log(`vercel link: ${facts.vercelLinked ? 'ok' : 'pending'}`);
  console.log(`CI config: ${facts.ciConfigured ? 'ok' : 'pending'}`);
  console.log(
    `deployment secrets: ${facts.secretsConfigured ? 'ok' : 'pending'}`,
  );

  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`);
  }

  for (const error of result.errors) {
    console.error(`error: ${error}`);
  }

  if (result.errors.length > 0) {
    process.exitCode = 1;
  } else if (externalRequested) {
    console.log('External readiness passed.');
  } else {
    console.log('Local readiness passed; external readiness pending Task 8.');
  }
}
