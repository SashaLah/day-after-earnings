import requests
import os

# Retrieve Claude API key from environment variable
API_KEY = os.getenv('Claude_API_KEY')
URL = 'https://api.anthropic.com/v1/complete'

headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY
}

def get_claude_response(prompt, max_tokens=300):
    data = {
        'prompt': prompt,
        'max_tokens_to_sample': max_tokens,
        'stop_sequences': ['\n\n']
    }
    response = requests.post(URL, headers=headers, json=data)
    if response.status_code == 200:
        return response.json().get('completion', '').strip()
    else:
        print("Error:", response.status_code, response.text)
        return None
