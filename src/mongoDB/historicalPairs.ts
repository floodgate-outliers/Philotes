import { Collection } from 'mongodb'

/**
* Get all users' historical pairs
@param {Set<string>} userIDs
@returns {Promise<{[userId: string]: Set<string[]>}>} Object with data on each user's previous pairs
*
*/
type getHistoricalPairsArgs = {
    userIDs: Set<string>
    collection: Collection
}
export async function getHistoricalPairs({
    userIDs,
    collection,
}: getHistoricalPairsArgs): Promise<{ [userId: string]: Set<string> }> {
    console.log(userIDs)
    const pairs = {}
    for (const userID of userIDs) {
        pairs[userID] = new Set()
        const query = {
            $or: [{ user1_id: { $eq: userID } }, { user2_id: { $eq: userID } }],
        }
        const results = await collection.find(query).toArray()
        if (results.length > 0) {
            for (const result of results) {
                if (result['user1_id'] != userID) {
                    pairs[userID].add(result['user2_id'])
                } else {
                    pairs[userID].add(result['user1_id'])
                }
            }
        }
    }
    return pairs
}

/**
 * Store historical pairs in db
 *
 * @param {Promise<void>} pairs
 */
type setHistoricalPairsArgs = {
    collection: Collection
    pairs: [string[]]
}
export async function setHistoricalPairs({
    collection,
    pairs,
}: setHistoricalPairsArgs): Promise<void> {
    for (const pair of pairs) {
        const obj = {
            user1_id: pair[0],
            user2_id: pair[1],
            created_at: new Date(),
        }
        try {
            await collection.insertOne(obj)
            console.log('document inserted', obj)
        } catch (error) {
            console.log('Error inserting document:', obj)
        }
    }
    return
}
