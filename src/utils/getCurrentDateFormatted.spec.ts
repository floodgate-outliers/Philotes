import { getCurrentDateFormatted } from './getCurrentDateFormatted'

describe('getCurrentDateFormatted', () => {
    describe('when date is 7:00am on July 9, 2022', () => {
        it('formats date to be 7/9/22 @ 7:00:00', () => {
            const date = new Date('7-9-2022 7:00')
            console.log(date)
            expect(getCurrentDateFormatted(date)).toBe('7/9/2022 @ 7:00:00')
        })
    })
})
