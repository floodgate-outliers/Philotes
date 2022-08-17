import { Client, Intents } from 'discord.js'
import { createClient } from '@supabase/supabase-js'

import { Config } from './configType'
import type { Guilds } from './database/types'
import { guildCreateHandler } from './discord/eventHandlers/guildCreateHandler'
import { messageCreateHandler } from './discord/eventHandlers/messageCreateHandler/messageCreationHandler'
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })

const config: Config = {
    prefix: process.env.COMMAND_PREFIX as string,
    supabaseApiUrl: process.env.SUPABASE_API_URL as string,
    supabaseApiKey: process.env.SUPABASE_API_KEY as string,
    discordBotToken: process.env.DISCORD_BOT_TOKEN as string,
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS, // Required to interact with guild
        Intents.FLAGS.GUILD_MESSAGES, // Required to listent to messages
        Intents.FLAGS.GUILD_MEMBERS, // Required to fetch members when creating channels
    ],
})

const supabase = createClient(config.supabaseApiUrl, config.supabaseApiKey)
const BOT_CHANNEL_CATEGORY = 'Matching-Bot-Philotes'
const BOT_COMMUNICATION_CHANNEL_NAME = 'Matching-Bot-Communication'
const BOT_MATCHING_CHANNEL_NAME = 'matches'

let botId: string

client.on('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`)
    if (client.user) {
        botId = client.user.id
    }
})

client.on('guildCreate', async (guild) => {
    if (!client) return

    await guildCreateHandler({
        client,
        supabase,
        guild,
        botId,
        botChannelCategory: BOT_CHANNEL_CATEGORY,
        botCommunicationChannelName: BOT_COMMUNICATION_CHANNEL_NAME,
    })
})

client.on('messageCreate', async (message) => {
    const guild = client.guilds.cache.get(message.guildId || '')
    // Typescript typeguard
    if (!guild) {
        return
    }

    const { data, error } = await supabase
        .from<Guilds>('guilds')
        .select()
        .eq('guild_id', message.guildId as string)

    let guildData: Guilds
    if (data && error == null && data.length > 0) {
        guildData = data[0]
        console.log(guildData)
    } else {
        console.log(
            'Guild with ID (message.guildid): ',
            message.guildId,
            "couldn't be found in supabase."
        )
        return
    }

    // if the author is another bot OR the command is not in the bot communications channel OR the command doesn't start with the correct prefix => ignore
    if (
        message.author.bot ||
        message.channelId !== guildData.bot_communication_channel_id ||
        message.content.indexOf(config.prefix) !== 0
    )
        return

    // extract command and arguments from message
    const input = message.content
        .slice(config.prefix.length)
        .trim()
        .split(/ +/g)
    const command = input.shift()
    const args = input.join(' ')

    // log command and arg on console (for debugging)
    console.log('Command: ', command)
    console.log('Args: ', args)

    if (!command) return

    await messageCreateHandler({
        args,
        botChannelCategory: BOT_CHANNEL_CATEGORY,
        botId,
        botMatchingChannelName: BOT_MATCHING_CHANNEL_NAME,
        command,
        guild,
        guildData,
        message,
        supabase,
    })
})

client.login(config.discordBotToken)
