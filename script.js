const pc = document.getElementById('particles');
const customCursor = document.getElementById('customCursor');
const espInstallBtn = document.getElementById('espInstallBtn');
const modalStatus = document.getElementById('modalStatus');
const fallbackCatalog = {
  firmwares: {
    'net-wraith': { name: 'Net-Wraith', version: 'v1.0.1', channel: 'BETA', path: 'https://github.com/N3tm4t3/Net-Wraith-Flasher/raw/refs/heads/main/Net-Wraith.bin' },
    tamagotchi: { name: 'Tamagotchi', version: 'v0.9.2', channel: 'STABLE', path: 'https://github.com/N3tm4t3/Net-Wraith-Flasher/raw/refs/heads/main/Tamagotchi.bin' },
    deauther: { name: 'Deauther', version: 'v2.0.1', channel: 'BETA', path: 'https://github.com/N3tm4t3/Net-Wraith-Flasher/raw/refs/heads/main/Deauther.bin' }
  }
};

let firmwareCatalog = null;
let activeManifestUrl = '';
let usedFallbackCatalog = false;

for (let i = 0; i < 22; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  const s = Math.random() > 0.5 ? '2px' : '3px';
  p.style.cssText = `left:${Math.random() * 100}%;width:${s};height:${s};animation-duration:${7 + Math.random() * 10}s;animation-delay:${Math.random() * 12}s`;
  pc.appendChild(p);
}

const enableCursor = window.matchMedia('(pointer: fine)').matches &&
  window.matchMedia('(hover: hover)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (enableCursor) {
  document.body.classList.add('cursor-active');

  const setCursorPosition = (x, y) => {
    customCursor.style.left = `${x}px`;
    customCursor.style.top = `${y}px`;
  };

  const showCursor = () => {
    customCursor.classList.add('is-visible');
  };

  const hideCursor = () => {
    customCursor.classList.remove('is-visible', 'clicking');
  };

  const setPressState = pressed => {
    customCursor.classList.toggle('clicking', pressed);
  };

  document.addEventListener('mousemove', event => {
    setCursorPosition(event.clientX, event.clientY);
    showCursor();
  });

  document.addEventListener('mousedown', () => setPressState(true));
  document.addEventListener('mouseup', () => setPressState(false));
  document.addEventListener('mouseleave', hideCursor);
  document.addEventListener('mouseenter', showCursor);
  window.addEventListener('blur', () => {
    setPressState(false);
    hideCursor();
  });
}

document.getElementById('navFlashBtn').onclick = () => {
  document.getElementById('firmware').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function setModalStatus(message, tone = 'info') {
  if (!message) {
    modalStatus.textContent = '';
    modalStatus.classList.add('hidden');
    return;
  }

  modalStatus.textContent = message;
  modalStatus.classList.remove('hidden');
  modalStatus.classList.remove('text-red-DEFAULT', 'border-red-dark/40', 'bg-red-DEFAULT/10', 'text-yellow-300', 'border-yellow-500/40', 'bg-yellow-500/10');

  if (tone === 'warn') {
    modalStatus.classList.add('text-yellow-300', 'border-yellow-500/40', 'bg-yellow-500/10');
  } else {
    modalStatus.classList.add('text-red-DEFAULT', 'border-red-dark/40', 'bg-red-DEFAULT/10');
  }
}

async function loadFirmwareCatalog() {
  if (firmwareCatalog) return firmwareCatalog;

  try {
    const response = await fetch('./manifest.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Unable to load manifest.json');
    }
    usedFallbackCatalog = false;
    firmwareCatalog = await response.json();
    return firmwareCatalog;
  } catch (error) {
    console.warn('manifest.json fetch failed, using inline fallback.', error);
    usedFallbackCatalog = true;
    firmwareCatalog = fallbackCatalog;
    return firmwareCatalog;
  }
}

function revokeActiveManifestUrl() {
  if (!activeManifestUrl) return;
  URL.revokeObjectURL(activeManifestUrl);
  activeManifestUrl = '';
}

function buildInstallManifest(entry) {
  return {
    name: entry.name,
    version: entry.version,
    new_install_prompt_erase: true,
    builds: [
      {
        chipFamily: 'ESP8266',
        parts: [
          {
            path: entry.path || '',
            offset: 0
          }
        ]
      }
    ]
  };
}

async function openFlashModal(firmwareKey) {
  revokeActiveManifestUrl();
  document.getElementById('flashModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('modalFwName').textContent = 'Firmware';
  document.getElementById('modalFwLabel').textContent = 'Loading Firmware';
  document.getElementById('modalFwVer').textContent = 'Please wait...';
  espInstallBtn.setAttribute('manifest', '');
  setModalStatus('');

  try {
    const catalog = await loadFirmwareCatalog();
    const entry = catalog.firmwares?.[firmwareKey];
    if (!entry) {
      throw new Error(`Firmware "${firmwareKey}" is missing from manifest.json`);
    }

    document.getElementById('modalFwName').textContent = entry.name;
    document.getElementById('modalFwLabel').textContent = entry.name + ' Firmware';
    document.getElementById('modalFwVer').textContent = entry.version + '  //  ' + (entry.channel || (entry.version.startsWith('v0') ? 'BETA' : 'STABLE'));

    activeManifestUrl = URL.createObjectURL(
      new Blob([JSON.stringify(buildInstallManifest(entry), null, 2)], { type: 'application/json' })
    );
    espInstallBtn.setAttribute('manifest', activeManifestUrl);

    if (!entry.path) {
      setModalStatus('Firmware URL is still empty in manifest.json. Add the .bin link before flashing.', 'warn');
    } else if (usedFallbackCatalog) {
      setModalStatus('manifest.json could not be loaded, so the page is using embedded firmware links instead. If you opened index3.html directly, serving this folder over HTTP is still recommended.', 'warn');
    } else if (location.protocol === 'file:') {
      setModalStatus('Local preview mode detected. If flashing fails, serve this folder over HTTP instead of opening index3.html directly.', 'warn');
    }
  } catch (error) {
    console.error(error);
    document.getElementById('modalFwLabel').textContent = 'Firmware Unavailable';
    document.getElementById('modalFwVer').textContent = 'manifest.json could not be loaded';
    setModalStatus('Unable to prepare the flasher. If you opened this page directly from disk, run it through a local web server and try again.', 'warn');
  }
}

function closeFlashModal() {
  document.getElementById('flashModal').classList.remove('open');
  document.body.style.overflow = '';
  revokeActiveManifestUrl();
  espInstallBtn.setAttribute('manifest', '');
  setModalStatus('');
}

document.getElementById('flashModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeFlashModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeFlashModal();
});
