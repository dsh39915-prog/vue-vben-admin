import type { App, VNode } from 'vue';

import { createApp, h, nextTick } from 'vue';

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

let icons: typeof import('../index');
let app: App | undefined;
const fetch = vi.fn().mockRejectedValue(new Error('Network is unavailable'));

beforeAll(async () => {
  vi.stubGlobal('fetch', fetch);
  icons = await import('../index');
});

afterEach(() => {
  app?.unmount();
  app = undefined;
  document.body.replaceChildren();
});

afterAll(() => vi.unstubAllGlobals());

async function mount(render: () => VNode) {
  const container = document.createElement('div');
  document.body.append(container);
  app = createApp({ render });
  app.mount(container);
  await nextTick();
  return container;
}

describe('offline menu icons', () => {
  it('renders backend-provided Lucide names with no network access', async () => {
    const names = [
      'bell-ring',
      'download',
      'folders',
      'sliders-horizontal',
      'smartphone',
      'star',
      'tags',
      'toggle-left',
      'users',
      'wrench',
    ];
    const container = await mount(() =>
      h(
        'div',
        names.map((name) => h(icons.IconifyIcon, { icon: `lucide:${name}` })),
      ),
    );

    expect(container.querySelectorAll('svg')).toHaveLength(names.length);
    for (const svg of container.querySelectorAll('svg')) {
      expect(svg.childElementCount).toBeGreaterThan(0);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('also renders icons created through the shared icon factory offline', async () => {
    const component = icons.createIconifyIcon('lucide:settings');
    const container = await mount(() => h(component));

    expect(container.querySelector('svg')?.childElementCount).toBeGreaterThan(
      0,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
