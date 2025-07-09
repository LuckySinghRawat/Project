from auth import register_user
from models import init_db

# Initialize the database and create the users table
init_db()

# Register users
register_user("arjun", "pass123", "Admin")
register_user("lucky", "pass123", "Viewer")
register_user("negi", "pass123", "User")
register_user("priyanshi", "pass123", "Admin")

print("Users registered successfully.")
