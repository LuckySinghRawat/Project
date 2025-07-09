import sqlite3
import hashlib

def register_user(username, password, role):
    conn = sqlite3.connect("users.db")
    hashed = hashlib.sha256(password.encode()).hexdigest()
    try:
        conn.execute("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", (username, hashed, role))
        conn.commit()
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()
    return True

def login_user(username, password):
    conn = sqlite3.connect("users.db")
    hashed = hashlib.sha256(password.encode()).hexdigest()
    cur = conn.cursor()
    cur.execute("SELECT role FROM users WHERE username=? AND password=?", (username, hashed))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

def get_all_users():
    """Retrieve all users from the database (excluding passwords)"""
    conn = sqlite3.connect("users.db")
    cur = conn.cursor()
    cur.execute("SELECT id, username, role FROM users ORDER BY username")
    users = cur.fetchall()
    conn.close()
    return [{'id': user[0], 'username': user[1], 'role': user[2]} for user in users]

def update_user_role(username, new_role):
    """Update a user's role"""
    conn = sqlite3.connect("users.db")
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET role = ? WHERE username = ?", (new_role, username))
        success = cur.rowcount > 0
        conn.commit()
    except Exception:
        success = False
    finally:
        conn.close()
    return success

def delete_user(username):
    """Delete a user from the database"""
    conn = sqlite3.connect("users.db")
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE username = ?", (username,))
        success = cur.rowcount > 0
        conn.commit()
    except Exception:
        success = False
    finally:
        conn.close()
    return success