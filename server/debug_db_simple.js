const db = require('better-sqlite3')('pos.db');

const shifts = db.prepare('SELECT * FROM shifts').all();
console.log('SHIFTS:', JSON.stringify(shifts, null, 2));

const sales = db.prepare('SELECT COUNT(*) as count FROM sales').get();
console.log('SALES COUNT:', sales.count);
