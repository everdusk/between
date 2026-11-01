import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyLaunchTheme, LAUNCH_THEME_SCRIPT, SPLASH_COVER_CSS } from "./launch-theme";

function root() {
  const props = new Map<string, string>();
  return {
    props,
    node: {
      dataset: {} as { telegramTheme?: string },
      style: {
        setProperty(name: string, value: string) {
          props.set(name, value);
        },
      },
    },
  };
}

describe("launch theme", () => {
  it("paints the custom background before the stylesheet can show the default palette", () => {
    const { props, node } = root();
    const hash = `#${new URLSearchParams({
      tgWebAppThemeParams: JSON.stringify({
        bg_color: "#241430",
        text_color: "#f4eef8",
        secondary_bg_color: "#3a2450",
        button_color: "#c9a24d",
        button_text_color: "#1a1020",
      }),
    }).toString()}`;
    assert.equal(applyLaunchTheme(hash, node), true);
    assert.equal(node.dataset.telegramTheme, "dark");
    assert.equal(props.get("--background"), "#241430");
    assert.equal(props.get("--foreground"), "#f4eef8");
    assert.equal(props.get("--card"), "#3a2450");
    assert.equal(props.get("--primary"), "#c9a24d");
  });

  it("ignores a launch url without a theme", () => {
    const { props, node } = root();
    assert.equal(applyLaunchTheme("", node), false);
    assert.equal(applyLaunchTheme("#tgWebAppData=user%3D1", node), false);
    assert.equal(props.size, 0);
  });

  it("keeps the journal hidden until the frame leaves", () => {
    assert.match(SPLASH_COVER_CSS, /html\[data-splash\] \.app-root \{ display: none !important; \}/);
    assert.match(LAUNCH_THEME_SCRIPT, /tgWebAppThemeParams/);
    assert.doesNotMatch(LAUNCH_THEME_SCRIPT, /color-scheme/);
  });
});
