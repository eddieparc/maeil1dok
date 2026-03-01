import dotenv from 'dotenv'

dotenv.config()

// MySQL Configuration
export const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
}

// Supabase Configuration
export const supabaseConfig = {
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
}

// Migration Constants
export const BATCH_SIZE = 1000
export const USER_BATCH_SIZE = 50
export const USER_CREATION_DELAY_MS = 100

// Dry-run flag
export const isDryRun = process.argv.includes('--dry-run')

// Get table flag from CLI arguments
export function getTableFlag(): string | null {
  const tableIndex = process.argv.indexOf('--table')
  if (tableIndex !== -1 && tableIndex + 1 < process.argv.length) {
    return process.argv[tableIndex + 1]
  }
  return null
}

// Validate required environment variables
function validateConfig(): void {
  const required = {
    MYSQL_HOST: mysqlConfig.host,
    MYSQL_USER: mysqlConfig.user,
    MYSQL_PASSWORD: mysqlConfig.password,
    MYSQL_DATABASE: mysqlConfig.database,
    SUPABASE_URL: supabaseConfig.url,
    SUPABASE_SERVICE_ROLE_KEY: supabaseConfig.serviceRoleKey,
  }

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please set these variables in your .env file or environment.`
    )
  }
}

validateConfig()
