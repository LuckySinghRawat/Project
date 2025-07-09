from crypto import generate_keys, KEY_SIZE, HMAC_KEY_SIZE
import os

# This script generates a new AES and HMAC key and saves them to keys.txt
# The keys are stored consecutively without any separators.

aes_key, hmac_key = generate_keys()

with open('keys.txt', 'wb') as f:
    f.write(aes_key)
    f.write(hmac_key)

print(f"Generated new {KEY_SIZE}-byte AES key and {HMAC_KEY_SIZE}-byte HMAC key in keys.txt") 