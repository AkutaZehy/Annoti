// 阻止在 Windows release 版本中显示额外的控制台窗口
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    annoti_lib::run()
}
