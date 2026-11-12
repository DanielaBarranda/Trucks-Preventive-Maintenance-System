import { fitWithin, prepareUpload } from './image';

it('fitWithin scales a large photo down to 1600px on the long side', () => {
  expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
});

it('fitWithin leaves a small photo unchanged', () => {
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
});

it('prepareUpload rejects files that are not JPG or PNG', async () => {
  const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
  await expect(prepareUpload(file)).rejects.toThrow('Use a JPG or PNG photo.');
});

it('prepareUpload sends the original when the browser cannot decode it', async () => {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' });
  await expect(prepareUpload(file)).resolves.toBe(file);
});

it('prepareUpload refuses an undecodable original over 10 MB', async () => {
  const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' });
  await expect(prepareUpload(big)).rejects.toThrow('Photo is too big (max 10 MB).');
});

it('prepareUpload accepts a photo with no MIME type when the name says JPG', async () => {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'IMG_0042.JPG', { type: '' });
  const result = await prepareUpload(file);
  expect(result.type).toBe('image/jpeg');
  expect(result.name).toBe('IMG_0042.JPG');
});
