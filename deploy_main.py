import os
import subprocess
import sys
from pathlib import Path

def run_command(cmd, cwd=None):
    print(f"→ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    print(result.stdout or result.stderr)
    return result.returncode == 0

print("=== SNRV Alchemist Forex Bot Deploy ===")
repo_url = "https://github.com/humblewriter01/snrv-alchemist-forex-bot-v2.git"

print("Pulling latest...")
run_command("git pull")

print("Installing deps...")
run_command("pip install -r requirements.txt")

if not Path(".env").exists():
    print("Creating .env...")
    run_command("cp .env.example .env")
    print("\n⚠️ EDIT .env WITH YOUR KEYS!")

print("\n🚀 Starting Bot...")
os.chdir(".")
os.execv(sys.executable, [sys.executable, "main.py"])