import tkinter as tk
from tkinter import messagebox
import pyperclip
from _1_passwordGenerator import generate_password
from _2_encryptionManager import generate_key, load_key, encrypt_message, decrypt_message

def save_password():
    User = User_entry.get()
    password = password_entry.get()
    encrypted_password = encrypt_message(password)

    # Check if the User already exists
    if is_User_exists(User):
        messagebox.showerror("Error", "User already exists!")
        return

    with open("passwords.txt", "a") as file:
        file.write(f"{User} | {encrypted_password.decode()}\n")
    
    User_entry.delete(0, tk.END)
    password_entry.delete(0, tk.END)
    messagebox.showinfo("Success", "Password saved successfully!")

def generate__password():
    password = generate_password()
    password_entry.delete(0, tk.END)
    password_entry.insert(0, password)
    pyperclip.copy(password)


def show_password():
    User = User_entry.get()
    
    with open("passwords.txt", "r") as file:
        for line in file:
            stored_User, encrypted_password = line.strip().split(" | ")
            if stored_User == User:
                decrypted_password = decrypt_message(encrypted_password.encode())
                messagebox.showinfo("Password", f"Password for {User}:-> '{decrypted_password}'")
                return
    messagebox.showerror("Error", "Password not found for the given User.")

def is_User_exists(User):
    with open("passwords.txt", "r") as file:
        for line in file:
            stored_User, _ = line.strip().split(" | ")
            if stored_User == User:
                return True
    return False

# Generate key if not present
try:
    load_key()
except FileNotFoundError:
    generate_key()

# Set up the user interface
app = tk.Tk()
app.title("Password Manager")

tk.Label(app, text="User").grid(row=1,column=2)
tk.Label(app, text="Password").grid(row=2,column=2)

User_entry = tk.Entry(app)
password_entry = tk.Entry(app)

User_entry.grid(row=1, column=3)
password_entry.grid(row=2, column=3)

generate_btn = tk.Button(app, text="Generate Password", command=generate__password)
generate_btn.grid(row=4, column=2)

save_btn = tk.Button(app, text="Save Password", command=save_password)
save_btn.grid(row=3, column=3)

show_btn = tk.Button(app, text="Show Password", command=show_password)
show_btn.grid(row=4, column=4)

done_btn = tk.Button(app, text = "  done  " , command = exit)
done_btn.grid(row=5,column=3)
app.mainloop()
 