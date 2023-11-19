import express from 'express';
import multer from 'multer';
import { dataClear, dataInsert, dataSelectOne } from './src/dbQuery.js';
import { createDiskFragStreams, createFragStreams } from './src/disk.js';
import { frag, mergeFrags, mergeStream } from './src/frag.js';
import { decrypt, decryptStream, encrypt, encryptStream } from './src/crypt.js';
import {
  filesRemoveAll,
  ipfsRead,
  ipfsReadStream,
  ipfsWrite,
  ipfsWriteStream,
  unpinAll,
} from './src/ipfs.js';
import { measureExecutionTimeAsync } from './src/time.js';
import stream from 'stream';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const save = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'upload/');
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  }),
});

app.post('/contents/stream', upload.single('file'), async (req, res) => {
  const { originalname, mimetype, buffer, size } = req.file;
  const sourceStream = stream.Readable.from(buffer);
  const directory = req.query.path ?? '';
  const path = `${directory}/${originalname}`;

  const fragStreams = await createFragStreams(sourceStream, size);
  const { keys, encryptStreams } = encryptStream(fragStreams);
  const cids = await measureExecutionTimeAsync(ipfsWriteStream, encryptStreams);

  const insertResult = await dataInsert(mimetype, path, cids, keys);

  res.json(insertResult);
});

app.post('/contents/disk', save.single('file'), async (req, res) => {
  const { originalname, mimetype } = req.file;
  const directory = req.query.path ?? '';
  const path = `${directory}/${originalname}`;

  const fragStreams = await createDiskFragStreams(originalname);
  const { keys, encryptStreams } = encryptStream(fragStreams);
  const cids = await measureExecutionTimeAsync(ipfsWriteStream, encryptStreams);

  const insertResult = await dataInsert(mimetype, path, cids, keys);

  res.json(insertResult);
});

app.post('/contents', upload.single('file'), async (req, res) => {
  const { originalname, mimetype, buffer } = req.file;
  const directory = req.query.path ?? '';
  const path = `${directory}/${originalname}`;

  const bufferFrags = frag(buffer);
  const { encryptedBufferFrags, keys } = encrypt(bufferFrags);
  const cids = await measureExecutionTimeAsync(
    ipfsWrite,
    encryptedBufferFrags,
    path
  );
  const insertResult = await dataInsert(mimetype, path, cids, keys);

  res.json(insertResult);
});

app.get('/contents/stream', async (req, res) => {
  const { path } = req.query;

  const { cids, keys, mimetype } = await dataSelectOne(path);
  const encryptedFragStreams = await measureExecutionTimeAsync(
    ipfsReadStream,
    cids,
    path
  );
  const decryptedStreams = await decryptStream(encryptedFragStreams, keys);
  const mergedStream = await mergeStream(decryptedStreams);

  res.set('Content-Type', mimetype);
  mergedStream.on('data', (chunk) => {
    res.write(chunk);
  });
  mergedStream.on('end', () => {
    res.end();
  });
});

app.get('/contents', async (req, res) => {
  const { path } = req.query;

  const { cids, keys, mimetype } = await dataSelectOne(path);
  const bufferFrags = await measureExecutionTimeAsync(ipfsRead, cids, path);
  const decryptedBufferFrags = await decrypt(bufferFrags, keys);
  const mergedData = await mergeFrags(decryptedBufferFrags);

  res.set('Content-Type', mimetype).send(mergedData);
});

app.delete('/pin', async (req, res) => {
  await unpinAll();

  res.send('successfully unpinned');
});

app.delete('/files', async (req, res) => {
  await dataClear();
  await filesRemoveAll();

  res.send('successfully files removed');
});

app.listen(3000);
