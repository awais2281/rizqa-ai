/**
 * Whisper Server Configuration
 * 
 * Update this file with your server URL before building the app.
 * 
 * For local development:
 * - Android Emulator: use http://10.0.2.2:8000
 * - iOS Simulator: use http://localhost:8000
 * - Physical device: use http://YOUR_LOCAL_IP:8000 (find with ipconfig/ifconfig)
 * 
 * For production:
 * - Use your deployed server URL (e.g., https://your-app.railway.app)
 */

export const WHISPER_SERVER_CONFIG = {
  // Change this to your server URL
  // Examples:
  // Local: 'http://localhost:8000' (for iOS Simulator)
  // Local: 'http://10.0.2.2:8000' (for Android Emulator)
  // Local: 'http://192.168.1.100:8000' (for physical device - replace with your IP)
  // Production: 'https://your-app.railway.app'
  // Always use Railway production server
  baseUrl: 'https://rizqa-ai-production.up.railway.app',
  
  timeout: 60000, // 60 seconds timeout
};


