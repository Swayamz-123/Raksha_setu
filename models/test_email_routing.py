#!/usr/bin/env python3
"""
Test script to verify email routing and formatting
Run this to test email sending without running the full application
"""

import os
from dotenv import load_dotenv
from services.email_service import send_emergency_email

load_dotenv()

# Test data for different crisis types
test_cases = [
    {
        "name": "Medical Emergency Test",
        "recipient": "awaishehsan22@gmail.com",
        "data": {
            "name": "Test User",
            "emergencyMessage": "Intensity: 85: fallen: Person appears to have fallen and is unresponsive. Immediate medical attention required.",
            "crisisType": "medical",
            "intensity": 85,
            "flag": "fallen",
            "phone": "+91 9876543210",
            "emergencyPhone": "112",
            "address": "Test Location, Mumbai",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "mapsLink": "https://maps.google.com/?q=19.0760,72.8777",
            "modelUsed": "gemini"
        }
    },
    {
        "name": "Fire Emergency Test",
        "recipient": "awaishehsan077@gmail.com",
        "data": {
            "name": "Test User",
            "emergencyMessage": "Intensity: 95: fire detected: Visible flames and smoke detected in the area. Fire emergency response needed.",
            "crisisType": "fire",
            "intensity": 95,
            "flag": "fire detected",
            "phone": "+91 9876543210",
            "emergencyPhone": "101",
            "address": "Test Building, Delhi",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "mapsLink": "https://maps.google.com/?q=28.6139,77.2090",
            "modelUsed": "llava"
        }
    },
    {
        "name": "Other Emergency Test",
        "recipient": "awaishehsan86@gmail.com",
        "data": {
            "name": "Test User",
            "emergencyMessage": "Intensity: 70: potential danger: Suspicious activity detected. Person appears to be in distress.",
            "crisisType": "crime",
            "intensity": 70,
            "flag": "potential danger",
            "phone": "+91 9876543210",
            "emergencyPhone": "100",
            "address": "Test Area, Bangalore",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "mapsLink": "https://maps.google.com/?q=12.9716,77.5946",
            "modelUsed": "gemini"
        }
    }
]

def main():
    print("=" * 60)
    print("EMAIL ROUTING TEST")
    print("=" * 60)
    
    # Check if email credentials are configured
    if not os.getenv("EMAIL_USER") or not os.getenv("EMAIL_PASS"):
        print("\n❌ ERROR: Email credentials not configured!")
        print("Please set EMAIL_USER and EMAIL_PASS in models/.env file")
        return
    
    print(f"\n📧 Email configured: {os.getenv('EMAIL_USER')}")
    print("\nThis will send test emails to:")
    print("  - awaishehsan22@gmail.com (Medical)")
    print("  - awaishehsan077@gmail.com (Fire)")
    print("  - awaishehsan86@gmail.com (Other)")
    
    response = input("\nProceed with sending test emails? (yes/no): ")
    if response.lower() != "yes":
        print("Test cancelled.")
        return
    
    print("\n" + "=" * 60)
    
    for test in test_cases:
        print(f"\n🧪 Testing: {test['name']}")
        print(f"   Recipient: {test['recipient']}")
        print(f"   Crisis Type: {test['data']['crisisType']}")
        
        try:
            success = send_emergency_email(
                recipient_email=test['recipient'],
                emergency_data=test['data']
            )
            
            if success:
                print(f"   ✅ Email sent successfully!")
            else:
                print(f"   ❌ Email failed to send")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 60)
    print("Test completed! Check the recipient inboxes.")
    print("=" * 60)

if __name__ == "__main__":
    main()
