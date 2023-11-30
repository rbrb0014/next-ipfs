import pg from 'pg';

export class DBClientORM {
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
  }

  // 함수 직접연결 하려했으나 this의 지칭이 달라져 채택하지 않음
  connect = () => this.dbClient.connect();
  dataInsert = (mimetype, path, cids, keys, localpaths) =>
    this.dbClient.dataInsert(mimetype, path, cids, keys, localpaths);
  dataSelectOne = (path) => this.dbClient.dataSelectOne(path);
  dataClear = () => this.dbClient.dataClear();
}

class PGClient {
  constructor({ database, host, port, user, password }) {
    if (this.pgClient == null)
      this.pgClient = new pg.Client({
        database,
        host,
        port,
        user,
        password,
      });
    else console.log('이미 존재하는 db정보입니다');
  }

  connect() {
    this.pgClient.connect((error) => {
      if (error) console.error('connection error', error.stack);
      else console.log('postgresql connected');
    });
  }

  async dataInsert(mimetype, path, cids, keys, localpaths) {
    return this.pgClient
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
    return this.pgClient
      .query('SELECT * FROM ipfsdb.data WHERE path = $1 LIMIT 1', [path])
      .then(
        (data) => {
          if (data.rows.length == 1) return data.rows[0];
          else throw new Error('존재하지 않는 데이터 검색:', path);
        },
        (err) => {
          if (err) {
            console.log('DB 조회 도중 오류가 발생했습니다.');
            throw err;
          }
        }
      );
  }

  dataClear() {
    return this.pgClient.query('DELETE FROM ipfsdb.data RETURNING *').then(
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
