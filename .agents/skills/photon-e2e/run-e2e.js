const { spawn } = require('child_process');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO = path.resolve(__dirname, '../../..');
// The script is outside the shell package, so add shell/node_modules to the
// module search path so `require('playwright')` resolves from there.
const SHELL_NODE_MODULES = path.join(REPO, 'shell/node_modules');
if (fs.existsSync(SHELL_NODE_MODULES)) {
  // @ts-ignore
  module.paths.unshift(SHELL_NODE_MODULES);
}

const { chromium } = require('playwright');

const PYTHON = path.join(REPO, 'node/.venv/bin/python');
const MOCK_SSH_SCRIPT = path.join(__dirname, 'mock-ssh-server.py');
const TMP_DIR = path.join(os.tmpdir(), 'photon-e2e');
const STATE_FILE = path.join(TMP_DIR, 'state.db');
const PWA_URL = process.env.PWA_URL || 'http://127.0.0.1:8081';

function waitForLine(proc, regex) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: proc.stdout });
    const onLine = (line) => {
      process.stdout.write(`[${proc.spawnfile}] ${line}\n`);
      const m = line.match(regex);
      if (m) {
        rl.off('line', onLine);
        resolve(m[1]);
      }
    };
    rl.on('line', onLine);
    proc.stderr.on('data', (d) => process.stderr.write(`[${proc.spawnfile} stderr] ${d}`));
    proc.on('exit', (code) => reject(new Error(`${proc.spawnfile} exited with ${code}`)));
  });
}

function startProcess(command, args, env = {}) {
  const proc = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return proc;
}

async function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);

  // 1. Start mock SSH server
  const sshProc = startProcess(PYTHON, [MOCK_SSH_SCRIPT]);
  const sshPort = await waitForLine(sshProc, /MOCK_SSH_PORT=(\d+)/);
  console.log('mock SSH port:', sshPort);

  // 2. Start PhotonNode
  const nodeProc = startProcess(PYTHON, ['-m', 'photon.main'], {
    PHOTON_MASTER_PASSWORD: 'test',
    PHOTON_ALLOWED_ORIGIN: PWA_URL,
    PHOTON_STATE_PATH: STATE_FILE,
  });
  const pin = await waitForLine(nodeProc, /pairing code: (\d{6})/);
  console.log('node pairing pin:', pin);

  // 3. Launch browser
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(PWA_URL);

    // Pair
    await page.getByPlaceholder('000000').fill(pin);
    await page.locator('.modal .btn-primary').click();

    // Wait for welcome view with host list
    await page.waitForSelector('text=新建连接', { timeout: 5000 });

    // Helper to add a host/tab
    async function addHost(label) {
      await page.locator('.new-btn').click();
      await page.getByPlaceholder('address').fill('127.0.0.1');
      await page.getByPlaceholder('port').fill(sshPort);
      await page.getByPlaceholder('username').fill('root');
      await page.locator('input[type="password"]').fill('test');
      await page.getByRole('button', { name: '登录' }).click();
      // Wait for the new tab dot to be online
      await page.waitForFunction(
        () => document.querySelector('.dot.online') !== null,
        null,
        { timeout: 10000 }
      );
      console.log(`host ${label} online`);
    }

    // Add first host
    await addHost('A');

    // Double-click the first tab to duplicate the host (v0 still requires re-entering password)
    const firstTab = page.locator('.tab').first();
    await firstTab.dblclick();
    await page.waitForSelector('.modal', { timeout: 5000 });

    const title = await page.locator('.modal .title').textContent();
    if (title !== '连接') {
      throw new Error(`expected modal title "连接", got "${title}"`);
    }

    const dupeAddress = await page.getByPlaceholder('address').inputValue();
    const dupePort = await page.getByPlaceholder('port').inputValue();
    const dupeUsername = await page.getByPlaceholder('username').inputValue();
    const dupePassword = await page.locator('input[type="password"]').inputValue();

    if (dupeAddress !== '127.0.0.1' || dupePort !== String(sshPort) || dupeUsername !== 'root') {
      throw new Error(`duplicate modal not pre-filled: address=${dupeAddress}, port=${dupePort}, username=${dupeUsername}`);
    }
    if (dupePassword !== '') {
      throw new Error('duplicate modal should not pre-fill password');
    }

    await page.locator('.modal .btn-default').click();
    await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 });
    console.log('double-click duplicate opens pre-filled connection modal');

    // Wait for telemetry to start automatically (after fix it should not need a tab switch)
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.metric-value');
        return el && el.textContent && !el.textContent.includes('--');
      },
      null,
      { timeout: 10000 }
    );
    const firstValues = await page.locator('.metric-value').allTextContents();
    console.log('first tab values:', firstValues);

    if (firstValues.some(v => v.includes('--'))) {
      throw new Error('telemetry did not start for the active tab');
    }

    // Add second host (same mock SSH) and switch back to verify active-tab lifecycle still works
    await addHost('B');

    const tabs = await page.locator('.tab').all();
    if (tabs.length < 2) throw new Error('expected two tabs');
    await tabs[0].click();

    const finalValues = await page.locator('.metric-value').allTextContents();
    console.log('values after tab switch:', finalValues);

    if (finalValues.some(v => v.includes('--'))) {
      throw new Error('metrics still showing -- after tab switch');
    }

    console.log('E2E test passed: telemetry starts automatically and survives tab switching');
  } catch (e) {
    await page.screenshot({ path: path.join(TMP_DIR, 'failure.png') });
    console.error('Test failed:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    sshProc.kill();
    nodeProc.kill();
    console.log('cleaned up');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
