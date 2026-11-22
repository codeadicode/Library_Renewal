import { createDataStore } from '../repositories';
import { runRecommendationBenchmark } from '../recommendation/benchmark';

/**
 * Prints the recommendation benchmark. Uses the configured data store
 * (PostgreSQL by default); pass --memory to run against the built-in demo data.
 */
async function run() {
  const store = createDataStore(process.argv.includes('--memory') ? 'memory' : undefined);
  try {
    const report = await runRecommendationBenchmark(store.repos);

    console.log('===============================================================');
    console.log('LIBTRACK: RECOMMENDATION BENCHMARK');
    console.log(`Metadata-only vs Hybrid (metadata + TF-IDF) · ${report.queryCount} queries · k=${report.k} · store=${store.driver}`);
    console.log('===============================================================\n');
    console.log('METRIC                    | METADATA-ONLY | HYBRID   | DELTA    | BETTER');
    console.log('--------------------------+---------------+----------+----------+-------------');
    for (const row of report.comparison) {
      const delta = `${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(4)}`;
      console.log(
        `${row.label.padEnd(26)}| ${row.metadataOnly.toFixed(4).padEnd(14)}| ${row.hybrid.toFixed(4).padEnd(9)}| ${delta.padEnd(9)}| ${row.winner}`,
      );
    }
    console.log(
      `${'Mean latency (ms)'.padEnd(26)}| ${report.metadataOnly.averageLatencyMs.toFixed(2).padEnd(14)}| ${report.hybridTfIdf.averageLatencyMs.toFixed(2)}`,
    );
    console.log('\nConclusion:');
    console.log(report.conclusion);
  } finally {
    await store.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
