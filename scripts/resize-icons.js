/**
 * Resize app icon to all Android mipmap densities using sharp.
 * Usage: node scripts/resize-icons.js <source-icon-path>
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('sharp not found, installing...');
    const { execSync } = require('child_process');
    execSync('npm install sharp --no-save', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    sharp = require('sharp');
  }

  const sourceIcon = process.argv[2];
  if (!sourceIcon) {
    console.error('Usage: node scripts/resize-icons.js <source-icon-path>');
    process.exit(1);
  }

  const resDir = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

  // Android adaptive icon sizes (foreground = 108dp)
  // mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
  const densities = [
    { name: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  const sourceBuffer = fs.readFileSync(sourceIcon);

  for (const density of densities) {
    const dir = path.join(resDir, density.name);
    
    // Generate ic_launcher.png (full icon, square)
    await sharp(sourceBuffer)
      .resize(density.size, density.size, { fit: 'cover' })
      .png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 })
      .toFile(path.join(dir, 'ic_launcher.png'));
    console.log(`✓ ${density.name}/ic_launcher.png (${density.size}x${density.size})`);

    // Generate ic_launcher_round.png (same as square, Android masks it)
    await sharp(sourceBuffer)
      .resize(density.size, density.size, { fit: 'cover' })
      .png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 })
      .toFile(path.join(dir, 'ic_launcher_round.png'));
    console.log(`✓ ${density.name}/ic_launcher_round.png (${density.size}x${density.size})`);

    // Generate ic_launcher_foreground.png (larger for adaptive icon, 108dp base)
    await sharp(sourceBuffer)
      .resize(density.fgSize, density.fgSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 })
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));
    console.log(`✓ ${density.name}/ic_launcher_foreground.png (${density.fgSize}x${density.fgSize})`);
  }

  console.log('\n✅ All icons generated successfully!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
