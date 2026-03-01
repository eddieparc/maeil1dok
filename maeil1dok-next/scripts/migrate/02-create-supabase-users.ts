import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { isDryRun, USER_BATCH_SIZE, USER_CREATION_DELAY_MS } from './config.ts'
import { batchInsert, createSupabaseAdmin, logProgress } from './utils.ts'
import type { DjangoSocialAccount, DjangoUser, DjangoUserProfile, UserMapping } from './types.ts'

const DATA_DIR = join(import.meta.dirname, 'data')

interface MigrationMapping extends Record<string, unknown> {
  django_user_id: number
  supabase_user_id: string
  django_email: string
  django_social_provider: string | null
  django_social_id: string | null
}

function loadExtractedData(): {
  users: DjangoUser[]
  socialAccounts: DjangoSocialAccount[]
  userProfiles: DjangoUserProfile[]
} {
  const users: DjangoUser[] = JSON.parse(readFileSync(join(DATA_DIR, 'users.json'), 'utf-8'))
  const socialAccounts: DjangoSocialAccount[] = JSON.parse(
    readFileSync(join(DATA_DIR, 'social_accounts.json'), 'utf-8')
  )
  const userProfiles: DjangoUserProfile[] = JSON.parse(
    readFileSync(join(DATA_DIR, 'user_profiles.json'), 'utf-8')
  )

  return { users, socialAccounts, userProfiles }
}

function shouldSkipUser(user: DjangoUser): { skip: boolean; reason: string } {
  if (user.scheduled_deletion_at) {
    return { skip: true, reason: 'scheduled_deletion_at set' }
  }

  if (user.merged_into_id) {
    return { skip: true, reason: 'merged into another account' }
  }

  return { skip: false, reason: '' }
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }

  return chunks
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createProfileRow(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  supabaseUserId: string,
  user: DjangoUser,
  profile: DjangoUserProfile | undefined
): Promise<void> {
  const profileData = {
    user_id: supabaseUserId,
    nickname: user.nickname,
    bio: profile?.bio ?? '',
    total_completed_days: profile?.total_completed_days ?? 0,
    current_streak: profile?.current_streak ?? 0,
    longest_streak: profile?.longest_streak ?? 0,
    is_public: profile?.is_public ?? false,
    avatar_url: user.profile_image,
  }

  const { error } = await supabase.from('profiles').insert(profileData)

  if (error) {
    console.warn(`[WARN] Failed to create profile for user ${supabaseUserId}: ${error.message}`)
  }
}

async function createUserInSupabase(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  user: DjangoUser,
  profile: DjangoUserProfile | undefined,
  dryRun: boolean
): Promise<string | null> {
  if (dryRun) {
    const suffix = user.id.toString().padStart(12, '0').slice(-12)
    return `00000000-0000-0000-0000-${suffix}`
  }

  try {
    const randomPassword = `Temp${Math.random().toString(36).slice(2)}${Date.now()}!`

    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        nickname: user.nickname,
        profile_image: user.profile_image,
        django_user_id: user.id,
      },
    })

    if (error) {
      console.error(`[FAIL] Django user ${user.id} (${user.email}): ${error.message}`)
      return null
    }

    if (!data.user?.id) {
      console.error(`[FAIL] Django user ${user.id} (${user.email}): missing Supabase user ID`)
      return null
    }

    await createProfileRow(supabase, data.user.id, user, profile)
    return data.user.id
  } catch (err) {
    console.error(
      `[ERROR] Django user ${user.id} (${user.email}): ${
        err instanceof Error ? err.message : String(err)
      }`
    )
    return null
  }
}

async function main(): Promise<void> {
  const supabase = createSupabaseAdmin()
  const { users, socialAccounts, userProfiles } = loadExtractedData()

  const profileMap = new Map<number, DjangoUserProfile>(userProfiles.map((profile) => [profile.user_id, profile]))
  const socialMap = new Map<number, DjangoSocialAccount>(
    socialAccounts.map((socialAccount) => [socialAccount.user_id, socialAccount])
  )
  const seenEmails = new Set<string>()

  const mappings: UserMapping[] = []
  const migrationMappings: MigrationMapping[] = []

  let created = 0
  let skipped = 0
  let duplicates = 0
  let failed = 0

  const userBatches = chunkArray(users, USER_BATCH_SIZE)
  let processedCount = 0

  for (const batch of userBatches) {
    for (const user of batch) {
      processedCount += 1
      const normalizedEmail = user.email.trim().toLowerCase()

      const { skip, reason } = shouldSkipUser(user)
      if (skip) {
        console.log(`[SKIP] Django user ${user.id} (${user.email}): ${reason}`)
        skipped += 1
        logProgress('Creating users', processedCount, users.length)
        continue
      }

      if (!normalizedEmail) {
        console.warn(`[SKIP] Django user ${user.id}: empty email`)
        skipped += 1
        logProgress('Creating users', processedCount, users.length)
        continue
      }

      if (seenEmails.has(normalizedEmail)) {
        console.warn(
          `[DUPLICATE] Django user ${user.id} (${user.email}): duplicate email, skipping`
        )
        duplicates += 1
        logProgress('Creating users', processedCount, users.length)
        continue
      }

      seenEmails.add(normalizedEmail)

      const supabaseUUID = await createUserInSupabase(
        supabase,
        user,
        profileMap.get(user.id),
        isDryRun
      )

      if (!supabaseUUID) {
        failed += 1
        logProgress('Creating users', processedCount, users.length)
        if (!isDryRun) {
          await delay(USER_CREATION_DELAY_MS)
        }
        continue
      }

      const socialAccount = socialMap.get(user.id)

      mappings.push({
        django_user_id: user.id,
        supabase_user_id: supabaseUUID,
      })

      migrationMappings.push({
        django_user_id: user.id,
        supabase_user_id: supabaseUUID,
        django_email: user.email,
        django_social_provider: socialAccount?.provider ?? null,
        django_social_id: socialAccount?.provider_id ?? null,
      })

      created += 1

      logProgress('Creating users', processedCount, users.length)

      if (!isDryRun) {
        await delay(USER_CREATION_DELAY_MS)
      }
    }
  }

  if (!isDryRun) {
    writeFileSync(join(DATA_DIR, 'user_mapping.json'), JSON.stringify(mappings, null, 2))
    await batchInsert<MigrationMapping>(supabase, 'migration_user_mapping', migrationMappings)

    console.log('\n✅ User creation complete:')
    console.log(`  Created: ${created}`)
    console.log(`  Skipped: ${skipped} (scheduled deletion, merged, or invalid email)`)
    console.log(`  Duplicates: ${duplicates}`)
    console.log(`  Failed: ${failed}`)
    console.log('  Mapping saved to: data/user_mapping.json')
    return
  }

  console.log(
    `\n[DRY RUN] Would create ${created} users, skip ${skipped}, skip ${duplicates} duplicates, fail ${failed}`
  )
  console.log(`  Social users (no password migration): ${users.filter((user) => user.is_social).length}`)
  console.log(`  Email/password users: ${users.filter((user) => !user.is_social).length}`)
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
