const fs = require('fs');
const path = require('path');

// Patch: Fix ajv-keywords _formatLimit.js in multiple packages
// This fixes the issue where ajv._formats is undefined with ajv 8
function patchFormatLimit(filePath) {
  if (!fs.existsSync(filePath)) return false;
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Simple and safe patch: Add early return if formats is undefined
    if (content.includes('function extendFormats(ajv)') && !content.includes('if (!formats) return;')) {
      // Replace the exact pattern: var formats = ajv._formats; followed by for loop
      content = content.replace(
        /(function extendFormats\(ajv\) \{\s*var formats = ajv\._formats;)/,
        `$1
  if (!formats) return;`
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
  } catch (err) {
    // Silently fail
  }
  return false;
}

// Find and patch all instances of _formatLimit.js
function findAndPatchAll(nodeModulesDir) {
  let patchedCount = 0;
  
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            walkDir(filePath);
          } else if (file === '_formatLimit.js' && filePath.includes('ajv-keywords')) {
            if (patchFormatLimit(filePath)) {
              patchedCount++;
            }
          }
        } catch (err) {
          // Skip files we can't access
        }
      }
    } catch (err) {
      // Skip directories we can't access
    }
  }
  
  walkDir(nodeModulesDir);
  return patchedCount;
}

const nodeModules = path.join(__dirname, '..', 'node_modules');
const patchedCount = findAndPatchAll(nodeModules);

if (patchedCount > 0) {
  console.log(`✓ Patched ${patchedCount} ajv-keywords _formatLimit.js file(s)`);
}

