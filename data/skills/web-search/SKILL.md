---
id: web-search
name: Web Search (网络搜索)
category: utility
short-description: Search the internet using DuckDuckGo API and curl/Python for any query.
---

# Web Search 网络搜索

当用户需要搜索互联网、查找最新信息、核实事实、或查询非文献数据库内容时，使用以下方法通过 bash 工具执行网络搜索。

## 规则
- 直接搜索，不要事先询问"是否需要搜索"
- 搜索到内容后，整合总结后再回复，不要直接粘贴原始 JSON
- 如果首次搜索结果不理想，换关键词重试一次
- 中文问题优先用中文关键词；专业术语用英文效果更好

## 方法一：DuckDuckGo Instant Answer（无需 API Key，适合快速摘要）

```bash
python3 - <<'EOF'
import urllib.request, urllib.parse, json, sys

query = "YOUR_QUERY_HERE"
url = "https://api.duckduckgo.com/?q=" + urllib.parse.quote(query) + "&format=json&no_html=1&skip_disambig=1"
try:
    with urllib.request.urlopen(url, timeout=10) as r:
        d = json.loads(r.read())
    if d.get("AbstractText"):
        print("摘要:", d["AbstractText"])
        print("来源:", d.get("AbstractURL", ""))
    topics = [t for t in d.get("RelatedTopics", []) if isinstance(t, dict) and t.get("Text")]
    for t in topics[:6]:
        print("•", t["Text"])
        if t.get("FirstURL"):
            print(" ", t["FirstURL"])
except Exception as e:
    print("搜索失败:", e, file=sys.stderr)
EOF
```

## 方法二：获取并解析具体网页内容

```bash
python3 - <<'EOF'
import urllib.request, re, sys

url = "https://TARGET_URL_HERE"
try:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        html = r.read().decode("utf-8", errors="ignore")
    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", html, flags=re.I)
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s{3,}", "\n\n", text)
    print(text[:4000])
except Exception as e:
    print("获取失败:", e, file=sys.stderr)
EOF
```

## 方法三：curl 快速搜索

```bash
curl -sA "Mozilla/5.0" "https://api.duckduckgo.com/?q=QUERY&format=json&no_html=1" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(d.get('AbstractText',''))
[print('•',t['Text']) for t in d.get('RelatedTopics',[])[:5] if isinstance(t,dict) and t.get('Text')]
"
```
