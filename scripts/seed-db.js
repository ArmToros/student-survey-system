#!/usr/bin/env node
// Runs scripts/seed-dev-data.sql against a SQL Server, creating the SSS database
// from scratch with synthetic sample data. This is the alternative to restoring
// "new database/SSS.bak", for machines that do not have the backup.
//
// It is the cross-platform half of the seeded path: "npm run db:seed" has to work
// on Linux as well as Windows, so this is Node rather than a PowerShell script
// like scripts/restore-localdb.ps1.
//
//   npm run db:seed                                   # LocalDB, Windows auth
//   npm run db:seed -- --server localhost,1434 --user sa --password "..."
//   npm run db:seed -- --server localhost,1434        # password from MSSQL_SA_PASSWORD
//
// Options (all optional):
//   --server <s>    server to connect to. Default: the SEED_SQL_SERVER
//                   environment variable, else (localdb)\MSSQLLocalDB.
//   --user <u>      SQL login. Without it, Windows authentication is used.
//   --password <p>  password for --user. Default: the MSSQL_SA_PASSWORD
//                   environment variable, so the Docker password in .env works
//                   without repeating it on the command line.
//   --skip-verify   do not run scripts/verify.sql afterwards.
//
// WARNING: like "npm run db:restore", this REPLACES the SSS database on the target
// server. Anything in an existing SSS, including a restore of the real backup, is
// dropped first.
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const scriptsDir = __dirname;

function parseArgs(argv) {
  const options = {
    server: process.env.SEED_SQL_SERVER || '(localdb)\\MSSQLLocalDB',
    user: null,
    password: process.env.MSSQL_SA_PASSWORD || null,
    skipVerify: false
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    switch (arg) {
      case '--server':
      case '-S':
        options.server = argv[++index];
        break;
      case '--user':
      case '-U':
        options.user = argv[++index];
        break;
      case '--password':
      case '-P':
        options.password = argv[++index];
        break;
      case '--skip-verify':
        options.skipVerify = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}. Run with --help.`);
    }
  }

  if (!options.server) {
    throw new Error('--server needs a value.');
  }

  return options;
}

/** The sqlcmd arguments shared by every call: server, credentials, fail on error. */
function connectionArgs(options) {
  // -b makes sqlcmd exit non-zero on a SQL error; -C trusts the server certificate,
  // which a local container's self-signed certificate needs.
  const args = ['-S', options.server, '-b', '-C'];

  if (options.user) {
    if (!options.password) {
      throw new Error('--user was given without a password. Pass --password or set MSSQL_SA_PASSWORD.');
    }
    args.push('-U', options.user, '-P', options.password);
  }

  return args;
}

function runSqlcmd(label, options, sqlFile) {
  const args = connectionArgs(options).concat(['-i', sqlFile]);

  console.log(`${label}: ${path.basename(sqlFile)} on ${options.server}`);

  const result = spawnSync('sqlcmd', args, {
    stdio: 'inherit',
    // seed-dev-data.sql includes schema-password-reset-token.sql through sqlcmd's
    // :r directive, which resolves its path from this variable.
    env: Object.assign({}, process.env, { SssScriptsDir: scriptsDir })
  });

  if (result.error && result.error.code === 'ENOENT') {
    console.error('');
    console.error('sqlcmd was not found on PATH.');
    console.error('Install the SQL Server command line tools, or seed inside Docker instead:');
    console.error('  docker compose up -d        (seeds automatically when there is no SSS.bak)');
    process.exit(1);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    console.error(`\n${label} failed (sqlcmd exit code ${result.status}).`);
    process.exit(result.status === null ? 1 : result.status);
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (options.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n')
      .filter(line => line.startsWith('//'))
      .map(line => line.replace(/^\/\/ ?/, ''))
      .join('\n'));
    return;
  }

  const seedFile = path.join(scriptsDir, 'seed-dev-data.sql');
  if (!fs.existsSync(seedFile)) {
    console.error(`Seed script not found: ${seedFile}`);
    process.exit(1);
  }

  runSqlcmd('Seeding', options, seedFile);

  if (options.skipVerify) {
    console.log('Skipping verification as requested.');
  } else {
    runSqlcmd('Verifying', options, path.join(scriptsDir, 'verify.sql'));
  }

  console.log('');
  console.log('Database SSS is ready, seeded with synthetic data.');
  console.log('Next: npm run db:hash-passwords   (hashes the placeholder passwords)');
  console.log('      npm run start:api           (backend on http://localhost:5001)');
  console.log('      npm start                   (frontend on http://localhost:3000)');
}

main();
