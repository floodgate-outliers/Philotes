export const getDayOfWeekString = (index: number): string => {
    const dayOfWeekStrings = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
    ]

    return dayOfWeekStrings[index]
}
