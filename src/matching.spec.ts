import { matchingHelper } from './matching'

describe('matching', () => {
    describe('matchingHelper', () => {
        describe('when matching even number of users', () => {
            const participatingUserIDs = [
                '0',
                '1',
                '2',
                '3',
                '4',
                '5',
                '6',
                '7',
                '8',
                '9',
            ]
            let matches: [string[]]
            beforeAll(() => {
                matches = matchingHelper({
                    participatingUserIDs: new Set(participatingUserIDs),
                    historicalPairs: {},
                })
            })
            it('pairs users in groups of 2', () => {
                const pairMatches = matches.filter(
                    (match) => match.length === 2
                )
                expect(matches.length).toBe(pairMatches.length)
            })
            it('pairs all', () => {
                const matchedIds: string[] = []
                matches.forEach((pair) => matchedIds.push(...pair))
                matchedIds.sort()
                expect(matchedIds).toStrictEqual(participatingUserIDs)
            })
        })
    })
})
