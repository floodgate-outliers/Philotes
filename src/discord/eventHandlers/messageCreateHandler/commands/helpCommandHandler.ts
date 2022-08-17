import { Message } from 'discord.js'

type HelpCommandHandlerArgs = {
    message: Message
    botChannelCategory: string
}

export async function helpCommandHandler({
    message,
    botChannelCategory,
}: HelpCommandHandlerArgs) {
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
        `/deleteChannels => deletes all channels under ${botChannelCategory} except the channel to communicate with the bot.`
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
}
