How to run now

From anywhere in PowerShell:



**powershell :**

npm run start:live --prefix "D:\\Downloads\\Openclaw Mission Board\\openclaw-dashboard"

Or if already in openclaw-dashboard:



**powershell :**

npm run start:live



If you already have a backend running in another terminal, stop it first (to avoid port 8787 conflict).

---

Run custom standalone (separate ports, can run in parallel):

**powershell :**

npm run start:standalone --prefix "D:\\Downloads\\Openclaw Mission Board\\openclaw-custom"

Custom app defaults:
- Frontend: http://localhost:3100
- Backend: http://localhost:8797

