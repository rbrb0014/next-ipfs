import { dbClient } from '../index.js';

export async function dataInsert(mimetype, path, cids, keys) {
  return dbClient
    .query(
      'INSERT INTO ipfsdb.data (mimetype, path, cids, keys) VALUES ($1, $2, $3::varchar[], $4::varchar[]) RETURNING *',
      [mimetype, path, cids, keys]
    )
    .then(
      (result) => {
        console.log(result.rows[0]);
        return { error: false, context: 'contents successfully saved' };
      },
      (error) => ({ error: true, context: error })
    );
}

export async function dataSelectOne(path) {
  const data = await dbClient.query(
    'SELECT * FROM ipfsdb.data WHERE path = $1 LIMIT 1',
    [path]
  );

  return data.rows[0];
}
