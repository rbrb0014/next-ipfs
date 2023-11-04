import express from 'express';
import multer from 'multer';
import { dataClear, dataInsert, dataSelectOne } from './src/dbQuery.js';
import { frag, mergeFrags } from './src/frag.js';
import { decrypt, encrypt } from './src/crypt.js';
import { filesRemoveAll, ipfsRead, ipfsWrite, unpinAll } from './src/ipfs.js';

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/contents', upload.single('file'), async (req, res) => {
  const { originalname, mimetype, buffer } = req.file;
  const directory = req.query.path ?? '';
  const path = `${directory}/${originalname}`;

  const bufferFrags = frag(buffer);
  const { encryptedBufferFrags, keys } = encrypt(bufferFrags);
  const cids = await ipfsWrite(encryptedBufferFrags, path);
  const insertResult = await dataInsert(mimetype, path, cids, keys);

  res.json(insertResult);
});

app.get('/contents', async (req, res) => {
  const { path } = req.query;

  const { cids, keys, mimetype } = await dataSelectOne(path);
  const bufferFrags = await ipfsRead(cids, path);
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
