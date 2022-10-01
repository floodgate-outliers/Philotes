import { Message } from 'discord.js'
import { Guilds } from '../../../../database/types'

type StatusCommandHandlerArgs = {
    message: Message
    guildData: Guilds
}

export async function statusCommandHandler({
    message,
    guildData,
}: StatusCommandHandlerArgs) {
    await message.channel.send(
        `Roles: ${JSON.stringify(guildData.matching_roles)}`
    )
    // await message.channel.send(
    //     `Blacklist: ${JSON.stringify(guildData.blacklist)}`
    // )
}
