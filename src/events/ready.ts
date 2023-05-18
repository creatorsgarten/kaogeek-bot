import { Events } from 'discord.js'

import { EventHandlerConfig } from '../types/EventHandlerConfig.js'

export default {
  eventName: Events.ClientReady,
  once: true,
  execute: async (client) => {
    console.log(`Helloworld, Online as ${client.user?.tag}.`)
    const commands_data = [...client.commands.values()].map(
      (command) => command.data,
    )
    try {
      await client.application?.commands.set(commands_data)
    } catch (error) {
      console.log(error)
    }
  },
} satisfies EventHandlerConfig<Events.ClientReady>
