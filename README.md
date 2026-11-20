# 🌀 GYRO MAZE 300

> **A 2-minute, 300-player simultaneous marble race where players tilt their phones' gyroscopes to steer through a giant maze with chaotic Red Hole teleporters.**

Designed for large events, conferences, parties, all-hands meetings, and live streams. One central big screen displays the entire maze and all 300 balls in real time, while every player uses their phone as a physical gyroscope controller over Wi-Fi.

---

## 🎮 The 2-Minute Game Arc

Every race lasts exactly **120 seconds**:

1. **The Starting Grid**: All 300 balls spawn in the bottom-left launchpad (`LAUNCH`).
2. **The Race (0:00 – 2:00)**:
   - Players tilt their phones in their hands to steer their marble through branching neon corridors.
   - A live 0–100% progress indicator on the phone shows real-time distance to the finish line.
3. **The 8 Red Holes (Vortex Hazards)**:
   - Scattered throughout the maze are 8 swirling crimson teleporters.
   - If a ball rolls onto a Red Hole, it is instantly sucked in and **teleported to a random different Red Hole** across the map!
   - The player's phone vibrates with haptic feedback and plays a cosmic warp sound.
4. **The Golden Finish Portal**:
   - The first player to navigate the maze and cross the golden portal in the top-right wins **1st Place**!
   - 2nd, 3rd, 4th, etc., continue crossing the line until the 2-minute buzzer sounds.
5. **The Podium**: Confetti explosions, podium rankings (1st, 2nd, 3rd), and the **"Void Traveler Award"** for whoever fell into the most Red Holes!

---

## 📱 Mobile Gyroscope Controller (`/play`)

- **Instant Join**: Pick a callsign and ball color.
- **Physical Gyro Steering**: Tilting your phone left/right/forward/backward physically accelerates your ball in the maze.
- **Level Compass & Bubble**: Live visual bubble level that mirrors your phone's tilt angle.
- **One-Tap Re-Calibration**: Tap `RE-CALIBRATE` at any time to set your current phone position as flat/neutral.
- **Touchpad Fallback**: A toggle button allows players without gyroscope sensors (or on laptops) to steer using a smooth touch dragpad.
- **Haptic Alerts**: Vibrates when sucked into a Red Hole or crossing the finish line.

---

## 🚀 Quickstart Guide (1-Command Start & Stop)

### 1. Start the Demo (Launches Game Server + HTTPS Tunnel)
```bash
./start.sh
```
This automatically:
- Starts the game server on port 8000.
- Launches the Cloudflare HTTPS tunnel for instant mobile phone access.
- Prints the exact URLs and updates the on-screen QR code!

### 2. Stop the Demo (Clean Shutdown)
```bash
./stop.sh
```
This immediately terminates the Python server and the Cloudflare tunnel, leaving port 8000 clean.

---

## 🌐 Joining on the Same Wi-Fi Network

1. Connect your phone to the **same Wi-Fi network** as your computer.
2. Open the Host Display on your computer: [http://localhost:8000/](http://localhost:8000/).
3. A large QR code and URL (e.g. `http://192.168.201.26:8000/play`) will appear on screen.
4. Open the camera app on your phone and tap the banner to join immediately!

> **Note on iOS Gyroscope Permission**: When joining on iPhone/iPad Safari, tap the big **"ENABLE GYRO & JOIN"** button and select **"Allow"** when prompted to enable tilt motion sensors. If denied, the on-screen touch controller automatically activates.

---

## 🤖 Simulating 300 Racers (Solo & Demo Mode)

You can demo and stress-test the full 300-player marble race without needing 300 phones:

1. **From the Host Screen**:
   - In the lobby or race view, click **`🤖 Bots`** (or press `B`).
   - Select **`+50 Bots`**, **`+150 Bots`**, or **`+300 Full Swarm`**.
   - Press **`SPACEBAR`** to watch 300 marbles race, bounce, and warp through the maze!

2. **From the Terminal (CLI Stress Test)**:
   ```bash
   python3 test_bots.py 300
   ```
