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
    if (!guild) return
    try {
        await guild.members.fetch()
        const participatingUserIDs: Set<string> = new Set()
        for (const roleName of roles) {
            const Role = guild.roles.cache.find((role) => role.name == roleName)
            const usersWithRole: string[] = guild.roles.cache
                .get(Role.id || '')
                .members.filter((m) => {
                    if (config.blackList.includes(m.user.id)) {
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
