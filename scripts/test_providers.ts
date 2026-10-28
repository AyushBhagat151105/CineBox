import { getActiveHDHub4uDomain } from '../src/providers/hdhub4u/domain';
import { HDHub4uProvider } from '../src/providers/hdhub4u/client';
import { FourKHdHubProvider } from '../src/providers/fourkhdhub/client';
import { MovieBoxProvider } from '../src/providers/moviebox/client';
import { aggregator } from '../src/providers/aggregator';

async function main() {
  console.log('==================================================');
  console.log('🚀 TESTING CINEBOX FEDERATED MEDIA ENGINE');
  console.log('==================================================\n');

  // 1. HDHub4u Domain Router Gateway
  console.log('1️⃣ Testing HDHub4u Gateway Domain Probe...');
  try {
    const domain = await getActiveHDHub4uDomain();
    console.log(`   ✅ Active HDHub4u Domain: ${domain}`);
  } catch (err: any) {
    console.error(`   ❌ Gateway probe failed:`, err.message);
  }

  // 2. HDHub4u Provider Search (Bollywood & Hindi Content)
  console.log('\n2️⃣ Testing HDHub4u Bollywood Search ("Jawan")...');
  try {
    const hdhub = new HDHub4uProvider();
    const results = await hdhub.search('Jawan');
    console.log(`   ✅ Found ${results.length} results on HDHub4u`);
    if (results.length > 0) {
      console.log(`   🎬 Top match: "${results[0].title}" (${results[0].year || 'N/A'})`);
      console.log(`   🔗 ID: ${results[0].id.value}`);
      console.log(`   🖼️ Poster: ${results[0].posterUrl?.slice(0, 60)}...`);

      // Test release parsing
      console.log('   Testing HDHub4u quality release parsing...');
      const releases = await hdhub.releases(results[0].id.value);
      console.log(`   ✅ Extracted ${releases.length} quality releases:`);
      for (const rel of releases.slice(0, 3)) {
        console.log(`      - [${rel.quality}] ${rel.filename.slice(0, 65)}... (${rel.mirrors.length} mirrors)`);
      }
    }
  } catch (err: any) {
    console.error(`   ❌ HDHub4u search error:`, err.message);
  }

  // 3. 4KHDHub Provider Search (4K UHD Remux)
  console.log('\n3️⃣ Testing 4KHDHub Search ("Dune")...');
  try {
    const fourk = new FourKHdHubProvider();
    const results = await fourk.search('Dune');
    console.log(`   ✅ Found ${results.length} results on 4KHDHub`);
    if (results.length > 0) {
      console.log(`   🎬 Top match: "${results[0].title}"`);
      console.log(`   🔗 ID: ${results[0].id.value}`);

      const releases = await fourk.releases(results[0].id.value);
      console.log(`   ✅ Extracted ${releases.length} 4K releases:`);
      for (const rel of releases.slice(0, 2)) {
        console.log(`      - [${rel.quality}] ${rel.filename.slice(0, 65)}...`);
      }
    }
  } catch (err: any) {
    console.error(`   ❌ 4KHDHub search error:`, err.message);
  }

  // 4. MovieBox API Search (HMAC-MD5 Cryptographic Signing)
  console.log('\n4️⃣ Testing MovieBox Provider ("Inception")...');
  try {
    const mb = new MovieBoxProvider();
    const results = await mb.search('Inception');
    console.log(`   ✅ Found ${results.length} results on MovieBox`);
    if (results.length > 0) {
      console.log(`   🎬 Top match: "${results[0].title}" (${results[0].year || 'N/A'})`);
      console.log(`   🔗 ID: ${results[0].id.value}`);
      console.log(`   ⭐ Rating: ${results[0].rating || 'N/A'}`);
    }
  } catch (err: any) {
    console.error(`   ❌ MovieBox search error:`, err.message);
  }

  // 5. Aggregator Federated Search & Deduplication
  console.log('\n5️⃣ Testing Aggregator Federated Search ("Interstellar")...');
  try {
    const unified = await aggregator.searchAll('Interstellar');
    console.log(`   ✅ Aggregated and deduplicated: ${unified.length} distinct titles`);
    for (const item of unified.slice(0, 4)) {
      console.log(`   🎬 "${item.title}" (${item.year || 'N/A'}) - Providers: [${item.availableProviders.join(', ')}]`);
    }
  } catch (err: any) {
    console.error(`   ❌ Aggregator federated search error:`, err.message);
  }

  console.log('\n==================================================');
  console.log('🎉 ALL ENGINE VERIFICATIONS COMPLETE!');
  console.log('==================================================');
}

main();
