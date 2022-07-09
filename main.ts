import {
    Client,
    Intents,
    Permissions,
    Guild,
    OverwriteResolvable,
} from 'discord.js'
import { MongoClient, Collection, Document } from 'mongodb'
import cron from 'cron'

import devConfig from './config_dev.json'
import prodConfig from './config.json'
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
 * Get the current date in a nicely formatted string
 *
 * @returns {string} Current date formatted as 'MM/DD/YYYY @ hh:mm:ss'
 */
function getCurrentDateFormatted(): string {
    const currDate = new Date()
    const currDateFormatted = `${
        currDate.getMonth() + 1
    }/${currDate.getDate()}/${currDate.getFullYear()} @ ${currDate.getHours()}:${currDate.getMinutes()}:${currDate.getSeconds()}`
    return currDateFormatted
}

/**
 * Helper function to match users
 *
 * @returns {Promise<void>}
 */
async function matchUsers(): Promise<void> {
    console.log(
        `### START NEXT MATCHING ROUND ${getCurrentDateFormatted()} ###`
    )
    const groups = await getNewGroups()
    console.log('Groups: ')
    console.log(groups)
    await setHistoricalPairs(groups)
    await deleteMatchingChannels()
    await createPrivateChannels(groups)
}

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
        matchUsers,
        () => {
            console.log('### CRON JOB STOPPED ###')
        },
        true
    )
}

async function getParticipatingUserIDs(): Promise<Set<string>> {
    if (!guild) return
    try {
        await guild.members.fetch()
        const participatingUserIDs: Set<string> = new Set()
        console.log('Roles', roles)

        for (const roleName of roles) {
            const Role = guild.roles.cache.find((role) => role.name == roleName)
            const usersWithRole: string[] = guild.roles.cache
                .get(Role.id || '')
                .members.filter((m) => {
                    if (!config.blackList.includes(m.user.id)) {
                        return false
                    }
                    return true
                })
                .map((m) => m.user.id)
            for (const user of usersWithRole) {
                participatingUserIDs.add(user)
            }
        }

        return participatingUserIDs
    } catch (err) {
        console.error(err)
    }
    return
}

/**
 * Store historical pairs in db
 *
 * @param {Promise<void>} pairs
 */
async function setHistoricalPairs(pairs: [string[]]): Promise<void> {
    for (const pair of pairs) {
        const obj = { user1_id: pair[0], user2_id: pair[1] }
        try {
            await collection.insertOne(obj)
            console.log('document inserted', obj)
        } catch (error) {
            console.log('Error inserting document:', obj)
        }
    }
    return
}

/**
 * Get all users' historical pairs
 @param {Set<string>} userIDs
 @returns {Promise<{[userId: string]: Set<string[]>}>} Object with data on each user's previous pairs
 *
 */
async function getHistoricalPairs(
    userIDs: Set<string>
): Promise<{ [userId: string]: Set<string[]> }> {
    console.log(userIDs)
    const pairs = {}
    for (const userID of userIDs) {
        pairs[userID] = new Set()
        const query = {
            $or: [{ user1_id: { $eq: userID } }, { user2_id: { $eq: userID } }],
        }
        const results = await collection.find(query).toArray()
        if (results.length > 0) {
            for (const result of results) {
                if (result['user1_id'] != userID) {
                    pairs[userID].add(result['user2_id'])
                } else {
                    pairs[userID].add(result['user1_id'])
                }
            }
        }
    }
    return pairs
}

/**
 * Helper function to delete all private channels
 *
 * @returns {Promise<void>}
 */
async function deleteMatchingChannels(): Promise<void> {
    const matchingChannels = guild.channels.cache.filter(
        (channel) => channel.name === config.matchingChannelName
    )
    const matchingChannelsArray = Array.from(matchingChannels.values())
    for (let i = 0; i < matchingChannelsArray.length; i++) {
        await matchingChannelsArray[i].delete()
    }
}

/**
 * Fischer-Yates Shuffle Algorithm
 *
 * @param {[]} array
 * @returns {[]} Shuffled array
 */
function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = array[i]
        array[i] = array[j]
        array[j] = temp
    }
    return array
}

/**
 * Constructs new groups based on historical pairs
 * https://lifeat.tails.com/how-we-made-bagelbot/
 *
 * @returns {Promise<[string[]]>} New groups of the form [[user_1_ID, user_2_ID], [user_3_ID, user_4_ID], ...]
 */
async function getNewGroups(): Promise<[string[]]> {
    const participatingUserIDs = await getParticipatingUserIDs()
    console.log(participatingUserIDs)
    const historicalPairs = getHistoricalPairs(participatingUserIDs)
    // Can use simple data below for basic testing until getParticipatingUserIDs() is implemented
    // let participatingUserIDs = ['0', '1', '2', '3', '4', '5']
    // let historicalPairs = {
    //     2: new Set('3'),
    //     3: new Set('2'),
    // }
    const newGroups: [string[]] = [] as unknown as [string[]]
    // Convert set to an array to allow for shuffling
    let unpairedUserIDs = Array.from(participatingUserIDs)
    unpairedUserIDs = shuffle(unpairedUserIDs)
    // Keep track of users that have been paired
    const pairedUsersStatus = new Array(unpairedUserIDs.length).fill(false)
    for (let i = 0; i < unpairedUserIDs.length; i++) {
        if (pairedUsersStatus[i]) {
            // The user has been paired already
            continue
        }

        // This is the user for which we will try to find a pair
        const userID = unpairedUserIDs[i]

        // Get all other users that are unpaired
        const filteredUnpairedIDs = unpairedUserIDs.filter(
            (id, index) => id !== userID && !pairedUsersStatus[index]
        )

        // Keep track of the ID to pair the user with (either fall-back or successful pairing of users that have not met)
        let newPairingID: string

        // If there are only 2 or 3 people left, there exists only one possible pairing
        if (
            filteredUnpairedIDs.length === 2 ||
            filteredUnpairedIDs.length === 1
        ) {
            newGroups.push([userID, ...filteredUnpairedIDs])
            break
        }

        // Fall-back pairing
        newPairingID = filteredUnpairedIDs[0]

        // User's previous pairs
        const userHistoricalPairs = historicalPairs[userID]
        // Attempt to pair users who have not met
        for (const potentialPairingID of filteredUnpairedIDs) {
            // Check to see if the users have met before
            if (
                userHistoricalPairs &&
                userHistoricalPairs.has(potentialPairingID)
            ) {
                continue
            } else {
                // The pair has not met yet so assign them together
                newPairingID = potentialPairingID
                break
            }
        }
        newGroups.push([userID, newPairingID])

        // Mark the users as paired
        pairedUsersStatus[i] = true
        pairedUsersStatus[unpairedUserIDs.indexOf(newPairingID)] = true
    }

    return newGroups
}

/**
 * Create private channels with the paired users
 *
 * @param {[string[]]} userIDGroups Array of grouped User ID's of the form [[user_1_ID, user_2_ID], [user_3_ID, user_4_ID], ...]
 * @returns {Promise<void>}
 */
async function createPrivateChannels(userIDGroups: [string[]]): Promise<void> {
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
            await matchUsers()
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
        deleteMatchingChannels()
        message.reply(`Channels deleted.`)
    }

    if (command === 'testMatch') {
        const groups = await getNewGroups()
        console.log('Groups: ')
        console.log(groups)
        deleteMatchingChannels()
        setHistoricalPairs(groups)
        createPrivateChannels(groups)
    }

    if (command === 'nextDate') {
        if (matchingJob) {
            // const datesObj = matchingJob.nextDate()
            // const { dayOfMonth } = datesObj.cronTime
            // console.log(dayOfMonth)
            // let datesArray = Object.keys(dayOfMonth).map((date) => {
            //     if (dayOfMonth[date] && Number(date) >= new Date().getDate()) {
            //         return `${new Date().getMonth() + 1}/${date}`
            //     } else {
            //         return null
            //     }
            // })
            // datesArray = datesArray.filter((date) => date !== null)
            // console.log(datesArray)
            // message.reply(datesArray.join('\n'))
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
