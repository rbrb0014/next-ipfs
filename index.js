import pg from 'pg';
import express from 'express';
import { create } from 'kubo-rpc-client';
import multer from 'multer';
import {
  decrypt,
  encrypt,
  filesRemoveAll,
  fragging,
  ipfsRead,
  ipfsWrite,
  unpinAll,
} from './src/service.js';
import { dataInsert, dataSelectOne } from './src/dbQuery.js';

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
export const dbClient = new pg.Client({
  host: 'localhost',
  port: '5432',
  user: 'postgres',
  password: '1234',
  database: 'postgres',
});
dbClient.connect((error) => {
  if (error) console.error('connection error', error.stack);
  else console.log('postgresql connected');
});
export const ipfs = create({ url: 'http://127.0.0.1:5001/api/v0' });
await ipfs.id().then(() => console.log('ipfs connected'));

// const frag_length = 262144;
const split_count = 5;
const ivString = 'passwordpassword';

app.post('/contents', upload.single('file'), async (req, res) => {
  const { originalname, mimetype, buffer } = req.file;
  const directory = req.query.path ?? '';
  const path = `${directory}/${originalname}`;

  const fragments = fragging(buffer, split_count);
  const { encryptedFragments, keys } = encrypt(fragments, ivString);
  const cids = await ipfsWrite(encryptedFragments, path);

  const result = await dataInsert(mimetype, path, cids, keys);

  res.json(result.context);
});

app.get('/contents', async (req, res) => {
  const { path } = req.query;
  const { cids, keys, mimetype } = await dataSelectOne(path);
  // const directoryCID = cids.pop();
  const buffers = await ipfsRead(cids, path);

  const decryptedFrags = await decrypt(buffers, keys, ivString);

  const result = decryptedFrags.reduce((prev, curr) =>
    Buffer.concat([prev, curr])
  );

  res.set('Content-Type', mimetype).send(result);
});

app.delete('/pin', async (req, res) => {
  await unpinAll();
  res.send('successfully unpinned');
});

app.delete('/files', async (req, res) => {
  await filesRemoveAll();
  res.send('successfully files removed');
});

app.listen(3000);
