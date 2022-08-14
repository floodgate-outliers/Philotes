import { Guild } from 'discord.js'
// import { Config } from '../configType'
// import { getDayOfWeekString } from '../utils/dayOfWeekTranslation'

/**
 * Create private channels with the paired users
 *
 * WARNING: Bot must have Administrator permissions to create channels
 * https://discordjs.guide/popular-topics/permissions-extended.html#limitations-and-oddities
 */
type createBotCommunicationChannelArgs = {
    guild: Guild
    botId: string
    BotCommunicationChannelCategory: string
    BotCommunicationChannelName: string
}
export async function createBotCommunicationChannel({
    guild,
    botId,
    BotCommunicationChannelCategory,
    BotCommunicationChannelName,
}: createBotCommunicationChannelArgs): Promise<string> {
    let channelCategory

    if (!guild) throw Error('Guild not defined')
    // Get the category to place the channel under
    channelCategory = guild.channels.cache.find(
        (c) =>
            c.type === 'GUILD_CATEGORY' &&
            c.name === BotCommunicationChannelCategory
    )

    if (!channelCategory) {
        channelCategory = await guild.channels.create(
            BotCommunicationChannelCategory,
            {
                type: 'GUILD_CATEGORY',
            }
        )
    }

    const channel = await guild.channels.create(BotCommunicationChannelName, {
        parent: channelCategory.id,
        position: 1,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: ['VIEW_CHANNEL'],
            },
            {
                id: botId,
                allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
            },
        ],
    })
    channel.send(
        `Hey 👋, This is the channel to communicate with the bot communications bot. `
    )

    return channel.id
}
