import { CronJob } from 'cron'
import getCronJob from './cronJob'

// Sunday, 7-24-2022 9:00am UTC
// Sunday, 7-24-2022 5:00am EST
// Sunday, 7-24-2022 2:00am PST
const startingDate = new Date('7-24-2022 09:00:00')

// Defaults
// Tuesday
const dayOfWeek = 2
// 11:00:00 UTC, 7:00:00 EST, 4:00:00 PST
const hour = 11
const minute = 0

jest.useFakeTimers()

const mockedCallbackFunction = jest.fn()
afterEach(() => {
    mockedCallbackFunction.mockClear()
})

describe('cronJob', () => {
    describe('getCronJob', () => {
        let msUntilNextInterval: number
        const msInWeek = 7 * 24 * 60 * 60 * 1000
        let cronJob: CronJob

        beforeEach(() => {
            // Reset the time
            jest.setSystemTime(startingDate)
            console.log(startingDate.toISOString())
            // Set the cronjob
            cronJob = getCronJob({
                callbackFunction: mockedCallbackFunction,
                dayOfWeek,
                hour,
                minute,
            })
            // Calculate time until next interval in milliseconds
            // 1 day, 15 hours + 11 hours
            msUntilNextInterval =
                (1 * 24 * 60 * 60 + (15 + 11) * 60 * 60) * 1000
        })

        afterEach(() => {
            cronJob.stop()
        })

        it('fires callback function once at next occurence of interval (i.e. next Tuesday)', () => {
            // Initially the callback function should not be called
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(0)

            // Time travel to Tuesday, 7-26-2022 00:00:00
            jest.advanceTimersByTime(msUntilNextInterval)

            // The callback function should have been called once
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(1)
        })

        it('fires callback function over 10 times over 10 weeks after initial call', () => {
            // Initially the callback function should not be called
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(0)

            // Time travel to Tuesday, 7-26-2022 00:00:00
            jest.advanceTimersByTime(msUntilNextInterval)

            // The callback function should have been called once
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(1)

            // Time travel over the next 10 weeks
            jest.advanceTimersByTime(msInWeek * 10)

            expect(mockedCallbackFunction).toHaveBeenCalledTimes(10 + 1)
        })

        it('fires callback function correctly during month changes', () => {
            // Initially the callback function should not be called
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(0)

            // Time travel to Tuesday, 7-26-2022 11:00:00
            jest.advanceTimersByTime(msUntilNextInterval)

            // Time travel to Tuesday, 8-02-2022 11:00:00
            jest.advanceTimersByTime(msInWeek)

            // The callback function should have been called twice
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(2)
        })

        it('fires callback function at specified hour in utc', () => {
            cronJob.stop()

            // Set time to run at 11:00:00 UTC => 8:00:00 UTC
            cronJob = getCronJob({
                callbackFunction: mockedCallbackFunction,
                dayOfWeek,
                hour: 8,
                minute,
            })

            // Initially the callback function should not be called
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(0)

            // Time travel to 7-26-2022 8:00:00
            // 1 day, 15 hours + 8 hours
            const newMsUntilNextInterval =
                (1 * 24 * 60 * 60 + (15 + 8) * 60 * 60) * 1000
            jest.advanceTimersByTime(newMsUntilNextInterval)

            // The callback function should have been called once
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(1)
        })

        it('fires callback function at specified minute in utc', () => {
            cronJob.stop()

            // Set time to run at 11:00:00 UTC => 11:30:00 UTC
            cronJob = getCronJob({
                callbackFunction: mockedCallbackFunction,
                dayOfWeek,
                hour,
                minute: 30,
            })

            // Initially the callback function should not be called
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(0)

            // Time travel to 7-26-2022 11:00:00
            // 1 day, 15 hours + 11 hours
            const newMsUntilNextInterval =
                (1 * 24 * 60 * 60 + (15 + 11) * 60 * 60) * 1000
            jest.advanceTimersByTime(newMsUntilNextInterval)

            // The callback function should not have been called yet
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(0)

            // Time travel to 7-26-2022 11:30:00
            jest.advanceTimersByTime(30 * 60 * 1000)

            // The callback function should have been called once
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(1)
        })

        it('fires callback function at updated time', () => {
            cronJob.stop()

            // Update minute 0 => 59
            cronJob = getCronJob({
                callbackFunction: mockedCallbackFunction,
                dayOfWeek,
                hour,
                minute: 59,
            })

            // Time travel to 7-26-2022 11:00:00
            // 1 day, 15 hours + 11 hours
            const newMsUntilNextInterval =
                (1 * 24 * 60 * 60 + (15 + 11) * 60 * 60) * 1000
            jest.advanceTimersByTime(newMsUntilNextInterval)

            // The callback function should not be called at the previously set time
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(0)

            jest.advanceTimersByTime(59 * 60 * 1000)

            // The callback function should be called at the newly set time
            expect(mockedCallbackFunction).toHaveBeenCalledTimes(1)
        })
    })
})
