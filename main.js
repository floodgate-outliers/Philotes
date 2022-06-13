const cron = require('cron')
const { Client, Intents } = require('discord.js')
const config = require('./config.json')

const SQLite = require('better-sqlite3')
const sql = new SQLite('./historicalPairs.sqlite')

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
    ],
})

let status = 'init'
let interval = 7
let matchingJob = getCronJob(interval)
let groupSize = 2
let roles = []
const guild = client.guilds.cache.get(config.guildID)

function getCronJob() {
    return new cron.CronJob(`*/${interval} * * * * *`, async () => {
        // seconds
        // return new cron.CronJob(`* * * */${interval} * *`, () => { // days
        let channel = client.channels.cache.get(
            config.botCommunicationChannelID
        )
        await getNewGroups()
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

async function getHistoricalPairs(userIDs) {
    // To Do
    // const stmt = sql.prepare('SELECT * FROM pairs WHERE user1_id = ?').get(userId);
    return
}

async function getNewGroups() {
    let participatingUserIDs = await getParticipatingUserIDs()
    let historicalPairs = await getHistoricalPairs(participatingUserIDs)
    return

    // client.setScore = sql.prepare("INSERT OR REPLACE INTO pairs (id, user1_id, user2_id) VALUES (@id, @user1_id, @user2_id);");
    // => write to SQL lite db

    // console.log(row.firstName, row.lastName, row.email);

    // #### ALGO in Python #####
    // user_history = {}
    // for pair in get_pairs():
    // 		user = pair[0]
    // 		past_partner = pair[1]
    // 		if user in user_history:
    // 				user_history[user].append(past_partner)
    // 		else:
    // 				user_history[user] = [past_partner]

    // # build pairing groups
    // groups = []
    // for user in users:
    // 		if user == False:
    // 				continue
    // 		potential_partners = users.copy()
    // 		potential_partners.remove(user)
    // 		sanitized_potential_partners = list(filter(None, potential_partners))

    // 		# create a fall-back pairing
    // 		try:
    // 				pair_with = next(u for u in sanitized_potential_partners if u)

    // 		# we're at the end and there's an odd number of users
    // 		# create a trio and stop
    // 		except StopIteration:
    // 				groups[len(groups)-1].append(user)
    // 				break

    // 		# attempt to match users who haven't met
    // 		for person in sanitized_potential_partners:
    // 				if person in user_history.get(user, []):
    // 						continue
    // 				else:
    // 						pair_with = person
    // 						break

    // 		# create a group with the pair and bagelbot
    // 		groups.append([user, pair_with])

    // 		# take them out of the potential pairing pool
    // 		users[users.index(user)] = False
    // 		users[users.index(pair_with)] = False

    // return groups
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`)

    // Check if the table "pairs" exists.
    const table = sql
        .prepare(
            "SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'pairs';"
        )
        .get()
    if (!table['count(*)']) {
        // If the table isn't there, create it and setup the database correctly.
        sql.prepare(
            'CREATE TABLE pairs (id TEXT PRIMARY KEY, user1_id TEXT, user2_id TEXT);'
        ).run()
        // Ensure that the "id" row is always unique and indexed.
        sql.prepare('CREATE UNIQUE INDEX idx_users ON pairs (user1_id);').run()
        sql.pragma('synchronous = 1')
        sql.pragma('journal_mode = wal')
    }
})

client.on('messageCreate', (message) => {
    // if the author is another bot OR the command is not in the bot communications channel OR the command doesn't start with the correct prefix => ignore
    if (
        message.author.bot ||
        message.channelId !== config.botCommunicationChannelID ||
        message.content.indexOf(config.prefix) !== 0
    )
        return

    // extract command and arguments from message
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g)
    const command = args.shift()

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
        message.channel.send('/resume => resume or start bot')
        message.channel.send('/alive => check if bot is still alive')
    }

    if (command === 'status') {
        message.channel.send(`Status: ${status}`)
    }

    if (command === 'pause') {
        status = 'paused'
        message.channel.send(`New status: ${status}`)
        matchingJob.stop()
    }

    if (command === 'resume') {
        status = 'active'
        message.channel.send(`New status: ${status}`)
        matchingJob.start()
    }

    if (command === 'setRoles') {
        roles = args.slice(/ +/g)
        message.reply(`New Roles: ${roles}`)
    }

    if (command === 'setInterval') {
        let newInterval = args[0]
        interval = newInterval
        matchingJob = getCronJob()
        matchingJob.start()
        message.reply(`New interval: ${args}`)
        message.reply('Matching active')
    }

    if (command === 'setGroupSize') {
        groupSize = args[0]
        message.reply(`New group size: ${groupSize}`)
    }
})

client.login(config.token)
