import { Events } from 'discord.js'

import { definePlugin } from '@/types/definePlugin'
import isOnlyEmoji from '@/utils/isOnlyEmoji'

export default definePlugin({
  name: 'preventEmojiSpam',
  setup: (pluginContext) => {
    pluginContext.addEventHandler({
      eventName: Events.MessageCreate,
      once: false,
      execute: async (botContext, message) => {
        const { runtimeConfiguration, log } = botContext
        // if has only emoji -> delete message
        if (isOnlyEmoji(message.content)) {
          try {
            log.info(
              `Message with only emoji: ${message.id} by ${message.author}`,
            )
            if (runtimeConfiguration.data.preventEmojiSpam.enabled) {
              await message.delete()
            }
          } catch (error) {
            log.error('Unable to process message', error)
          }
        }
      },
    })
  },
})
