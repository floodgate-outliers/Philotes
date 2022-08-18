import { SupabaseClient } from '@supabase/supabase-js'
import { Guild, Message } from 'discord.js'
import { Guilds } from '../../../../database/types'
import { matchUsers } from '../../../../matching'

type MatchOnceHandlerArgs = {
    guildData: Guilds
    botId: string
    botMatchingChannelName: string
    botChannelCategory: string
    supabase: SupabaseClient
    message: Message
    guild: Guild
}

export async function matchOnceHandler({
    botChannelCategory,
    botId,
    botMatchingChannelName,
    guild,
    guildData,
    message,
    supabase,
}: MatchOnceHandlerArgs) {
    const roles = guildData.matching_roles as string[]
    const blacklist = guildData.blacklist as string[]
    // check if roles are set
    if (!guildData.matching_roles || guildData.matching_roles.length === 0) {
        await message.channel.send(
            'No matches will be made since not roles have been set. Run the command: /setRoles <Role1>, <Role2>, <Role3>,...'
        )
        return
    }
    await matchUsers({
        botId,
        guild,
        roles,
        blacklist,
        matchingChannelName: botMatchingChannelName,
        botChannelCategory: botChannelCategory,
        supabase,
    })
    await message.channel.send(`Deleted previous matched channels! ✅`)
    await message.channel.send(`New matches created! ✅`)
    await message.channel.send(`---⚡🦎---`)
}
