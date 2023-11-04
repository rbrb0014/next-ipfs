import pg from 'pg';
import 'dotenv/config';

const dbClient = new pg.Client({
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

dbClient.connect((error) => {
  if (error) console.error('connection error', error.stack);
  else console.log('postgresql connected');
});

export async function dataInsert(mimetype, path, cids, keys) {
  return dbClient
    .query(
      'INSERT INTO ipfsdb.data (mimetype, path, cids, keys) VALUES ($1, $2, $3::varchar[], $4::varchar[]) RETURNING *',
      [mimetype, path, cids, keys]
    )
    .then(
      (result) => {
        console.log('data inserted. path :', result.rows[0].path);
        return 'contents successfully saved';
      },
      (error) => {
        console.error('data insert error :', error.stack);
        return 'error occurred';
      }
    );
}

export async function dataSelectOne(path) {
  const data = await dbClient.query(
    'SELECT * FROM ipfsdb.data WHERE path = $1 LIMIT 1',
    [path]
  );

  return data.rows[0];
}

export async function dataClear() {
  const result = await dbClient.query('DELETE FROM ipfsdb.data RETURNING *');
  console.log(`delete ${result.rowCount} data`);
  return result.rows;
}
