"""
Keep-Alive Ping Script for Whisper Server
Sends periodic health check requests to prevent cold starts during active hours.

This script is designed to be run via GitHub Actions scheduled workflow.
It pings the /health endpoint every 45 minutes during active hours (6 AM - 11 PM UK time).
"""

import requests
import os
import sys
from datetime import datetime
import pytz

# Server URL - should be set as environment variable or GitHub secret
SERVER_URL = os.getenv("WHISPER_SERVER_URL", "https://rizqa-ai-production.up.railway.app")
TIMEOUT = 10  # 10 second timeout for health check

def is_active_hours():
    """
    Check if current time is within active hours (6 AM - 11 PM UK time).
    Returns True if within active hours, False otherwise.
    """
    # UK timezone (handles GMT/BST automatically)
    uk_tz = pytz.timezone('Europe/London')
    now_uk = datetime.now(uk_tz)
    current_hour = now_uk.hour
    
    # Active hours: 6 AM (06:00) to 11 PM (23:00)
    return 6 <= current_hour < 23

def ping_health_endpoint():
    """
    Send a GET request to the /health endpoint.
    Returns True if successful, False otherwise.
    """
    try:
        health_url = f"{SERVER_URL}/health"
        print(f"[{datetime.now().isoformat()}] Pinging {health_url}...")
        
        response = requests.get(health_url, timeout=TIMEOUT)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health check successful: {data.get('status', 'unknown')}")
            print(f"  Model loaded: {data.get('model_loaded', False)}")
            print(f"  Device: {data.get('device', 'unknown')}")
            return True
        else:
            print(f"✗ Health check failed: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"✗ Health check timed out after {TIMEOUT} seconds")
        return False
    except requests.exceptions.ConnectionError:
        print(f"✗ Connection error: Could not reach server")
        return False
    except Exception as e:
        print(f"✗ Error during health check: {e}")
        return False

def main():
    """Main function to run keep-alive ping"""
    print("=" * 60)
    print("Whisper Server Keep-Alive Ping")
    print("=" * 60)
    
    # Check if we're in active hours
    uk_tz = pytz.timezone('Europe/London')
    now_uk = datetime.now(uk_tz)
    print(f"Current UK time: {now_uk.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    
    if not is_active_hours():
        print("⚠ Outside active hours (6 AM - 11 PM UK time). Skipping ping.")
        print("This is expected behavior - keep-alive only runs during active hours.")
        sys.exit(0)
    
    print(f"✓ Within active hours. Sending health check ping...")
    print(f"Server URL: {SERVER_URL}")
    
    success = ping_health_endpoint()
    
    if success:
        print("\n✓ Keep-alive ping completed successfully")
        sys.exit(0)
    else:
        print("\n✗ Keep-alive ping failed")
        # Don't fail the workflow - server might be starting up
        # Just log the failure
        sys.exit(0)

if __name__ == "__main__":
    main()

