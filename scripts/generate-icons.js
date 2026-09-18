import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateIcons() {
  const svgPath = path.resolve('public/icon.svg');
  const publicDir = path.resolve('public');
  
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('Created pwa-192x192.png');

  // 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('Created pwa-512x512.png');

  // 512x512 maskable with safe zone padding
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: { r: 250, g: 247, b: 245, alpha: 1 }
    })
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('Created pwa-maskable-512x512.png');

  // Apple Touch Icon 180x180
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created apple-touch-icon.png');

  // Favicon 32x32
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('Created favicon.png');
}

generateIcons().catch(console.error);
