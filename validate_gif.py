"""Validate that header.gif is a real GIF file."""
import os
import sys

path = r"D:\lqq\github\QQQuan2\assets\header.gif"

with open(path, "rb") as f:
    h = f.read(6)

is_valid = h in (b"GIF89a", b"GIF87a")
size = os.path.getsize(path)

print(f"  File:      {path}")
print(f"  Header:    {h}")
print(f"  Valid GIF: {'YES' if is_valid else 'NO'}")
print(f"  Size:      {size:,} bytes ({size/1024:.1f} KB)")

if not is_valid:
    print("[FAIL] Not a valid GIF file!")
    sys.exit(1)

print("[PASS] GIF is valid.")