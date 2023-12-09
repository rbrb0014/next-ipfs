import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import EventEmitter from 'events';
import multer from 'multer';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { CrpytoService } from './src/crypt.js';
import { DBClientORM } from './src/dbQuery.js';
import { IpfsService } from './src/ipfs.js';
import { StreamService } from './src/stream.js';
import { TimeMeasureService } from './src/time.js';

EventEmitter.defaultMaxListeners = 20;

const app = express();
const save = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const path = `upload/${req.query.path ?? ''}`;
      fs.mkdirSync(path, { recursive: true }, (err) => {
        if (err) throw err;
      });
      cb(null, path);
    },
  }),
});
const cryptoService = new CrpytoService(process.env.IV_STRING);
const ipfsService = new IpfsService('http://127.0.0.1:5001/api/v0');
const timeMeasureService = new TimeMeasureService();
const streamService = new StreamService(process.env.SPLIT_COUNT);
const pgClientORM = new DBClientORM({
  type: 'postgres',
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
pgClientORM.connect();
ipfsService.connect();

/**
 * Save original file on disk. File fragments saved in ipfs.
 * Not to be recommended.
 */
app.post('/contents/disk', save.single('file'), async (req, res) => {
  const { originalname, mimetype, destination } = req.file;
  const directory = req.query.path ?? '';
  const path = `${destination}/${originalname}`;

  const fragStreams = await streamService.createDiskFragStreams(
    `${directory}/${req.file.filename}`
  );
  const { keys, encryptStreams } = cryptoService.encryptStream(fragStreams);
  const cids = await timeMeasureService.measureExecutionTimeAsync(async () =>
    ipfsService.ipfsWriteStream(encryptStreams)
  );

  const insertResult = await pgClientORM.dataInsert(
    mimetype,
    path,
    cids,
    keys,
    [path]
  );

  res.json(insertResult);
});

/**
 * Save fragment file on disk and ipfs.
 */
app.post('/contents/disksplit', save.single('file'), async (req, res) => {
  const { originalname, mimetype, destination, path: localpath } = req.file;
  const cloudpath = `${destination}/${originalname}`;
  const localpaths = await streamService.splitFile(
    localpath ?? '',
    originalname
  );

  const fragStreams = streamService.createDistStreams(localpaths);
  const { keys, encryptStreams } = cryptoService.encryptStream(fragStreams);
  const cids = await timeMeasureService.measureExecutionTimeAsync(async () =>
    ipfsService.ipfsWriteStream(encryptStreams)
  );

  const insertResult = await pgClientORM.dataInsert(
    mimetype,
    cloudpath,
    cids,
    keys,
    localpaths
  );

  res.json(insertResult);
});

app.patch('/contents/path', async (req, res, next) => {
  const currentPath = 'upload/' + (req.query.currentPath ?? '');
  const newPath =
    'upload/' + (req.query.newPath ?? req.query.currentPath ?? '');
  const currentFileName = req.query.currentfilename ?? '';
  const newFileName = req.query.newfilename || currentFileName;

  if (!(await pgClientORM.dataExist(`${currentPath}${currentFileName}`))) {
    res.status(400).json({ error: '원본 파일이 존재하지 않습니다.' });
    return;
  }

  if (await pgClientORM.dataExist(`${newPath}${newFileName}`)) {
    res.status(400).json({ error: '해당 경로에 이미 파일이 존재합니다.' });
    return;
  }

  const newData = await pgClientORM.dataUpdatePath(
    `${currentPath}${currentFileName}`,
    `${newPath}${newFileName}`
  );

  const localNames = newData.rows[0].localpaths.map((currentLocalPath) =>
    currentLocalPath.replace(/((.*(?=\\))|(.*(?=\/)))./, '')
  );

  const moveResult = await Promise.all(
    localNames.map((localName) =>
      streamService.moveFile(currentPath, newPath, localName)
    )
  ).then((filesMoved) => filesMoved.every((value) => value === true));

  if (moveResult === true) {
    console.log(
      `update local cache file ${currentPath}${currentFileName} to ${newPath}${newFileName}`
    );
    await pgClientORM.dataUpdateLocalPaths(
      `${newPath}${newFileName}`,
      localNames.map((localName) => `${newPath}${localName}`)
    );
    res.send('move successfully');
  } else {
    res.send('move failed');
  }
});

/**
 * Get file as path info. load from ipfs's fragment files.
 */
app.get('/contents/stream', async (req, res) => {
  const path = 'upload/' + (req.query.path ?? '');
  const { cids, keys, mimetype } = await pgClientORM.dataSelectOne(path);
  const cryptFragStreams = ipfsService.ipfsReadStream(cids, path);
  const decryptedStreams = cryptoService.decryptStream(cryptFragStreams, keys);

  await timeMeasureService.measureExecutionTimeAsync(async () => {
    res.set('Content-Type', mimetype);
    for (const decryptedStream of decryptedStreams) {
      console.log('sending frag...');
      await promisify(pipeline)(decryptedStream, res, { end: false });
    }
    console.log('stream end.');
    res.end();
  });
});

/**
 * Get file as path info. load from local disk's fragment files.
 */
app.get('/contents/cache', async (req, res) => {
  const path = 'upload/' + (req.query.path ?? '');
  const { localpaths, mimetype } = await pgClientORM.dataSelectOne(path);
  const fileStreams = streamService.getFileStreams(localpaths);

  await timeMeasureService.measureExecutionTimeAsync(async () => {
    res.set('Content-Type', mimetype);
    for (const fileStream of fileStreams) {
      console.log('sending frag...');
      await promisify(pipeline)(fileStream, res, { end: false });
    }
    console.log('stream end.');
    res.end();
  });
});

app.get('/contents/path', async (req, res) => {
  const path = 'upload/' + (req.query.path ?? '');
  if (!path.endsWith('/')) {
    res.status(404).send('잘못된 형식입니다. ex/am/ple/ 형식을 지켜주세요.');
    return;
  }

  const paths = await pgClientORM.dataSelectPaths(path);
  res.send(paths);
});

/**
 * delete pinned data and data in ipfsdb.data table.
 */
app.delete('/pin', async (req, res) => {
  await pgClientORM.dataClear();
  await ipfsService.unpinAll();

  res.send('successfully unpinned');
});

/**
 * delete MFS files and data in ipfsdb.data table.
 */
app.delete('/files', async (req, res) => {
  await pgClientORM.dataClear();
  await ipfsService.filesRemoveAll();

  res.send('successfully files removed');
});

app.use((err, req, res, next) => {
  console.error(typeof err, err.stack);
  res.status(500).send('오류 발생');
});

app.listen(3000);
