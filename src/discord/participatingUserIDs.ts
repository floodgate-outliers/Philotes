import { Guild } from 'discord.js'
import { Config } from '../../config/configType'

type getParticipatingUserIDsArgs = {
    guild: Guild
    roles: string[]
    config: Config
}

export async function getParticipatingUserIDs({
    guild,
    roles,
    config,
}: getParticipatingUserIDsArgs): Promise<Set<string>> {
    if (!guild) return new Set<string>()
    try {
        await guild.members.fetch()
        const participatingUserIDs: Set<string> = new Set()
        for (const roleName of roles) {
            const roleData = guild.roles.cache.find(
                (role) => role.name == roleName
            )
            if (!roleData) continue
            const filteredUsersWithRole = roleData.members
                .filter((m) => !config.blackList.includes(m.user.id))
                .map((m) => m.user.id)
            for (const user of filteredUsersWithRole) {
                participatingUserIDs.add(user)
            }
        }

        return participatingUserIDs
    } catch (err) {
        console.error(err)
    }
    return new Set<string>()
}
