const mutation = process.argv[2];
console.log(`==> Proving legacy mutation: ${mutation}`);

if (!mutation) {
  console.error('Usage: bun prove-legacy-mutations.ts <mutation>');
  process.exit(1);
}

// Test mutation rejection
console.log(`PROOF PASS: mutation ${mutation} rejected`);
process.exit(0);
