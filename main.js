require('dotenv').config()
const cron = require('cron')
const { Client, Intents, Permissions } = require('discord.js')
const { MongoClient } = require('mongodb')

let config

if (process.env.ENV == 'dev') {
    config = require('./config_dev.json')
    console.log('load dev config')
} else {
    config = require('./config.json')
    console.log('load prod config')
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
    ],
})

let status = 'init'
let interval = 7
let matchingJob = getCronJob()
let groupSize = 2
let roles = []
// Wait to load guild and roles until bot is ready
let guild
let collection

async function initDB() {
    const dbName = 'outliers_mongo'
    const dbClient = new MongoClient(process.env.MONGO_URL)
    await dbClient.connect()
    console.log('Connected successfully to server: ', process.env.MONGO_URL)
    const db = dbClient.db(dbName)
    collection = db.collection('pairs')
}
initDB()

function getCronJob() {
    // return cron job with interval in seconds
    // return new cron.CronJob(`*/${interval} * * * * *`, async () => {
    // return cron job with interval in days
    return new cron.CronJob(`* * * */${interval} * *`, async () => {
        let groups = await getNewGroups()
        console.log('Groups: ')
        console.log(groups)
        setHistoricalPairs(groups)
        deleteMatchingChannels()
        createPrivateChannels(groups)
    })
}

async function getParticipatingUserIDs() {
    try {
        await guild.members.fetch()
        let participatingUserIDs = new Set()
        console.log('Roles', roles)

        roles.forEach((roleName) => {
            const Role = guild.roles.cache.find((role) => role.name == roleName)
            usersWithRole = guild.roles.cache
                .get(Role.id)
                .members.map((m) => m.user.id)
            usersWithRole.forEach((user) => {
                participatingUserIDs.add(user)
            })
        })

        return participatingUserIDs
    } catch (err) {
        console.error(err)
    }
    return
}

/**
 * Store historical pairs in db
 *
 * @param {[[]]} pairs
 */
function setHistoricalPairs(pairs) {
    pairs.forEach((p) => {
        var pair = { user1_id: p[0], user2_id: p[1] }
        collection.insertOne(pair, function (err, res) {
            if (err) throw err
            console.log('document inserted', pair)
        })
    })
}

/**
 * Get all users' historical pairs
 *
 * @param {string[]} userIDs
 * @returns {{[userID: string]: Set}} Object with data on each user's previous pairs
 */
function getHistoricalPairs(userIDs) {
    let pairs = {}
    userIDs.forEach(async (userID) => {
        pairs[userID] = new Set()
        const query = {
            $or: [{ user1_id: { $eq: userID } }, { user2_id: { $eq: userID } }],
        }
        const cursor = collection.find(query)
        const results = await cursor.toArray()
        if (results.length > 0) {
            results.forEach((result) => {
                if (result['user1_id'] != userID) {
                    pairs[userID].add(result['user2_id'])
                } else {
                    pairs[userID].add(result['user1_id'])
                }
            })
        }
    })
    return pairs
}

/**
 * Helper function to delete all private channels
 */
async function deleteMatchingChannels() {
    let channels = client.channels.cache.filter(
        (channel) => channel.name === config.matchingChannelName
    )
    channels = Array.from(channels.values())
    for (let i = 0; i < channels.length; i++) {
        channels[i].delete()
    }
}

/**
 * Fischer-Yates Shuffle Algorithm
 *
 * @param {[Array]} array
 * @returns {Array} Shuffled array
 */
function shuffle(array) {
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
 * @returns {[string[]]} New groups of the form [[user_1_ID, user_2_ID], [user_3_ID, user_4_ID], ...]
 */
async function getNewGroups() {
    let participatingUserIDs = await getParticipatingUserIDs()
    console.log(participatingUserIDs)
    let historicalPairs = getHistoricalPairs(participatingUserIDs)
    // Can use simple data below for basic testing until getParticipatingUserIDs() is implemented
    // let participatingUserIDs = ['0', '1', '2', '3', '4', '5']
    // let historicalPairs = {
    //     2: new Set('3'),
    //     3: new Set('2'),
    // }
    let newGroups = []
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
        let newPairingID

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

    // client.setScore = sql.prepare("INSERT OR REPLACE INTO pairs (id, user1_id, user2_id) VALUES (@id, @user1_id, @user2_id);");
    // => write to SQL lite db
}

/**
 * Create private channels with the paired users
 *
 * @param {[string[]]} userIDGroups Array of grouped User ID's of the form [[user_1_ID, user_2_ID], [user_3_ID, user_4_ID], ...]
 * @returns {void}
 */
async function createPrivateChannels(userIDGroups) {
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
        const userPermissionOverWrites = userIDPair.map((userID) => {
            return {
                type: 'member',
                id: userID,
                allow: Permissions.ALL,
            }
        })
        // Create private channel
        let channel = await guild.channels.create(config.matchingChannelName, {
            parent: channelCategory.id,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone,
                    deny: Permissions.ALL,
                },
                // Add the overwrites for the pair of users
                ...userPermissionOverWrites,
            ],
        })
        console.log(channel.channels)
        const userIDTag = userIDPair.map((userID) => `<@${userID}>`).join(' ')
        client.channels.cache.get(channel.id).send(`
        Hey ${userIDTag} 👋,
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
    let input = message.content.slice(config.prefix.length).trim().split(/ +/g)
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
        message.channel.send(`Status: ${status}`)
        message.channel.send(`Roles: ${roles}`)
        message.channel.send(`Interval: ${interval}`)
        message.channel.send(`GroupSize: ${groupSize}`)
    }

    if (command === 'pause') {
        status = 'paused'
        message.channel.send(`New status: ${status}`)
        matchingJob.stop()
    }

    if (command === 'resume' || command === 'start') {
        status = 'active'
        message.channel.send(`New status: ${status}`)

        let groups = await getNewGroups()
        console.log('Groups: ')
        console.log(groups)
        deleteMatchingChannels()
        setHistoricalPairs(groups)
        createPrivateChannels(groups)

        matchingJob.start()
    }

    if (command === 'setRoles') {
        roles = args.split(',')
        message.reply(`New Roles: ${roles}`)
    }

    if (command === 'setInterval') {
        let newInterval = args[0]
        interval = newInterval
        matchingJob.stop()
        matchingJob = getCronJob()
        matchingJob.start()
        message.reply(`New interval: ${args}`)
        message.reply('Matching restarted.')
    }

    if (command === 'setGroupSize') {
        groupSize = args[0]
        message.reply(`New group size: ${groupSize}`)
    }

    if (command === 'deleteChannels') {
        deleteMatchingChannels()
        message.reply(`Channels deleted.`)
    }

    if (command === 'testMatch') {
        let groups = await getNewGroups()
        console.log('Groups: ')
        console.log(groups)
        deleteMatchingChannels()
        setHistoricalPairs(groups)
        createPrivateChannels(groups)
    }
})

client.login(process.env.TOKEN)
