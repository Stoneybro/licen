import postgres from "postgres";

const connectionString = "postgresql://neondb_owner:npg_4RQPljd2kpxF@ep-small-recipe-am0nmoa7.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(connectionString);

async function check() {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  console.log(tables.map(t => t.table_name));
  process.exit(0);
}
check();
