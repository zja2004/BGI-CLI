---
id: web-search
name: Web Search (网络搜索)
category: utility
short-description: Search the internet using DuckDuckGo API.
---

# Web Search

当用户需要搜索互联网、查找最新信息或核实事实时，直接用 bash 执行，无需询问是否搜索。

**规则**：搜索后整合总结再回复，不要粘贴原始 JSON；结果不理想时换关键词重试；中文问题优先中文关键词，专业术语用英文。

## 搜索（DuckDuckGo，无需 API Key）

```bash
python3 - <<'EOF'
import urllib.request, urllib.parse, json
query = "YOUR_QUERY_HERE"
url = "https://api.duckduckgo.com/?q=" + urllib.parse.quote(query) + "&format=json&no_html=1&skip_disambig=1"
with urllib.request.urlopen(url, timeout=10) as r:
    d = json.loads(r.read())
if d.get("AbstractText"): print("摘要:", d["AbstractText"], "\n来源:", d.get("AbstractURL",""))
for t in d.get("RelatedTopics", [])[:6]:
    if isinstance(t, dict) and t.get("Text"): print("•", t["Text"])
EOF
```

## 获取网页内容

```bash
python3 - <<'EOF'
import urllib.request, re
url = "https://TARGET_URL_HERE"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=15) as r:
    html = r.read().decode("utf-8", errors="ignore")
text = re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style)[^>]*>[\s\S]*?</\1>", "", html, flags=re.I))
print(re.sub(r"\s{3,}", "\n\n", text)[:4000])
EOF
```
