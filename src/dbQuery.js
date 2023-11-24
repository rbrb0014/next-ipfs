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

export async function dataInsert(mimetype, path, cids, keys, localpaths) {
  return dbClient
    .query(
      'INSERT INTO ipfsdb.data (mimetype, path, cids, keys, localpaths) VALUES ($1, $2, $3::varchar[], $4::varchar[], $5::varchar[]) RETURNING *',
      [mimetype, path, cids, keys, localpaths]
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
  return dbClient
    .query('SELECT * FROM ipfsdb.data WHERE path = $1 LIMIT 1', [path])
    .then(
      (data) => {
        if (data.rows.length == 1) return data.rows[0];
        else throw new Error(`존재하지 않는 데이터 검색: ${path}`);
      },
      (err) => {
        if (err) {
          console.log('존재하지 않는 파일입니다. 경로: ', path);
          throw err;
        }
      }
    );
}

export async function dataClear() {
  return dbClient.query('DELETE FROM ipfsdb.data RETURNING *').then(
    (result) => {
      console.log(`delete ${result.rowCount} data`);
      return result.rows;
    },
    (err) => {
      if (err) throw err;
    }
  );
}
