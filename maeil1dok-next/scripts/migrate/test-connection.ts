import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  })

  const [tables] = await conn.query('SHOW TABLES')
  console.log('✅ Connected! Tables:', (tables as any[]).length)
  for (const t of tables as any[]) {
    console.log('  -', Object.values(t)[0])
  }

  const [counts] = await conn.query(`
    SELECT 
      (SELECT COUNT(*) FROM accounts_user) as users,
      (SELECT COUNT(*) FROM todos_dailybibleschedule) as schedules,
      (SELECT COUNT(*) FROM todos_userbibleprogress) as progress,
      (SELECT COUNT(*) FROM todos_biblereadingplan) as plans,
      (SELECT COUNT(*) FROM todos_plansubscription) as subscriptions
  `)
  console.log('\nRow counts:', JSON.stringify((counts as any[])[0], null, 2))

  await conn.end()
}

main().catch(err => {
  console.error('❌ Connection failed:', err.message)
  process.exit(1)
})
