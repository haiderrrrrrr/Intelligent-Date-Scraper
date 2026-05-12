import asyncio
import re
import json
import requests
from flask import Flask, jsonify, request, render_template
from bs4 import BeautifulSoup
import dateparser
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.options import Options
import aiohttp

app = Flask(__name__)

def get_selenium_page_source(url):
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    driver.get(url)
    page_source = driver.page_source
    driver.quit()
    
    return page_source

async def fetch_html(url):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                return await response.text()
    except Exception as e:
        return str(e)

def extract_dates_with_context(text):
    date_matches = []
    
    date_regex = r'\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|' \
                 r'\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{2,4}|' \
                 r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{2,4}|' \
                 r'\d{4}-\d{2}-\d{2}|' \
                 r'\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4})\b'
    
    matches = re.finditer(date_regex, text)

    for match in matches:
        parsed_date = dateparser.parse(match.group(0))
        if parsed_date:
            context_start = max(0, match.start() - 30)
            context_end = min(len(text), match.end() + 30)
            context = text[context_start:context_end].strip()
            date_matches.append({"date": match.group(0), "context": context})

    return date_matches

def extract_meta_dates(soup):
    meta_dates = []

    meta_tags = soup.find_all("meta")
    for tag in meta_tags:
        for attr in ["content", "date", "publishdate", "article:published_time"]:
            if tag.get(attr):
                parsed_date = dateparser.parse(tag[attr])
                if parsed_date:
                    meta_dates.append({"date": tag[attr], "context": "Found in Meta Tag"})

    scripts = soup.find_all("script", type="application/ld+json")
    for script in scripts:
        try:
            data = json.loads(script.string)
            if isinstance(data, dict) and "datePublished" in data:
                parsed_date = dateparser.parse(data["datePublished"])
                if parsed_date:
                    meta_dates.append({"date": data["datePublished"], "context": "Found in JSON-LD"})
        except json.JSONDecodeError:
            continue

    return meta_dates

@app.route('/scrape', methods=['GET'])
def scrape():
    url = request.args.get('url')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    try:
        if "dynamic" in request.args:
            html_content = get_selenium_page_source(url)
        else:
            html_content = asyncio.run(fetch_html(url))

        soup = BeautifulSoup(html_content, 'html.parser')

        text_dates = extract_dates_with_context(soup.get_text()[:50000])
        meta_dates = extract_meta_dates(soup)

        all_dates = text_dates + meta_dates

        if not all_dates:
            return jsonify({'message': 'No dates found on the page!'}), 404

        return jsonify({'dates': all_dates})

    except Exception as e:
        return jsonify({'error': f'Error: {str(e)}'}), 500

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
