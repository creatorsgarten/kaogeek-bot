import {
  APIEmbed,
  ButtonStyle,
  Client,
  CommandInteraction,
  ComponentType,
  GuildMember,
  Message,
} from 'discord.js'
import { InteractionButtonComponentData } from 'discord.js'
import { TextInputStyle } from 'discord.js'
import { MessageComponentInteraction } from 'discord.js'

import { UserModerationLog, UserProfile } from '@prisma/client'
import { randomUUID } from 'crypto'

import { prisma } from '../../prisma.js'

export interface InspectProfileOptions {
  client: Client
  interaction: CommandInteraction
  member: GuildMember
  messageContext?: Message
}

interface InspectProfileContext {
  options: InspectProfileOptions
}

export async function inspectProfile(
  options: InspectProfileOptions,
): Promise<void> {
  return inspectProfileMain({ options })
}

async function inspectProfileMain(
  context: InspectProfileContext,
): Promise<void> {
  const { interaction, member } = context.options
  const logs = await prisma.userModerationLog.findMany({
    where: { userId: member.user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
  const userProfile = await ensureUserProfile(member)

  const description =
    logs.length > 0
      ? logs.map(formatLog).join('\n')
      : '(No moderation logs found)'

  const embeds: APIEmbed[] = [
    {
      title: `${userProfile.tag} (${userProfile.displayName})`,
      description,
      color: 0xff7700,
      fields: [
        { name: 'ID', value: userProfile.id, inline: true },
        { name: 'Strikes', value: `${userProfile.strikes}`, inline: true },
      ],
    },
  ]

  const strikeActionId = randomUUID() as string
  const resetStrikeActionId = randomUUID() as string
  const buttons: InteractionButtonComponentData[] = []
  buttons.push({
    type: ComponentType.Button,
    style: ButtonStyle.Primary,
    label: 'Strike',
    customId: strikeActionId,
  })
  if (userProfile.strikes > 0) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: 'Reset strike',
      customId: resetStrikeActionId,
    })
  }
  await interaction.editReply({
    embeds,
    components: [
      {
        type: ComponentType.ActionRow,
        components: buttons,
      },
    ],
  })

  const selectedInteraction = await Promise.resolve(
    interaction.channel?.awaitMessageComponent({
      filter: (i) => buttons.map((b) => b.customId).includes(i.customId),
      time: 60000,
    }),
  ).catch(() => null)

  if (!selectedInteraction) {
    await interaction.editReply({ components: [] })
    return
  }

  const logContext: LogContext = {
    userId: userProfile.id,
    actorId: interaction.user.id,
  }

  if (selectedInteraction.customId === strikeActionId) {
    return strike(context, userProfile, logContext, selectedInteraction)
  }

  if (selectedInteraction.customId === resetStrikeActionId) {
    return resetStrike(context, userProfile, logContext, selectedInteraction)
  }
}

async function strike(
  context: InspectProfileContext,
  userProfile: UserProfile,
  logContext: LogContext,
  buttonInteraction: MessageComponentInteraction,
) {
  const strikes = userProfile.strikes + 1
  const promptId = randomUUID() as string
  await buttonInteraction.showModal({
    customId: promptId,
    title: `Strike #${strikes}`,
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            customId: 'reason',
            label: 'Reason',
            type: ComponentType.TextInput,
            style: TextInputStyle.Short,
            required: true,
            placeholder: '…',
          },
        ],
      },
    ],
  })
  const submitted = await buttonInteraction
    .awaitModalSubmit({
      time: 5 * 60000,
      filter: (i) => i.customId === promptId,
    })
    .catch(() => null)
  if (!submitted) {
    await buttonInteraction.reply({
      content: 'Timed out',
      ephemeral: true,
    })
    return inspectProfileMain(context)
  }

  const reason = submitted.fields.getTextInputValue('reason')
  await prisma.userProfile.update({
    where: { id: userProfile.id },
    data: { strikes },
  })

  const { messageContext, interaction } = context.options
  const suffix = messageContext ? ` (context: ${messageContext.url})` : ''
  await logActivity(
    logContext,
    'strike',
    `strike #${strikes} added by ${interaction.user.tag}: ${reason}${suffix}`,
    { strikes, message: messageContext?.url },
  )

  await submitted.reply({
    content: `strike #${strikes} added to ${userProfile.tag}`,
    ephemeral: true,
  })
  return inspectProfileMain(context)
}

async function resetStrike(
  context: InspectProfileContext,
  userProfile: UserProfile,
  logContext: LogContext,
  buttonInteraction: MessageComponentInteraction,
) {
  await prisma.userProfile.update({
    where: { id: userProfile.id },
    data: { strikes: 0 },
  })
  const { interaction } = context.options
  await logActivity(
    logContext,
    'strike',
    `strikes reset to 0 by ${interaction.user.tag}`,
    { strikes: 0 },
  )
  await buttonInteraction.reply({
    content: `strikes reset for ${userProfile.tag}`,
    ephemeral: true,
  })
  return inspectProfileMain(context)
}

const formatLog = (log: UserModerationLog) =>
  `${formatDiscordTimestamp(log.createdAt)} ${log.type} - ${log.message}`

const formatDiscordTimestamp = (date: Date) =>
  `<t:${Math.floor(date.getTime() / 1000)}:R>`

async function ensureUserProfile(member: GuildMember) {
  const id = member.user.id
  const tag = member.user.tag
  const displayName = member.displayName
  const userProfile = await prisma.userProfile.upsert({
    where: { id: id },
    update: { tag, displayName },
    create: { id, tag, displayName },
  })
  return userProfile
}

export function addUserModerationLogEntry(
  userId: string,
  actorId: string,
  type: string,
  message: string,
  metadata: object = {},
) {
  return prisma.userModerationLog.create({
    data: {
      userId,
      actorId,
      type,
      message,
      metadata: JSON.stringify(metadata),
    },
  })
}

interface LogContext {
  userId: string
  actorId: string
}

const logActivity = (
  { userId, actorId }: LogContext,
  type: string,
  message: string,
  metadataObject: object = {},
) => {
  const metadata = JSON.stringify(metadataObject)
  return prisma.userModerationLog.create({
    data: { userId, actorId, type, message, metadata },
  })
}
