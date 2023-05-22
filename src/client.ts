import { Bot } from './Bot.js'
import { prisma } from './prisma.js'


if (process.argv.includes('--smoke')) {
  // Performs a basic smoke test
  console.info('[SMOKE] Running smoke test...')
  const result = await prisma.messageReportCount.count()
  console.info(`[SMOKE] Number of message reports: ${result}`)
  console.info(`[SMOKE] OK, database connection is working!`)

  // Attempt to load handlers
  new Bot().loadHandlers()
  console.info(`[SMOKE] OK, loading handlers is working!`)
} else {
  // Run the bot
  new Bot().initAndStart()
}
