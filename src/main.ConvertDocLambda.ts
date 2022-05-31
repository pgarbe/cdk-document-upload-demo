import { env } from 'process';
import { Stream } from 'stream';
import * as AWS from 'aws-sdk';
import { pipe, gotenberg, convert, please, adjust, office } from 'gotenberg-js-client';

const gotenbergUrl = env.GOTENBERG_URL || 'localhost:3000';
const targetBucket = env.TARGET_BUCKET_NAME || 'notconfigured';

const toPDF = pipe(
  gotenberg(`http://${gotenbergUrl}`),
  convert,
  office,
  adjust({
    // manually adjust endpoint
    url: `http://${gotenbergUrl}/forms/libreoffice/convert`,
  }),
  please,
);

const client = new AWS.S3();

export async function handler(evt: any) {
  console.log(`Event: ${JSON.stringify(evt)}`);

  const bucket = evt.detail.bucket.name;
  const key = evt.detail.object.key;

  console.log(`${bucket}/${key}`);
  console.log(`${gotenbergUrl}`);

  // Get document
  const data = await client.getObject({ Bucket: bucket, Key: key }).promise();

  // Convert to PDF
  const pdf = await toPDF(['out.pdf', data.Body as any]);

  const passThrough = new Stream.PassThrough();
  pdf.pipe(passThrough);

  await client.upload({
    Bucket: targetBucket,
    Key: `${key}.pdf`,
    Body: passThrough,
    ContentType: 'application/pdf',
  }).promise();

  return { convertResult: { bucket: targetBucket, key: `${key}.pdf` } };
}
