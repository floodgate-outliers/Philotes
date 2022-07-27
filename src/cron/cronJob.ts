import { getCurrentDateFormatted } from '../utils/getCurrentDateFormatted'
import cron from 'cron'

/**
 * Creates a new cron job to match users
 *
 * @returns {cron.CronJob}
 */
type getCronJobArgs = {
    callbackFunction: () => void | Promise<void>
    dayOfWeek: number
    hour: number
    minute: number
}
function getCronJob({
    callbackFunction,
    dayOfWeek,
    hour,
    minute,
}: getCronJobArgs): cron.CronJob {
    console.log(`### CRON JOB SET ${getCurrentDateFormatted()} ###`)
    // return cron job with interval in seconds
    // return new cron.CronJob(
    //     `*/${interval} * * * * *`,
    // return cron job with interval in days
    // return new cron.CronJob(
    //     `0 ${minute} ${hour} */${interval} * *`,
    // return cron job with interval in days of the week
    return new cron.CronJob(
        `0 ${minute} ${hour} * * ${dayOfWeek}`,
        callbackFunction,
        () => {
            console.log('### CRON JOB STOPPED ###')
        },
        true
    )
}

export default getCronJob
