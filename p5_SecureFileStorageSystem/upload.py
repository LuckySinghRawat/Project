import requests

file_path = r"C:\Users\arjun\Desktop\Arjun Singh Kunwar 32 I2\a.exe"

files = {'file': open(file_path, 'rb')}
try:
    response = requests.post('http://localhost:5000/upload', files=files)
    print('Status Code:', response.status_code)
    print('Response JSON:', response.json())
except Exception as e:
    print('Error:', e)
