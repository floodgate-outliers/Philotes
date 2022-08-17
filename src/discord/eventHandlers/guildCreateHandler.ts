import { SupabaseClient } from '@supabase/supabase-js'
import { Client, Guild, TextChannel } from 'discord.js'
import { Guilds } from '../../database/types'
import { createBotCommunicationChannel } from '../onboarding'

type GuildCreateHandlerArgs = {
    client: Client
    supabase: SupabaseClient
    guild: Guild
    botId: string
    botChannelCategory: string
    botCommunicationChannelName: string
}

// Handles the logic for when the bot is first added to a guild
export async function guildCreateHandler({
    client,
    supabase,
    guild,
    botId,
    botChannelCategory,
    botCommunicationChannelName,
}: GuildCreateHandlerArgs) {
    // Check if guild has signed up before (aka if guild is in database)
    const { data, error: errorFetchGuild } = await supabase
        .from<Guilds>('guilds')
        .select()
        .eq('guild_id', guild.id)

    if (errorFetchGuild) {
        console.log(
            'Error when making supabase request to fetch guild. Supabase is most likely not available:',
            errorFetchGuild
        )
        return
    }

    // Create a channel for the bot to communicate with the user
    const channelId = await createBotCommunicationChannel({
        guild,
        botId,
        BotChannelCategory: botChannelCategory,
        BotCommunicationChannelName: botCommunicationChannelName,
    })

    if (data && data.length == 0) {
        // Guild is not in database
        const { error: errorInsertGuild } = await supabase
            .from<Guilds>('guilds')
            .insert({
                guild_id: guild.id,
                bot_communication_channel_id: channelId,
                active: true,
            })

        if (errorInsertGuild) {
            console.log(
                'Error when making supabase request to create a new guild. Supabase is most likely not available: ',
                errorInsertGuild
            )
            return
        }
    } else {
        // Guild already exists in supabase (bot was created and kicked out again)
        // set status active to true and bot_communication_id to new channel
        const { error: errorUpdateGuild } = await supabase
            .from<Guilds>('guilds')
            .update({ active: true, bot_communication_channel_id: channelId })
            .eq('guild_id', guild.id)

        if (errorUpdateGuild) {
            console.log(
                'Error when making supabase request to create a new guild. Supabase is most likely not available: ',
                errorUpdateGuild
            )
            return
        }
        const BotChannel = client.channels.cache.get(channelId) as TextChannel
        BotChannel.send(
            `Hey 👋, glad to have you back. PLease delete the old channel to avoid confusion for users communicating with the bot. The old won't work anymore.`
        )
    }

    // Fetch guild and continue normal onboarding flow
    const { data: dataAfterOnboarding, error: errorAfterOnboarding } =
        await supabase
            .from<Guilds>('guilds')
            .select()
            .eq('guild_id', guild.id)
            .limit(1)

    if (errorAfterOnboarding) {
        console.log(
            'Error when making supabase request after guild onboarding. Supabase is most likely not available: ',
            errorAfterOnboarding
        )
        return
    }

    // Continue normal onboarding flow

    if (dataAfterOnboarding && dataAfterOnboarding.length > 0) {
        const guildData = dataAfterOnboarding[0]
        // 2. Text: This is how the bot works
        // 3. Text: Invite new members to the channel to be able to control the bot
        // 4. Text: Before you begin: set a matching role
        // 5. Text: You can always ask for help /help or check the current status of the bot /status

        const BotChannel = client.channels.cache.get(
            guildData.bot_communication_channel_id
        ) as TextChannel

        BotChannel.send(
            `Hey 👋, This is the channel to communicate with the bot communications bot. 
          Options <>
          BlaBla`
        )
        BotChannel.send(
            `As a first step please set a matching role with the command: /setRole <Role>.`
        )
        BotChannel.send(
            `All users who have that role will be included in the next matching round.`
        )
    }
}
