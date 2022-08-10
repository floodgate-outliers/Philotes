import { Client, Intents, Guild, TextChannel } from 'discord.js'
import cron, { CronJob } from 'cron'
import { createClient } from '@supabase/supabase-js'

import { getNewGroups, matchUsers } from './matching'
import {
    createPrivateChannels,
    deleteMatchingChannels,
} from './discord/matchingChannels'
import getCronJob from './cron/cronJob'
import { getDayOfWeekString } from './utils/dayOfWeekTranslation'
import { getMatchingTimeFormatted } from './utils/getMatchingTimeFormatted'
import { Config } from './configType'
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })

const config: Config = {
    prefix: process.env.PREFIX as string,
    botCommunicationChannelID: process.env
        .BOT_COMMUNICATION_CHANNEL_ID as string,
    guildID: process.env.GUILD_ID as string,
    matchingChannelName: process.env.MATCHING_CHANNEL_NAME as string,
    matchingCategoryName: process.env.MATCHING_CATEGORY_NAME as string,
    blackList: ['test1', 'test2'],
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

let botStatus = 'init'
// Default to Tuesday, note days are 0 indexed (Sunday = 0)
let dayOfWeek = 2
// Default to 11 which is 11:00 UTC, 7:00 EST, :00 PST
let hour = 11
// Default to 00
let minute = 0

// Wait to initialize cron job until we want it to run
let matchingJob: cron.CronJob | undefined
let groupSize = 2
let roles: string[] = []
let collection: Collection<Document>

async function supabaseTest(): Promise<void> {
    const { data, error } = await supabase.from('guild_registry').select('*')
    console.log('error: ', error)
    console.log(data)
}

supabaseTest()

function getCronJobHelper(guild: Guild): CronJob {
    return getCronJob({
        callbackFunction: () =>
            matchUsers({
                guild,
                collection,
                config,
                dayOfWeek,
                roles,
            }),
        dayOfWeek,
        hour,
        minute,
    })
}

client.on('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`)
})

client.on('guildCreate', async (guild) => {
    if (!client) return
    // Get the first text channel where the bot is allowed to send messages
    const channelToFetch = guild.channels.cache.find((channel) =>
        channel.type === 'GUILD_TEXT' &&
        channel.permissionsFor(client.user?.id || '')?.has('SEND_MESSAGES')
            ? true
            : false
    )
    if (!channelToFetch) return
    // Get the channel and send the message
    const firstChannel = client.channels.cache.get(
        channelToFetch.id
    ) as TextChannel
    await firstChannel.send(
        `Hello! This is my first message. I see that your guild Id is ${guild.id}`
    )
})

client.on('messageCreate', async (message) => {
    // TODO: check if the the config fields for the message.guild have been loaded from Supabase

    const guild = client.guilds.cache.get(message.guildId || '')
    if (!guild) {
        return
    }

    // if the author is another bot OR the command is not in the bot communications channel OR the command doesn't start with the correct prefix => ignore
    if (
        message.author.bot ||
        // TODO: Get the channelID for the given message.guild
        message.channelId !== config.botCommunicationChannelID ||
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

    if (command === 'alive') {
        await message.channel.send('Alive')
    }

    if (command === 'help') {
        console.log('---help---')
        await message.channel.send('Available commands:')
        await message.channel.send(
            '/setRoles <name of role1> <name of role2> <name of role3> ... => members of which role should be included in the matching process'
        )
        await message.channel.send('/status => get current status of the bot')
        await message.channel.send('/pause => pause bot')
        await message.channel.send('/resume or /start => resume or start bot')
        await message.channel.send(
            '/matchOnce => deletes previous matches and creates new matches'
        )
        await message.channel.send(
            `/deleteChannels => deletes all channels under ${config.matchingCategoryName}`
        )
        await message.channel.send(
            '/setDayOfWeek <day of week 0-6> => what day of the week (Sunday-Saturday) the matching process should be triggered'
        )
        await message.channel.send(
            '/setHour <hour 0-23> => what hour (0-23) the matching process should be triggered'
        )
        await message.channel.send(
            '/setMinute <minute 0-59> => what minute (0-59) the matching process should be triggered'
        )

        // Commented out to only show commands helpful for manual matches
        // await message.channel.send(
        //     '/setInterval <int> => how often (in days) should the matching process be triggered'
        // )
        // await message.channel.send(
        //     '/setGroupSize <int> => how many members should be included in one matching group'
        // )
        // await message.channel.send('/alive => check if bot is still alive')
        // await message.channel.send(
        //     '/nextDate => get date of the next round of matching'
        // )
    }

    if (command === 'status') {
        await message.channel.send(`Status: ${botStatus}`)
        await message.channel.send(`Roles: ${roles}`)
        await message.channel.send(
            `Day of Week: ${getDayOfWeekString(dayOfWeek)}`
        )
        const timeFormatted = hour + ':' + String(minute).padStart(2, '0')
        await message.channel.send(`Time: ${timeFormatted}`)
        await message.channel.send(`GroupSize: ${groupSize}`)
    }

    if (command === 'pause') {
        botStatus = 'paused'
        await message.channel.send(`New status: ${botStatus}`)
        if (matchingJob) {
            matchingJob.stop()
        }
    }

    if (command === 'resume' || command === 'start') {
        botStatus = 'active'
        await message.channel.send(`New status: ${botStatus}`)

        // Check to see if roles are set
        if (roles.length === 0) {
            await message.channel.send(
                'No roles have been set, so no matches will be made. Run "/setRoles <name of role1> <name of role2> <name of role3> ..." to set roles'
            )
            return
        }

        if (command === 'start') {
            // Run once immediately
            await matchUsers({
                guild,
                config,
                collection,
                dayOfWeek,
                roles,
            })
        }

        if (!matchingJob) {
            matchingJob = getCronJobHelper(guild)
        }
        matchingJob.start()
        console.log('---nextDates---')
        console.log(Object.keys(matchingJob))
        // console.log(matchingJob.nextDates())
    }

    if (command === 'setRoles') {
        roles = args.split(',')
        message.reply(`New Roles: ${roles}`)
    }

    if (command === 'setDayOfWeek') {
        const newDayOfWeek = isNaN(Number(args)) ? -1 : Number(args)
        if (newDayOfWeek < 0 || newDayOfWeek > 6) {
            message.reply('Day of Week must be between 0-6, inclusive')
            return
        }
        dayOfWeek = newDayOfWeek

        if (matchingJob) {
            matchingJob.stop()
            matchingJob = getCronJobHelper(guild)
            matchingJob.start()
            message.reply('Matching time updated for upcoming round')
        }

        message.reply(getMatchingTimeFormatted({ dayOfWeek, hour, minute }))
    }

    if (command === 'setHour') {
        const newHour = isNaN(Number(args)) ? -1 : Number(args)
        if (newHour < 0 || newHour > 23) {
            message.reply('Hour must be between 0-23, inclusive')
            return
        }
        hour = newHour

        if (matchingJob) {
            matchingJob.stop()
            matchingJob = getCronJobHelper(guild)
            matchingJob.start()
            message.reply('Matching time updated for upcoming round.')
        }

        message.reply(getMatchingTimeFormatted({ dayOfWeek, hour, minute }))
    }

    if (command === 'setMinute') {
        const newMinute = isNaN(Number(args)) ? -1 : Number(args)
        if (newMinute < 0 || newMinute > 59) {
            message.reply('Minute must be between 0-59, inclusive')
            return
        }
        minute = newMinute

        if (matchingJob) {
            matchingJob.stop()
            matchingJob = getCronJobHelper(guild)
            matchingJob.start()
            message.reply('Matching time updated for upcoming round.')
        }

        message.reply(getMatchingTimeFormatted({ dayOfWeek, hour, minute }))
    }

    if (command === 'setGroupSize') {
        groupSize = Number(args[0])
        message.reply(`New group size: ${groupSize}`)
    }

    if (command === 'deleteChannels') {
        deleteMatchingChannels({ guild, config })
        message.reply(`Channels deleted.`)
    }

    if (command === 'testMatch') {
        const groups = await getNewGroups({ guild, config, collection, roles })
        console.log('Groups: ')
        console.log(groups)
        deleteMatchingChannels({ guild, config })
        // Don't impact database
        // setHistoricalPairs({ collection, pairs: groups })
        createPrivateChannels({
            guild,
            config,
            dayOfWeek,
            userIDGroups: groups,
        })
    }

    if (command === 'nextDate') {
        if (matchingJob) {
            console.log(matchingJob.nextDate().toISODate())
            message.reply(matchingJob.nextDate().toISODate())
        }
    }

    if (command === 'matchOnce') {
        await matchUsers({
            guild,
            config,
            roles,
            collection,
            dayOfWeek,
        })
        await message.channel.send(`Deleted previous matched channels! ✅`)
        await message.channel.send(`New matches created! ✅`)
        await message.channel.send(`---⚡🦎---`)
    }

    // if (command === 'datesForMonth') {
    //     if (!matchingJob) {
    //         message.reply('No matching job running')
    //         return
    //     }

    //     const datesObj = matchingJob
    //     const { dayOfMonth } = datesObj.cronTime
    //     console.log(matchingJob)
    //     let datesArray = Object.keys(dayOfMonth).map((date) => {
    //         if (dayOfMonth[date] && Number(date) >= new Date().getDate()) {
    //             return `${new Date().getMonth() + 1}/${date}`
    //         } else {
    //             return null
    //         }
    //     })
    //     datesArray = datesArray.filter((date) => date !== null)
    //     console.log(datesArray)
    //     message.reply(datesArray.join('\n'))
    // }
})

client.login(config.discordBotToken)
