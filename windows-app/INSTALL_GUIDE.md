# 🖨️ Print Infinity Agent — Shopkeeper Setup Guide

Welcome to **Print Infinity**! This guide is written in plain, everyday language to get your store counter PC set up in under 3 minutes.

---

## 🚀 3-Step Quick Install

### Step 1: Download & Open the Folder
1. Download the `PrintInfinity-Agent-Windows.zip` file (or open the `windows-app` folder on your shop PC).
2. If it is in a ZIP file, right-click it and select **Extract All...**.

### Step 2: Run the 1-Click Installer
1. Inside the folder, locate **`Install-PrintInfinityAgent.bat`** (or `Install-PrintInfinityAgent`).
2. Double-click it.
   > **Note**: If Windows shows a blue *"Windows protected your PC"* screen, click **More info** and then click **Run anyway**.
3. A black setup window will appear, copy the necessary files, and create a shortcut on your Desktop named **Print Infinity Agent**.
4. The app will open automatically!

### Step 3: Sign In Once
1. Enter your shop email and password (provided by your store admin).
2. Click **Sign In to Store**.
3. That’s it! Your login is saved permanently and securely using Windows Credential Locker.

---

## ⚡ Always-On Background Mode (System Tray)

- **Automatic Startup**: You never have to manually open the app when you turn on your PC in the morning. The installer configures the app to **start automatically in the background** whenever Windows boots.
- **Minimized to Tray**: When you minimize or close the window, the app stays running silently in your Windows System Tray (the small arrow icon next to the clock in the bottom-right corner of your screen).
- **Instant Alerts**: When a customer sends a print order, your PC will play a chime and display a popup toast notification in the corner of your screen.
- **Open Any Time**: Double-click the Print Infinity icon in the system tray (or on your Desktop) whenever you want to view the queue or printer settings.

---

## 🏷️ Setting Up Your Printers

1. After signing in, click the **Printer Setup** tab on the left sidebar.
2. The app will automatically detect all printers connected to this computer (via USB or WiFi).
3. For each printer:
   - If it prints in color, toggle it to **Color**.
   - If it only prints in black and white, toggle it to **Black & White**.
4. Click **Save Configuration**.
5. When a customer sends a job, the agent will automatically route it to the correct printer!

---

## ❓ Frequently Asked Questions & Troubleshooting

### What if my PC loses internet?
The app will display an amber banner saying *"Reconnecting to live queue..."*. As soon as your internet returns, the app will automatically reconnect and fetch any orders placed while offline. No orders are lost!

### What if my printer runs out of paper or is turned off?
The app will show a notification: *"Printer Offline or Out of Paper"*. Simply load paper or turn the printer back on, then click **Retry Print** in the app.

### How do I uninstall or move to another PC?
Open your file explorer to `%LocalAppData%\Programs\PrintInfinityAgent` and double-click **`Uninstall.bat`**. It will cleanly remove all shortcuts and startup entries.
