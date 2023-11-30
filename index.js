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
 * save original file on disk. file fragments saved in ipfs.
 */
app.post('/contents/disk', save.single('file'), async (req, res) => {
  const { originalname, mimetype, destination } = req.file;
  const directory = req.query.path ?? '';
  const path = `${destination}/${originalname}`;
  console.log(path);

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
 * save fragment file on disk and ipfs.
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

/**
 * get file as path info.
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

app.listen(3000);
