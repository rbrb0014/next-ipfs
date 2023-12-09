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
  dataExist = (path) => this.dbClient.dataExist(path);
  dataUpdatePath = (currentPath, newPath) =>
    this.dbClient.dataUpdatePath(currentPath, newPath);
  dataUpdateLocalPaths = (currentPath, newLocaPaths) =>
    this.dbClient.dataUpdateLocalPaths(currentPath, newLocaPaths);
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
      .then((result) => {
        console.log('data inserted. path :', result.rows[0].path);
        return 'contents successfully saved';
      }, this.dbError);
  }

  async dataSelectOne(path) {
    return this.pgClient
      .query('SELECT * FROM ipfsdb.data WHERE path = $1 LIMIT 1', [path])
      .then((data) => {
        if (data.rows.length == 1) return data.rows[0];
        else throw new Error('존재하지 않는 데이터 검색:', path);
      }, this.dbError);
  }

  async dataExist(path) {
    return this.pgClient
      .query('SELECT * FROM ipfsdb.data WHERE path = $1 LIMIT 1', [path])
      .then((data) => {
        if (data.rows.length == 1) return true;
        else return false;
      }, this.dbError);
  }

  async dataUpdatePath(currentPath, newLocaPath) {
    return this.pgClient
      .query('UPDATE ipfsdb.data SET path=$1 WHERE path = $2', [
        newLocaPath,
        currentPath,
      ])
      .then((data) => {
        if (data.rowCount > 0)
          return this.pgClient.query(
            'SELECT * FROM ipfsdb.data WHERE path=$1',
            [newLocaPath]
          );
        else throw new Error('수정한 데이터가 없습니다.');
      });
  }

  async dataUpdateLocalPaths(currentPath, newPaths) {
    return this.pgClient
      .query('UPDATE ipfsdb.data SET localpaths=$1 WHERE path = $2', [
        newPaths,
        currentPath,
      ])
      .then((data) => {
        if (data.rowCount > 0) return true;
        else throw new Error('해당 수정할 데이터가 없습니다.', currentPath);
      });
  }

  dataClear() {
    return this.pgClient
      .query('DELETE FROM ipfsdb.data RETURNING *')
      .then((result) => {
        console.log(`delete ${result.rowCount} data`);
        return result.rows;
      }, this.dbError);
  }

  dbError = (err) => {
    if (err) {
      console.error('DB 쿼리 오류 발생', err.stack);
      throw err;
    }
  };
}
