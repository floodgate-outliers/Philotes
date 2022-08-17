import { getDayOfWeekString } from './dayOfWeekTranslation'

type getMatchingTimeFormattedArgs = {
    dayOfWeek: number
    hour: number
    minute: number
}

export const getMatchingTimeFormatted = ({
    dayOfWeek,
    hour,
    minute,
}: getMatchingTimeFormattedArgs) => {
    return (
        `New matching time: ${getDayOfWeekString(dayOfWeek)}'s @ ${hour}:` +
        String(minute).padStart(2, '0') +
        ' UTC'
    )
}
