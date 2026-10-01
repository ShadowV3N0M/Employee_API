"""
Standalone sanity check for password hashing.
Run with: python test_hashing.py
Does not touch the database or the running API.
"""

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

test_password = "mypassword123"

hashed = pwd_context.hash(test_password)
print(f"Plaintext:      {test_password}")
print(f"Hashed:         {hashed}")
print(f"Hash length:    {len(hashed)} (should be 60)")
print(f"Starts with:    {hashed[:4]} (should be $2b$ or similar)")

correct_check = pwd_context.verify(test_password, hashed)
wrong_check = pwd_context.verify("wrongpassword", hashed)

print(f"\nVerify correct password: {correct_check} (should be True)")
print(f"Verify wrong password:   {wrong_check} (should be False)")
