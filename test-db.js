const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Shashvat%401234@db.bhwmbcdlrsrbxwmzqohf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected!');
    
    const res = await client.query('SELECT NOW()');
    console.log(res.rows[0]);
    
    await client.end();
  } catch (err) {
    console.error('Connection error', err.stack);
  }
}

test();
