import requests

filename = 'a.exe'

url = f'http://localhost:5000/download/{filename}'
resp = requests.get(url)

if resp.status_code == 200:
    
    with open(filename, 'wb') as f:
        f.write(resp.content)
    print(f'Success! Downloaded {filename}')
else:
    print('Error:', resp.status_code, resp.json())
