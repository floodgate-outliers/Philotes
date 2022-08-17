import { SupabaseClient } from '@supabase/supabase-js'
import { Guild, Message } from 'discord.js'
import { Guilds } from '../../../../database/types'

type SetBlacklistHandlerArgs = {
    guildData: Guilds
    message: Message
    args: string
    supabase: SupabaseClient
    guild: Guild
}

export async function setBlacklistHandler({
    guildData,
    message,
    args,
    supabase,
    guild,
}: SetBlacklistHandlerArgs) {
    const blacklistedMembers = args.split(',')

    if (blacklistedMembers.length === 0) {
        message.reply(
            'Please provide at least one user ID as an argument: /setBlacklist <user ID>'
        )
    }

    const blacklist = guildData.blacklist
    message.reply(`Old Blacklist: ${JSON.stringify(blacklist)} `)

    const { error } = await supabase
        .from<Guilds>('guilds')
        .update({ blacklist: blacklistedMembers })
        .eq('guild_id', guild.id)
    if (error) {
        console.log(
            'Error updating blacklist of guild: ',
            guild.id,
            'in supabase.',
            error
        )
    } else {
        message.reply(`New Blacklist: ${blacklistedMembers}`)
    }
}
