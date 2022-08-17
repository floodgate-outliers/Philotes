/**
 * Get the current date in a nicely formatted string
 *
 * @returns {string} Current date formatted as 'MM/DD/YYYY @ hh:mm:ss'
 */
export function getCurrentDateFormatted(date?: Date): string {
    const currDate = date || new Date()
    const minutes = String(currDate.getMinutes()).padStart(2, '0')
    const seconds = String(currDate.getSeconds()).padStart(2, '0')
    const currDateFormatted = `${
        currDate.getMonth() + 1
    }/${currDate.getDate()}/${currDate.getFullYear()} @ ${currDate.getHours()}:${minutes}:${seconds}`
    return currDateFormatted
}
