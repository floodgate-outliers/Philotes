import { Guild, OverwriteResolvable, Permissions } from 'discord.js'
import { Config } from '../../config/configType'

/**
 * Create private channels with the paired users
 *
 * @param {[string[]]} userIDGroups Array of grouped User ID's of the form [[user_1_ID, user_2_ID], [user_3_ID, user_4_ID], ...]
 * @returns {Promise<void>}
 */
type createPrivateChannelsArgs = {
    userIDGroups: [string[]]
    guild: Guild
    config: Config
    interval: number
}
export async function createPrivateChannels({
    guild,
    config,
    userIDGroups,
    interval,
}: createPrivateChannelsArgs): Promise<void> {
    if (!guild) return
    // Get the category to place the channel under
    const channelCategory = guild.channels.cache.find(
        (c) =>
            c.type === 'GUILD_CATEGORY' &&
            c.name === config.matchingCategoryName
    )

    if (!channelCategory) throw Error('Matching category not found in Guild')

    // Iterate over userID pairings and create DM group
    for (const userIDPair of userIDGroups) {
        // Construct permission overwrite for each user in the pair
        const userPermissionOverWrites: OverwriteResolvable[] = userIDPair.map(
            (userID) => {
                return {
                    type: 'member',
                    id: userID,
                    allow: Permissions.ALL,
                }
            }
        )
        // Create private channel
        const channel = await guild.channels.create(
            config.matchingChannelName,
            {
                parent: channelCategory.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: Permissions.ALL,
                    },
                    // Add the overwrites for the pair of users
                    ...userPermissionOverWrites,
                ],
            }
        )
        const userIDTag = userIDPair.map((userID) => `<@${userID}>`).join(' ')
        channel.send(`Hey ${userIDTag} 👋,
You have been matched!
Schedule a call, go for a walk or do whatever else.
The channel will automatically be closed after ${interval} days.
      `)
    }
}

/**
 * Helper function to delete all private channels
 *
 * @returns {Promise<void>}
 */
type deleteMatchingChannelsArgs = {
    guild: Guild
    config: Config
}
export async function deleteMatchingChannels({
    guild,
    config,
}: deleteMatchingChannelsArgs): Promise<void> {
    const matchingChannels = guild.channels.cache.filter(
        (channel) => channel.name === config.matchingChannelName
    )
    const matchingChannelsArray = Array.from(matchingChannels.values())
    for (let i = 0; i < matchingChannelsArray.length; i++) {
        await matchingChannelsArray[i].delete()
    }
}
