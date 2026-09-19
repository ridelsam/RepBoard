// Run with: npx electron build/generate-icon.cjs
// Render the source vector once, then package PNG entries at Windows icon sizes.
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.setPath('userData', path.join(app.getPath('temp'), 'repboard-icon-render'));
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'));
  const source = 'data:image/svg+xml;base64,' + svg.toString('base64');
  await window.loadURL('data:text/html,<html><body></body></html>');
  const png = await window.webContents.executeJavaScript(`(async () => {
    const image = new Image();
    image.src = ${JSON.stringify(source)};
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  })()`);
  const bytes = Buffer.from(png, 'base64');
  fs.writeFileSync(path.join(__dirname, 'icon.png'), bytes);
  const icon = nativeImage.createFromBuffer(bytes);
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = sizes.map(size => icon.resize({ width: size, height: size, quality: 'best' }).toPNG());
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + 16 * index;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  fs.writeFileSync(path.join(__dirname, 'icon.ico'), Buffer.concat([header, ...images]));
  console.log('Generated icon.png (512px) and icon.ico (16–256px) from icon.svg.');
  window.destroy();
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
