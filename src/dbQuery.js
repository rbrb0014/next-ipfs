import pg from 'pg';

export class DBClientORM {
  dbClient = null;
  constructor({ type, database, host, port, user, password }) {
    if (type === 'postgres')
      this.dbClient = new PGClient({
        database,
        host,
        port,
        user,
        password,
      });
    else throw new Error('지원하지 않는 DB 타입입니다.');

    this.connect = this.dbClient.connect;
    this.dataInsert = this.dbClient.dataInsert;
    this.dataSelectOne = this.dbClient.dataSelectOne;
    this.dataClear = this.dbClient.dataClear;

    return this;
  }
}

class PGClient {
  dbClient = null;
  constructor({ database, host, port, user, password }) {
    if (this.dbClient == null)
      this.dbClient = new pg.Client({
        database,
        host,
        port,
        user,
        password,
      });
    else console.log('이미 존재하는 db정보입니다');

    return this;
  }

  connect() {
    this.dbClient.connect((error) => {
      if (error) console.error('connection error', error.stack);
      else console.log('postgresql connected');
    });
  }

  async dataInsert(mimetype, path, cids, keys, localpaths) {
    return this.dbClient
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

  async dataSelectOne(path) {
    return this.dbClient
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

  dataClear() {
    return this.dbClient.query('DELETE FROM ipfsdb.data RETURNING *').then(
      (result) => {
        console.log(`delete ${result.rowCount} data`);
        return result.rows;
      },
      (err) => {
        if (err) throw err;
      }
    );
  }
}
