// UI 设置：主题、侧栏宽度、作者名。
// 持久化走平台层（Wails 写 settings.json 的 ui 块，Mock 写 localStorage），
// 保存做 300ms 防抖。

import { computed, ref, watch } from "vue";
import { getPlatform } from "@/platform";
import type { UISettings } from "@/types";

const DEFAULTS: UISettings = {
  theme: "light",
  sidebarWidth: 30,
  authorName: "Me",
  lastPath: "",
};

const settings = ref<UISettings>({ ...DEFAULTS });
const loaded = ref(false);

function applyTheme(theme: UISettings["theme"]) {
  const el = document.documentElement;
  el.classList.remove("light-theme", "dark-theme");
  el.classList.add(theme === "dark" ? "dark-theme" : "light-theme");
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await getPlatform().setUI(JSON.stringify(settings.value));
    } catch (e) {
      console.error("保存 UI 设置失败:", e);
    }
  }, 300);
}

export function useSettings() {
  async function init() {
    if (loaded.value) return;
    try {
      const raw = await getPlatform().getUI();
      const parsed = raw ? (JSON.parse(raw) as Partial<UISettings>) : {};
      settings.value = { ...DEFAULTS, ...parsed };
    } catch (e) {
      console.warn("读取 UI 设置失败，使用默认值:", e);
      settings.value = { ...DEFAULTS };
    }
    applyTheme(settings.value.theme);
    loaded.value = true;
  }

  watch(settings, (value) => {
    if (!loaded.value) return;
    applyTheme(value.theme);
    scheduleSave();
  }, { deep: true });

  const isDark = computed(() => settings.value.theme === "dark");

  function toggleTheme() {
    settings.value.theme = settings.value.theme === "dark" ? "light" : "dark";
  }

  return { settings, isDark, toggleTheme, init };
}
