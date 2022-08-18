import { SupabaseClient } from '@supabase/supabase-js'
import { Guild, Message } from 'discord.js'
import { Guilds } from '../../../../database/types'

type SetRolesCommandHandlerArgs = {
    args: string
    guild: Guild
    message: Message
    supabase: SupabaseClient
}

export async function setRolesCommandHandler({
    args,
    guild,
    message,
    supabase,
}: SetRolesCommandHandlerArgs) {
    const roles = args.split(',').map((role) => role.trim())

    if (roles.length === 0) {
        message.reply(
            'Please provide at least one role as an argument: /setRoles <Role>'
        )
    }

    // Check to see if the roles actually exists
    for (const roleName of roles) {
        const role = guild.roles.cache.find(
            (cachedRole) => cachedRole.name === roleName
        )
        console.log('roles...', role?.name, roleName)
        if (!role) {
            message.reply(
                `The role "${roleName}" does not exist, please double check for typos`
            )
            return
        }
    }

    const { error } = await supabase
        .from<Guilds>('guilds')
        .update({ matching_roles: roles })
        .eq('guild_id', guild.id)

    if (error) {
        console.log(
            'Error updating roles of guild: ',
            guild.id,
            'in supabase.',
            error
        )
    } else {
        message.reply(`New Roles: ${roles}`)
    }
}
