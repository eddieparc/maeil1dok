import { execSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { isDryRun } from './config.ts'

const DATA_DIR = join(import.meta.dirname, 'data')

interface StepDefinition {
  step: number
  name: string
  script: string
}

interface StepResult {
  step: number
  name: string
  script: string
  status: 'pass' | 'fail' | 'skipped'
  durationMs: number
  error?: string
}

interface DryRunReport {
  timestamp: string
  dryRun: boolean
  startStep: number
  steps: StepResult[]
  totalDurationMs: number
  overall: 'pass' | 'fail'
}

const STEPS: StepDefinition[] = [
  { step: 1, name: 'Extract MySQL Data', script: '01-extract-mysql.ts' },
  { step: 2, name: 'Create Supabase Users', script: '02-create-supabase-users.ts' },
  { step: 3, name: 'Load Reference Data', script: '03a-load-reference-data.ts' },
  { step: 4, name: 'Load User Data', script: '03b-load-user-data.ts' },
  { step: 5, name: 'Validate Migration', script: '04-validate.ts' },
]

function getStartStep(): number {
  const stepIndex = process.argv.indexOf('--step')
  if (stepIndex !== -1 && stepIndex + 1 < process.argv.length) {
    const step = parseInt(process.argv[stepIndex + 1], 10)
    if (step >= 1 && step <= 5) {
      return step
    }
  }
  return 1
}

async function runStep(step: StepDefinition, dryRun: boolean): Promise<StepResult> {
  const startTime = Date.now()
  const scriptPath = join(import.meta.dirname, step.script)
  const dryRunFlag = dryRun ? ' --dry-run' : ''
  const command = `npx tsx "${scriptPath}"${dryRunFlag}`

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Step ${step.step}/5: ${step.name}`)
  console.log(`Script: ${step.script}`)
  console.log(`Command: ${command}`)
  console.log(`${'='.repeat(60)}`)

  try {
    execSync(command, { stdio: 'inherit', cwd: import.meta.dirname })
    const durationMs = Date.now() - startTime
    console.log(`\n[PASS] Step ${step.step} completed in ${(durationMs / 1000).toFixed(1)}s`)
    return { ...step, status: 'pass', durationMs }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`\n[FAIL] Step ${step.step} failed after ${(durationMs / 1000).toFixed(1)}s`)
    console.error(`Error: ${errorMessage}`)
    return { ...step, status: 'fail', durationMs, error: errorMessage }
  }
}

async function main(): Promise<void> {
  const startStep = getStartStep()
  const totalStart = Date.now()

  console.log(`\n${'#'.repeat(60)}`)
  console.log('# Maeil1Dok Migration Pipeline')
  console.log(`# Mode: ${isDryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`)
  console.log(`# Starting from step: ${startStep}`)
  console.log(`# Time: ${new Date().toISOString()}`)
  console.log(`${'#'.repeat(60)}\n`)

  mkdirSync(DATA_DIR, { recursive: true })

  const results: StepResult[] = []
  let failed = false

  for (const step of STEPS) {
    if (step.step < startStep) {
      results.push({ ...step, status: 'skipped', durationMs: 0 })
      continue
    }

    const result = await runStep(step, isDryRun)
    results.push(result)

    if (result.status === 'fail') {
      failed = true
      console.error(`\nPipeline stopped at step ${step.step}: ${step.name}`)
      console.error(`Fix the issue and resume with: npx tsx run-migration.ts --step ${step.step}`)
      break
    }
  }

  const totalDurationMs = Date.now() - totalStart

  console.log(`\n${'='.repeat(60)}`)
  console.log('MIGRATION PIPELINE SUMMARY')
  console.log(`${'='.repeat(60)}`)
  for (const result of results) {
    const icon = result.status === 'pass' ? '[PASS]' : result.status === 'fail' ? '[FAIL]' : '[SKIP]'
    const duration = result.status !== 'skipped' ? ` (${(result.durationMs / 1000).toFixed(1)}s)` : ''
    console.log(`${icon} Step ${result.step}: ${result.name}${duration}`)
  }
  console.log(`\nTotal time: ${(totalDurationMs / 1000).toFixed(1)}s`)
  console.log(`Overall: ${failed ? 'FAILED' : 'PASSED'}`)

  const report: DryRunReport = {
    timestamp: new Date().toISOString(),
    dryRun: isDryRun,
    startStep,
    steps: results,
    totalDurationMs,
    overall: failed ? 'fail' : 'pass',
  }

  writeFileSync(join(DATA_DIR, 'dry_run_report.json'), JSON.stringify(report, null, 2))
  console.log('\nReport saved to: data/dry_run_report.json')

  process.exit(failed ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
