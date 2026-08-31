const path = require('path');
const fs = require('fs-extra');
const os = require('os');

const baseDir = path.join(os.homedir(), '.pix/sandboxes');

async function cleanup() {
  console.log('Cleaning up sandboxes...');

  try {
    if (await fs.pathExists(baseDir)) {
      const items = await fs.readdir(baseDir);
      console.log(`Found ${items.length} sandbox directories`);

      for (const item of items) {
        const itemPath = path.join(baseDir, item);
        try {
          const stat = await fs.stat(itemPath);
          if (stat.isDirectory()) {
            const configPath = path.join(itemPath, 'config.json');
            if (await fs.pathExists(configPath)) {
              const config = await fs.readJson(configPath);
              const age = Date.now() - new Date(config.createdAt).getTime();
              const maxAge = 7 * 24 * 60 * 60 * 1000;

              if (age > maxAge) {
                console.log(`Removing old sandbox: ${config.name || item}`);
                await fs.remove(itemPath);
              }
            }
          }
        } catch (e) {
          console.error(`Error processing ${item}:`, e.message);
        }
      }
    }

    console.log('Cleanup complete');
  } catch (e) {
    console.error('Cleanup failed:', e.message);
  }
}

if (require.main === module) {
  cleanup();
}

module.exports = { cleanup };
