# Step 64: Tauri Desktop

> **Checkpoint:** CP12 - Mobile/Desktop
> **Previous Step:** 63-EXPO-MOBILE.md
> **Next Step:** END (Implementation Complete)
> **Architecture Reference:** `ARCHITECTURE.md` - Desktop Application

---

## Overview

**Tauri Desktop** wraps the React web application in a native desktop shell using Tauri 2.0, providing native OS integrations for macOS, Windows, and Linux.

---

## Deliverables

1. `apps/desktop/` - Tauri application
2. `apps/desktop/src-tauri/` - Rust backend
3. `apps/desktop/src-tauri/src/` - Native integrations
4. `apps/desktop/src-tauri/tauri.conf.json` - Configuration

---

## 1. Tauri Configuration

```json
// apps/desktop/src-tauri/tauri.conf.json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/v2/packages/cli/schema.json",
  "productName": "Aigentflow",
  "version": "0.1.0",
  "identifier": "io.aigentflow.desktop",
  "build": {
    "beforeBuildCommand": "pnpm --filter @aigentflow/web build",
    "beforeDevCommand": "pnpm --filter @aigentflow/web dev",
    "frontendDist": "../web/dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Aigentflow",
        "width": 1280,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    },
    "trayIcon": {
      "iconPath": "icons/icon.png",
      "iconAsTemplate": true
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "macOS": {
      "minimumSystemVersion": "10.15"
    },
    "windows": {
      "wix": {
        "language": "en-US"
      }
    }
  }
}
```

---

## 2. Rust Backend

```rust
// apps/desktop/src-tauri/src/main.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem,
};

mod commands;

fn main() {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show", "Show Window"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::open_file_dialog,
            commands::save_file,
            commands::show_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 3. Native Commands

```rust
// apps/desktop/src-tauri/src/commands.rs

use serde::{Deserialize, Serialize};
use tauri::api::dialog;
use tauri::api::notification::Notification;

#[derive(Debug, Serialize)]
pub struct SystemInfo {
    os: String,
    arch: String,
    version: String,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
pub async fn open_file_dialog() -> Option<String> {
    dialog::blocking::FileDialogBuilder::new()
        .add_filter("All Files", &["*"])
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

#[derive(Debug, Deserialize)]
pub struct SaveFileArgs {
    path: String,
    content: String,
}

#[tauri::command]
pub async fn save_file(args: SaveFileArgs) -> Result<(), String> {
    std::fs::write(&args.path, &args.content)
        .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct NotificationArgs {
    title: String,
    body: String,
}

#[tauri::command]
pub fn show_notification(app: tauri::AppHandle, args: NotificationArgs) -> Result<(), String> {
    Notification::new(&app.config().identifier)
        .title(&args.title)
        .body(&args.body)
        .show()
        .map_err(|e| e.to_string())
}
```

---

## 4. TypeScript Bindings

```typescript
// apps/desktop/src/lib/tauri.ts

import { invoke } from '@tauri-apps/api/core';

export interface SystemInfo {
  os: string;
  arch: string;
  version: string;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke('get_system_info');
}

export async function openFileDialog(): Promise<string | null> {
  return invoke('open_file_dialog');
}

export async function saveFile(path: string, content: string): Promise<void> {
  return invoke('save_file', { args: { path, content } });
}

export async function showNotification(title: string, body: string): Promise<void> {
  return invoke('show_notification', { args: { title, body } });
}
```

---

## 5. Build Scripts

```json
// apps/desktop/package.json
{
  "name": "@aigentflow/desktop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "build:mac": "tauri build --target universal-apple-darwin",
    "build:win": "tauri build --target x86_64-pc-windows-msvc",
    "build:linux": "tauri build --target x86_64-unknown-linux-gnu"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

---

## Validation Checklist

```
□ Tauri Desktop (Step 64)
  □ macOS build works
  □ Windows build works
  □ Linux build works
  □ System tray icon works
  □ Native dialogs work
  □ Notifications work
  □ Auto-update works
  □ Code signing configured
  □ Tests pass
```

---

## Implementation Complete

Congratulations! You have completed the full Aigentflow implementation plan covering:

- **CP0**: Foundation (Monorepo, PostgreSQL, LangGraph, NestJS, CLI)
- **CP1**: Agent System (LangGraph agents, self-review, orchestrator)
- **CP2**: Design System (UI Designer, design tokens, early web UI)
- **CP3**: Git Worktrees (Feature isolation)
- **CP4**: Build & Test (Developer and testing agents)
- **CP5**: Messaging (NATS, BullMQ, WebSockets)
- **CP6**: Integration (CI/CD, releases)
- **CP7**: Self-Evolution (Pattern detection, agent generation)
- **CP8**: Enterprise (Compliance, security)
- **CP9**: Platform Infrastructure (Multi-tenant, feature flags)
- **CP10**: Web Frontend (React dashboard)
- **CP11**: Infrastructure (OpenTofu, K3s, Hetzner)
- **CP12**: Mobile/Desktop (Expo, Tauri)

---

## References

- `00-OVERVIEW.md` - Full implementation plan
- `CHECKPOINTS.md` - Validation criteria
- `ARCHITECTURE.md` - Technical architecture
