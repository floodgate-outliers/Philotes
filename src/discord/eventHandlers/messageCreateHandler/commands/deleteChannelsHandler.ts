import { Guild, Message } from 'discord.js'
import { deleteMatchingChannels } from '../../../matchingChannels'

type DeleteChannelsHandlerArgs = {
    guild: Guild
    botMatchingChannelName: string
    message: Message
}

export async function deleteChannelsHandler({
    guild,
    botMatchingChannelName,
    message,
}: DeleteChannelsHandlerArgs) {
    await deleteMatchingChannels({
        guild,
        botMachingChannelName: botMatchingChannelName,
    })
    message.reply(`Channels deleted.`)
}
