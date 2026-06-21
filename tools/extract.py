import re, json, pathlib, glob
out = pathlib.Path("app/assets/data"); out.mkdir(parents=True, exist_ok=True)
fence = chr(96) * 3  # ``` without writing literal backticks
pat = re.compile(fence + r"json\s*(.*?)" + fence, re.S)
tot = 0
for f in sorted(glob.glob("research/c-*.md")):
    txt = pathlib.Path(f).read_text(encoding="utf-8", errors="replace")
    blocks = pat.findall(txt)
    name = pathlib.Path(f).stem
    if not blocks:
        print(f"{name}: NO json block"); continue
    raw = blocks[-1].strip()
    try:
        data = json.loads(raw); ok = "OK"
    except Exception as e:
        data = None; ok = f"PARSE-ERR: {e}"
    if data is not None:
        (out / (name + ".json")).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        counts = {k: (len(v) if isinstance(v, list) else 1) for k, v in data.items()}
        print(f"{name}: {ok}  counts={counts}")
        tot += 1
    else:
        (out / (name + ".RAW.txt")).write_text(raw, encoding="utf-8")
        print(f"{name}: {ok}  (raw saved, {len(raw)} bytes)")
print(f"parsed OK: {tot}/6")
