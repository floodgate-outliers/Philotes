import { Client, Intents, Guild } from 'discord.js'
import { MongoClient, Collection, Document } from 'mongodb'
import cron from 'cron'

import devConfig from '../config/config_dev.json'
import prodConfig from '../config/config.json'
import { getCurrentDateFormatted } from './utils/getCurrentDateFormatted'
import { getNewGroups, matchUsers } from './matching'
import {
    createPrivateChannels,
    deleteMatchingChannels,
} from './discord/matchingChannels'
import { setHistoricalPairs } from './mongoDB/historicalPairs'
require('dotenv').config()

let config = devConfig
if (process.env.ENV == 'dev') {
    config = devConfig
    console.log('load dev config')
} else {
    config = prodConfig
    console.log('load prod config')
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
    ],
})

let botStatus = 'init'
let interval = 7
// Wait to initialize cron job until we want it to run
let matchingJob: cron.CronJob | undefined
let groupSize = 2
let roles = []
// Wait to load guild and roles until bot is ready
let guild: Guild | undefined
let collection: Collection<Document>

async function initDB(): Promise<void> {
    const dbName = 'outliers_mongo'
    const dbClient = new MongoClient(process.env.MONGO_URL || '')
    await dbClient.connect()
    console.log('Connected successfully to server: ', process.env.MONGO_URL)
    const db = dbClient.db(dbName)
    collection = db.collection('pairs')
}
initDB()

/**
 * Creates a new cron job to match users
 *
 * @returns {cron.CronJob}
 */
function getCronJob(): cron.CronJob {
    console.log(`### CRON JOB SET ${getCurrentDateFormatted()} ###`)
    // return cron job with interval in seconds
    // return new cron.CronJob(
    //     `*/${interval} * * * * *`,
    // return cron job with interval in days
    return new cron.CronJob(
        `0 0 8 */${interval} * *`,
        // return cron job with interval in days of the week
        // return new cron.CronJob(
        //     `0 0 8 * * 3`,
        () =>
            matchUsers({
                guild,
                collection,
                config,
                interval,
                roles,
            }),
        () => {
            console.log('### CRON JOB STOPPED ###')
        },
        true
    )
}

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`)

    guild = client.guilds.cache.get(config.guildID)
})

client.on('messageCreate', async (message) => {
    // if the author is another bot OR the command is not in the bot communications channel OR the command doesn't start with the correct prefix => ignore
    if (
        message.author.bot ||
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
    console.log(args)

    // log command and arg on console (for debugging)
    console.log('Command: ', command)
    console.log('Args: ', args)

    if (command === 'alive') {
        message.channel.send('Alive')
    }

    if (command === 'help') {
        message.channel.send('Available commands:')
        message.channel.send(
            '/setRoles <name of role1> <name of role2> <name of role3> ... => members of which role should be included in the matching process'
        )
        message.channel.send(
            '/setInterval <int> => how often (in days) should the matching process be triggered'
        )
        message.channel.send(
            '/setGroupSize <int> => how many members should be included in one matching group'
        )
        message.channel.send('/status => get current status of the bot')
        message.channel.send('/pause => pause bot')
        message.channel.send('/resume or /start => resume or start bot')
        message.channel.send('/alive => check if bot is still alive')
    }

    if (command === 'status') {
        message.channel.send(`Status: ${botStatus}`)
        message.channel.send(`Roles: ${roles}`)
        message.channel.send(`Interval: ${interval}`)
        message.channel.send(`GroupSize: ${groupSize}`)
    }

    if (command === 'pause') {
        botStatus = 'paused'
        message.channel.send(`New status: ${botStatus}`)
        if (matchingJob) {
            matchingJob.stop()
        }
    }

    if (command === 'resume' || command === 'start') {
        botStatus = 'active'
        message.channel.send(`New status: ${botStatus}`)

        if (command === 'start') {
            // Run once immediately
            await matchUsers({
                guild,
                config,
                collection,
                interval,
                roles,
            })
        }

        if (!matchingJob) {
            matchingJob = getCronJob()
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

    if (command === 'setInterval') {
        const newInterval = args[0]
        interval = Number(newInterval)
        if (matchingJob) {
            matchingJob.stop()
        }
        matchingJob = getCronJob()
        matchingJob.start()
        message.reply(`New interval: ${args}`)
        message.reply('Matching restarted.')
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
        setHistoricalPairs({ collection, pairs: groups })
        createPrivateChannels({ guild, config, interval, userIDGroups: groups })
    }

    if (command === 'nextDate') {
        if (matchingJob) {
            console.log(matchingJob.nextDate().toISODate())
            message.reply(matchingJob.nextDate().toISODate())
        }
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

client.login(process.env.TOKEN)
