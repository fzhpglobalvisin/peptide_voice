// DELETES ALL DATA (products, sessions, leads, orders, customers, admins).
// Tables are recreated and the default catalog re-seeded on the next page load.
// Usage: npm run db:reset -- --yes
import { connect } from './_env.mjs';

if (!process.argv.includes('--yes')) {
  console.error('This deletes every table and all data. Run again with --yes to confirm:  npm run db:reset -- --yes');
  process.exit(1);
}
const sql = await connect();
try {
  await sql.unsafe(`DROP TABLE IF EXISTS admin_passkeys, admin_resets, admin_users, newsletter, compliance_events, product_events,
    orders, quotes, leads, customers, research_context, chat_sessions, attestations, coas, products CASCADE`);
  console.log('All tables dropped. Open the site to recreate and re-seed them.');
} finally {
  await sql.end({ timeout: 5 });
}
