/**
 * Resize splash screen for all Android drawable densities.
 * Usage: node scripts/resize-splash.js <source-splash-path>
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

  const sourceSplash = process.argv[2];
  if (!sourceSplash) {
    console.error('Usage: node scripts/resize-splash.js <source-splash-path>');
    process.exit(1);
  }

  const resDir = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

  // Portrait splash screen sizes
  const portraitDensities = [
    { name: 'drawable-port-mdpi', width: 320, height: 480 },
    { name: 'drawable-port-hdpi', width: 480, height: 800 },
    { name: 'drawable-port-xhdpi', width: 720, height: 1280 },
    { name: 'drawable-port-xxhdpi', width: 960, height: 1600 },
    { name: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
  ];

  // Landscape splash screen sizes
  const landscapeDensities = [
    { name: 'drawable-land-mdpi', width: 480, height: 320 },
    { name: 'drawable-land-hdpi', width: 800, height: 480 },
    { name: 'drawable-land-xhdpi', width: 1280, height: 720 },
    { name: 'drawable-land-xxhdpi', width: 1600, height: 960 },
    { name: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
  ];

  const sourceBuffer = fs.readFileSync(sourceSplash);

  for (const density of [...portraitDensities, ...landscapeDensities]) {
    const dir = path.join(resDir, density.name);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await sharp(sourceBuffer)
      .resize(density.width, density.height, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 9, palette: true, quality: 80, effort: 10 })
      .toFile(path.join(dir, 'splash.png'));
    console.log(`✓ ${density.name}/splash.png (${density.width}x${density.height})`);
  }

  console.log('\n✅ All splash screens generated successfully!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
