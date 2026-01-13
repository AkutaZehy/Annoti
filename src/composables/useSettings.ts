import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { SettingsRecord, UserRecord } from '../types';

// 全局状态
const settings = ref<SettingsRecord | null>(null);
const currentUser = ref<UserRecord | null>(null);

/**
 * 初始化设置和用户
 */
export function useSettings() {
  /**
   * 初始化（应用启动时调用）
   */
  const init = async () => {
    try {
      // 初始化数据库
      await invoke('init_db');

      // 加载设置
      await loadSettings();

      // 获取当前用户
      await loadCurrentUser();
    } catch (e) {
      console.error('设置初始化失败:', e);
    }
  };

  /**
   * 加载设置
   */
  const loadSettings = async (): Promise<SettingsRecord> => {
    const json = await invoke<string>('load_settings');
    settings.value = JSON.parse(json) as SettingsRecord;
    return settings.value!;
  };

  /**
   * 保存设置
   */
  const saveSettings = async (newSettings: SettingsRecord): Promise<void> => {
    const json = JSON.stringify(newSettings, null, 2);
    await invoke('save_settings', { settingsJson: json });
    settings.value = newSettings;
  };

  /**
   * 打开设置目录
   */
  const openSettingsDir = async (): Promise<void> => {
    const path = await invoke<string>('get_settings_path');
    await invoke('open_path', { path });
  };

  /**
   * 加载当前用户
   */
  const loadCurrentUser = async (): Promise<UserRecord> => {
    const user = await invoke<UserRecord>('get_current_user');
    currentUser.value = user;
    return user;
  };

  /**
   * 更新用户名
   */
  const updateUserName = async (name: string): Promise<void> => {
    await invoke('update_user_name', { name });
    currentUser.value!.name = name;
    if (settings.value) {
      settings.value.user.name = name;
    }
  };

  /**
   * 生成随机用户名
   */
  const generateRandomName = async (): Promise<string> => {
    return await invoke<string>('generate_random_name');
  };

  /**
   * 重新生成用户名（用户点击按钮时）
   */
  const rerollUserName = async (): Promise<string> => {
    const newName = await generateRandomName();
    await updateUserName(newName);
    return newName;
  };

  /**
   * 获取默认高亮颜色
   */
  const getDefaultHighlightColor = (): string => {
    return settings.value?.editor.default_highlight_color || '#ffd700';
  };

  /**
   * 获取默认高亮类型
   */
  const getDefaultHighlightType = (): 'underline' | 'square' => {
    const type = settings.value?.editor.default_highlight_type || 'underline';
    return type as 'underline' | 'square';
  };

  /**
   * 获取当前语言
   */
  const getLanguage = (): string => {
    return settings.value?.i18n.language || 'zh-CN';
  };

  return {
    // 状态
    settings,
    currentUser,

    // 方法
    init,
    loadSettings,
    saveSettings,
    openSettingsDir,
    loadCurrentUser,
    updateUserName,
    generateRandomName,
    rerollUserName,
    getDefaultHighlightColor,
    getDefaultHighlightType,
    getLanguage
  };
}
