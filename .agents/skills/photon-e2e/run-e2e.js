const { spawn, spawnSync } = require('child_process');
const readline = require('readline');
const path = require('path');
const os = require('os');
const fs = require('fs');

const REPO = path.resolve(__dirname, '../../..');
const SHELL_NODE_MODULES = path.join(REPO, 'shell/node_modules');
if (fs.existsSync(SHELL_NODE_MODULES)) {
  module.paths.unshift(SHELL_NODE_MODULES);
}

const { chromium } = require('playwright');

const PYTHON = process.env.PHOTON_PYTHON || path.join(REPO, 'node/.venv/bin/python');
const MOCK_SSH_SCRIPT = path.join(__dirname, 'mock-ssh-server.py');
const TMP_DIR = path.join(os.tmpdir(), 'photon-e2e');
const PWA_URL = process.env.PWA_URL || 'http://127.0.0.1:8081';

function waitForLine(proc, regex) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: proc.stdout });
    const onLine = (line) => {
      process.stdout.write(`[${proc.spawnfile}] ${line}\n`);
      const match = line.match(regex);
      if (match) {
        rl.off('line', onLine);
        resolve(match[1]);
      }
    };
    rl.on('line', onLine);
    proc.stderr.on('data', (data) => process.stderr.write(`[${proc.spawnfile} stderr] ${data}`));
    proc.on('exit', (code) => reject(new Error(`${proc.spawnfile} exited with ${code}`)));
  });
}

function startProcess(command, args, env = {}) {
  return spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function generatePythonBindings() {
  const result = spawnSync(PYTHON, [path.join(REPO, 'node/scripts/generate_proto.py')], {
    cwd: path.join(REPO, 'node'),
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`failed to generate Python protobuf bindings: ${result.stderr || result.stdout}`);
  }
}

async function main() {
  generatePythonBindings();
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const sshProc = startProcess(PYTHON, [MOCK_SSH_SCRIPT]);
  const sshPort = await waitForLine(sshProc, /MOCK_SSH_PORT=(\d+)/);
  console.log('mock SSH port:', sshPort);

  const nodeProc = startProcess(PYTHON, ['-m', 'photon.main'], {
    PHOTON_ALLOWED_ORIGIN: PWA_URL,
    PHOTON_PORT: '17373',
  });
  const pin = await waitForLine(nodeProc, /pairing code: (\d{6})/);
  console.log('node pairing pin:', pin);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('browser:', message.text());
  });
  page.on('pageerror', (error) => console.error('page error:', error.message));

  try {
    await page.goto(PWA_URL);

    await page.getByPlaceholder('000000').fill(pin);
    await page.locator('.workbench-dialog-content .workbench-dialog-button--primary').click();
    await page.waitForSelector('text=新建连接', { timeout: 10000 });

    await page.locator('.node-status').click();
    await page.getByText('设置 PWA 主密码').click();
    await page.locator('#vault-password').fill('test-master-password');
    await page.locator('#vault-password-confirm').fill('test-master-password');
    await page.locator('.workbench-dialog-content .workbench-dialog-button--primary').click();
    await page.waitForSelector('#vault-password', { state: 'detached', timeout: 10000 });

    await page.locator('.node-status').click();
    await page.getByText('锁定 PWA 凭据').click();
    await page.locator('.node-status').click();
    await page.getByText('设置 PWA 主密码').click();
    await page.locator('#vault-password').fill('test-master-password');
    await page.locator('.workbench-dialog-content .workbench-dialog-button--primary').click();
    await page.waitForSelector('#vault-password', { state: 'detached', timeout: 10000 });

    let hostKeyPromptSeen = false;

    async function addHost(label) {
      const expectedTabCount = await page.locator('.terminal-tab').count() + 1;
      await page.locator('.new-btn').click();
      await page.getByPlaceholder('address').fill('127.0.0.1');
      await page.getByPlaceholder('port').fill(sshPort);
      await page.getByPlaceholder('username').fill('root');
      await page.locator('input[type="password"]').fill('test');
      await page.getByRole('button', { name: '登录' }).click();
      try {
        const hostKeyAccept = page.locator('#host-key-accept');
        await hostKeyAccept.waitFor({ state: 'visible', timeout: 5000 });
        hostKeyPromptSeen = true;
        await hostKeyAccept.click();
      } catch {
        // The target may already be in PWA KnownHosts.
      }
      await page.waitForFunction(
        (expected) => {
          const tabs = document.querySelectorAll('.terminal-tab');
          return tabs.length >= expected && tabs[tabs.length - 1].querySelector('.dot.online') !== null;
        },
        expectedTabCount,
        { timeout: 20000 },
      );
      console.log(`host ${label} online`);
    }

    async function waitForMetrics() {
      await page.waitForFunction(
        () => {
          const cards = Array.from(document.querySelectorAll('[data-metric-value]'));
          const gauges = document.querySelectorAll('[data-metric-kind="gauge"] .metric-gauge-chart');
          const processCard = document.querySelector('[data-metric-id="process.count"][data-metric-kind="stat"]');
          return cards.length === 4
            && cards.every((element) => {
              const value = element.getAttribute('data-metric-value');
              return value && !value.includes('--');
            })
            && gauges.length === 3
            && processCard !== null;
        },
        null,
        { timeout: 30000 },
      );
    }

    await addHost('A');
    if (!hostKeyPromptSeen) throw new Error('first SSH connection did not request host-key confirmation');
    const credentialStore = await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('photon-shell');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('credentials', 'readonly');
        const read = transaction.objectStore('credentials').getAll();
        read.onerror = () => reject(read.error);
        read.onsuccess = () => resolve(JSON.stringify(read.result));
      };
    }));
    if (credentialStore.includes('test')) {
      throw new Error('PWA credential store contains plaintext password');
    }

    await page.locator('.conn-item').first().click({ button: 'right' });
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="menu"]', { state: 'detached', timeout: 5000 });
    await page.waitForSelector('.xterm-screen', { timeout: 5000 });
    await page.locator('.xterm-screen').last().click({ button: 'right' });
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="menu"]', { state: 'detached', timeout: 5000 });
    console.log('host and terminal context menus open and dismiss');

    const firstTab = page.locator('.terminal-tab').first();
    await firstTab.dblclick();
    await page.waitForSelector('.workbench-dialog-content', { timeout: 5000 });
    const title = await page.locator('.workbench-dialog-title').textContent();
    if (title !== '连接') throw new Error(`expected modal title "连接", got "${title}"`);
    const dupeAddress = await page.getByPlaceholder('address').inputValue();
    const dupePort = await page.getByPlaceholder('port').inputValue();
    const dupeUsername = await page.getByPlaceholder('username').inputValue();
    const dupePassword = await page.locator('input[type="password"]').inputValue();
    if (dupeAddress !== '127.0.0.1' || dupePort !== String(sshPort) || dupeUsername !== 'root') {
      throw new Error(`duplicate modal not pre-filled: address=${dupeAddress}, port=${dupePort}, username=${dupeUsername}`);
    }
    if (dupePassword !== '') throw new Error('duplicate modal should not expose the saved password');
    await page.locator('.workbench-dialog-button--default').click();
    await page.waitForSelector('.workbench-dialog-content', { state: 'detached', timeout: 5000 });
    console.log('double-click duplicate opens pre-filled connection modal');

    await waitForMetrics();
    const firstValues = await page.locator('[data-metric-value]').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-metric-value')),
    );
    console.log('first tab values:', firstValues);

    const monitorButton = page.getByRole('button', { name: '系统监控' });
    await monitorButton.click();
    await page.waitForFunction(
      () => document.querySelector('.secondary-sidebar')?.classList.contains('collapsed'),
      null,
      { timeout: 5000 },
    );
    await monitorButton.click();
    await waitForMetrics();

    await addHost('B');
    const tabs = await page.locator('.terminal-tab').all();
    if (tabs.length < 2) throw new Error('expected two tabs');
    await tabs[0].click();
    await waitForMetrics();

    const finalValues = await page.locator('[data-metric-value]').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-metric-value')),
    );
    console.log('values after tab switch:', finalValues);
    if (finalValues.some((value) => value.includes('--'))) {
      throw new Error('metrics still showing -- after tab switch');
    }

    await page.reload();
    await page.waitForSelector('text=新建连接', { timeout: 10000 });
    if (await page.locator('.conn-item').count() !== 2) {
      throw new Error('PWA host records did not survive a reload');
    }

    console.log('E2E test passed: PWA protocol client and PWA-owned telemetry follow active-tab lifecycle');
  } catch (error) {
    await page.screenshot({ path: path.join(TMP_DIR, 'failure.png') });
    console.error('Test failed:', error.message);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
    sshProc.kill();
    nodeProc.kill();
    console.log('cleaned up');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
