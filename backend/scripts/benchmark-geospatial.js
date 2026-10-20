/**
 * Geospatial Benchmark Script for RakshaSetu
 * Compares Redis Geospatial ($O(\log N)$) search performance across 10,000 simulated responders.
 *
 * Usage: node scripts/benchmark-geospatial.js
 */

import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const BENCHMARK_KEY = 'geo:benchmark:responders';

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  enableReadyCheck: false,
  maxRetriesPerRequest: null
});

// Central Anchor (Connaught Place, New Delhi)
const CENTER_LAT = 28.6304;
const CENTER_LNG = 77.2177;

// Generate random point within ~15km radius
function getRandomOffsetCoordinate(centerLat, centerLng, maxRadiusKm = 15) {
  const r = (maxRadiusKm / 111.32) * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const lat = centerLat + r * Math.cos(theta);
  const lng = centerLng + (r * Math.sin(theta)) / Math.cos(centerLat * (Math.PI / 180));
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

function calculatePercentile(latencies, percentile) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)].toFixed(3);
}

async function runBenchmark() {
  console.log('===========================================================');
  console.log('       RakshaSetu Redis Geospatial Benchmark Suite         ');
  console.log('===========================================================');
  console.log(`Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT}...`);

  try {
    await redis.ping();
    console.log('Connected successfully.\n');

    // Clean previous benchmark data
    await redis.del(BENCHMARK_KEY);

    const TOTAL_RESPONDERS = 10000;
    console.log(`[Phase 1] Ingesting ${TOTAL_RESPONDERS.toLocaleString()} simulated responders into Redis...`);
    const insertStart = performance.now();

    const pipeline = redis.pipeline();
    for (let i = 1; i <= TOTAL_RESPONDERS; i++) {
      const [lng, lat] = getRandomOffsetCoordinate(CENTER_LAT, CENTER_LNG, 20);
      pipeline.geoadd(BENCHMARK_KEY, lng, lat, `user-${i}`);
    }
    await pipeline.exec();
    const insertDuration = (performance.now() - insertStart).toFixed(2);
    console.log(`Ingested ${TOTAL_RESPONDERS} coordinates in ${insertDuration} ms (${Math.round(TOTAL_RESPONDERS / (insertDuration / 1000))} ops/sec)\n`);

    // Proximity Query Benchmark
    const QUERY_COUNT = 1000;
    const RADIUS_KM = 3;
    console.log(`[Phase 2] Executing ${QUERY_COUNT.toLocaleString()} proximity searches (radius: ${RADIUS_KM} km)...`);

    const latencies = [];
    let totalMatched = 0;

    const queryStart = performance.now();
    for (let i = 0; i < QUERY_COUNT; i++) {
      // Pick a random query origin within the area
      const [qLng, qLat] = getRandomOffsetCoordinate(CENTER_LAT, CENTER_LNG, 10);

      const t0 = performance.now();
      const results = await redis.geosearch(
        BENCHMARK_KEY,
        'FROMLONLAT',
        qLng,
        qLat,
        'BYRADIUS',
        RADIUS_KM,
        'km',
        'WITHDIST',
        'ASC'
      );
      const elapsed = performance.now() - t0;
      latencies.push(elapsed);
      totalMatched += results.length;
    }
    const totalQueryTime = (performance.now() - queryStart).toFixed(2);

    console.log('\n================== BENCHMARK RESULTS ==================');
    console.log(`Total Queries Executed:  ${QUERY_COUNT}`);
    console.log(`Total Responders Found:  ${totalMatched} (avg ${(totalMatched / QUERY_COUNT).toFixed(1)} / query)`);
    console.log(`Total Elapsed Time:      ${totalQueryTime} ms`);
    console.log(`Throughput:              ${Math.round(QUERY_COUNT / (totalQueryTime / 1000))} queries/sec`);
    console.log('-------------------------------------------------------');
    console.log(`Latency p50 (Median):    ${calculatePercentile(latencies, 50)} ms`);
    console.log(`Latency p90:             ${calculatePercentile(latencies, 90)} ms`);
    console.log(`Latency p95:             ${calculatePercentile(latencies, 95)} ms`);
    console.log(`Latency p99:             ${calculatePercentile(latencies, 99)} ms`);
    console.log('=======================================================\n');

    // Cleanup
    await redis.del(BENCHMARK_KEY);
    console.log('Benchmark dataset cleaned from Redis.');
    process.exit(0);
  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }
}

runBenchmark();
