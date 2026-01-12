// Check telegram chats
import { query } from './postgres.js'

async function check() {
    try {
        const chats = await query('SELECT * FROM telegram_chats')
        console.log('Telegram chats:', chats.rows.length)
        console.log(chats.rows)

        if (chats.rows.length === 0) {
            console.log('\n⚠️  No Telegram chats linked!')
            console.log('To link a chat:')
            console.log('1. Add bot @adekerzbot to your Telegram group')
            console.log('2. Send /link HOTEL_CODE in the group')
        }

        process.exit(0)
    } catch (error) {
        console.error('Error:', error)
        process.exit(1)
    }
}

check()
