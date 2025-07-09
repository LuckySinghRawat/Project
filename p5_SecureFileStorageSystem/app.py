from flask import Flask, request, session, redirect, send_from_directory, render_template, url_for, send_file, flash, jsonify
import os
from auth import login_user, register_user, get_all_users, update_user_role, delete_user  # Updated imports
from crypto import encrypt_file, decrypt_file

UPLOAD_FOLDER = 'uploads'
ENCRYPTED_FOLDER = 'encrypted_files'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(ENCRYPTED_FOLDER, exist_ok=True)

app = Flask(__name__)
app.secret_key = 'super_secret_key'  # Required for sessions

@app.route('/')
def index():
    return render_template('login.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        role = login_user(username, password)
        if role:
            session['username'] = username
            session['role'] = role
            flash(f'Welcome back, {username}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Login Failed. Invalid username or password.', 'danger')
            return redirect(url_for('index'))
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        flash('Please log in to access the dashboard.', 'danger')
        return redirect(url_for('index'))
    return render_template('dashboard.html', username=session['username'], role=session['role'])

@app.route('/upload', methods=['POST'])
def upload():
    if 'username' not in session:
        flash('Please log in first.', 'danger')
        return redirect(url_for('index'))
    
    if session['role'] != 'Admin':
        flash('Only Admins can upload files.', 'danger')
        return redirect(url_for('dashboard'))
    
    if 'file' not in request.files:
        flash('No file selected.', 'danger')
        return redirect(url_for('dashboard'))
    
    file = request.files['file']
    if not file or not file.filename:
        flash('No file selected.', 'danger')
        return redirect(url_for('dashboard'))

    # Read keys from keys.txt
    with open('keys.txt', 'rb') as f:
        aes_key = f.read(32)
        hmac_key = f.read(32)

    file_data = file.read()
    encrypted_data = encrypt_file(file_data, aes_key, hmac_key)

    filepath = os.path.join(ENCRYPTED_FOLDER, file.filename + ".enc")
    with open(filepath, 'wb') as f:
        f.write(encrypted_data)

    flash('File uploaded and encrypted successfully!', 'success')
    return redirect(url_for('dashboard'))

@app.route('/files')
def files():
    if 'username' not in session:
        flash('Please log in to access files.', 'danger')
        return redirect(url_for('index'))
    
    files = os.listdir(ENCRYPTED_FOLDER)
    return render_template('files.html', files=files, role=session['role'])

@app.route('/download/<filename>')
def download(filename):
    if 'username' not in session:
        flash('Please log in to download files.', 'danger')
        return redirect(url_for('index'))
    
    if session['role'] == 'Viewer':
        flash('Viewers cannot download files.', 'danger')
        return redirect(url_for('files'))
    
    # Read keys from keys.txt
    with open('keys.txt', 'rb') as f:
        aes_key = f.read(32)
        hmac_key = f.read(32)

    filepath = os.path.join(ENCRYPTED_FOLDER, filename)
    if not os.path.exists(filepath):
        flash('File not found.', 'danger')
        return redirect(url_for('files'))
    
    with open(filepath, 'rb') as f:
        encrypted_data = f.read()

    try:
        decrypted_data = decrypt_file(encrypted_data, aes_key, hmac_key)
        
        # Writing decrypted data to a temporary file in memory
        from io import BytesIO
        return send_file(BytesIO(decrypted_data), as_attachment=True, download_name=filename.removesuffix('.enc'))
    except Exception as e:
        flash('Failed to decrypt file.', 'danger')
        return redirect(url_for('files'))

@app.route('/delete/<filename>', methods=['POST'])
def delete_file(filename):
    if 'username' not in session:
        flash('Please log in first.', 'danger')
        return redirect(url_for('index'))
    
    if session['role'] != 'Admin':
        flash('Only Admins can delete files.', 'danger')
        return redirect(url_for('files'))
    
    filepath = os.path.join(ENCRYPTED_FOLDER, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        flash(f'File "{filename}" has been deleted.', 'success')
    else:
        flash('File not found.', 'danger')
    
    return redirect(url_for('files'))

# New user management routes
@app.route('/users')
def user_management():
    if 'username' not in session:
        flash('Please log in to access user management.', 'danger')
        return redirect(url_for('index'))
    
    if session['role'] != 'Admin':
        flash('Only Admins can access user management.', 'danger')
        return redirect(url_for('dashboard'))
    
    users = get_all_users()
    return render_template('users.html', users=users, current_user=session['username'])

@app.route('/create_user', methods=['POST'])
def create_user():
    if 'username' not in session:
        flash('Please log in first.', 'danger')
        return redirect(url_for('index'))
    
    if session['role'] != 'Admin':
        flash('Only Admins can create users.', 'danger')
        return redirect(url_for('dashboard'))
    
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '').strip()
    role = request.form.get('role', '').strip()
    
    # Validation
    if not username or not password or not role:
        flash('All fields are required.', 'danger')
        return redirect(url_for('user_management'))
    
    if len(username) < 3:
        flash('Username must be at least 3 characters long.', 'danger')
        return redirect(url_for('user_management'))
    
    if len(password) < 6:
        flash('Password must be at least 6 characters long.', 'danger')
        return redirect(url_for('user_management'))
    
    if role not in ['Admin', 'User', 'Viewer']:
        flash('Invalid role selected.', 'danger')
        return redirect(url_for('user_management'))
    
    success = register_user(username, password, role)
    if success:
        flash(f'User "{username}" created successfully with role "{role}".', 'success')
    else:
        flash(f'Failed to create user "{username}". Username may already exist.', 'danger')
    
    return redirect(url_for('user_management'))

@app.route('/update_user_role', methods=['POST'])
def update_role():
    if 'username' not in session:
        flash('Please log in first.', 'danger')
        return redirect(url_for('index'))
    
    if session['role'] != 'Admin':
        flash('Only Admins can update user roles.', 'danger')
        return redirect(url_for('dashboard'))
    
    username = request.form.get('username', '').strip()
    new_role = request.form.get('role', '').strip()
    
    if not username or not new_role:
        flash('Username and role are required.', 'danger')
        return redirect(url_for('user_management'))
    
    if new_role not in ['Admin', 'User', 'Viewer']:
        flash('Invalid role selected.', 'danger')
        return redirect(url_for('user_management'))
    
    # Prevent admin from changing their own role
    if username == session['username']:
        flash('You cannot change your own role.', 'danger')
        return redirect(url_for('user_management'))
    
    success = update_user_role(username, new_role)
    if success:
        flash(f'User "{username}" role updated to "{new_role}".', 'success')
    else:
        flash(f'Failed to update role for user "{username}".', 'danger')
    
    return redirect(url_for('user_management'))

@app.route('/delete_user', methods=['POST'])
def delete_user_route():
    if 'username' not in session:
        flash('Please log in first.', 'danger')
        return redirect(url_for('index'))
    
    if session['role'] != 'Admin':
        flash('Only Admins can delete users.', 'danger')
        return redirect(url_for('dashboard'))
    
    username = request.form.get('username', '').strip()
    
    if not username:
        flash('Username is required.', 'danger')
        return redirect(url_for('user_management'))
    
    # Prevent admin from deleting themselves
    if username == session['username']:
        flash('You cannot delete your own account.', 'danger')
        return redirect(url_for('user_management'))
    
    success = delete_user(username)
    if success:
        flash(f'User "{username}" deleted successfully.', 'success')
    else:
        flash(f'Failed to delete user "{username}".', 'danger')
    
    return redirect(url_for('user_management'))

@app.route('/logout')
def logout():
    username = session.get('username', 'User')
    session.clear()
    flash(f'Goodbye {username}! You have been successfully logged out.', 'info')
    return redirect(url_for('index'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)