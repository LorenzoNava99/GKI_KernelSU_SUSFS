import json, pathlib
d = pathlib.Path("app/assets/data")
def load(n): return json.loads((d / n).read_text(encoding="utf-8"))
asia = load("c-asia.json"); afme = load("c-africa-me.json"); arch = load("c-archaeology.json")
ling = load("c-linguistics.json"); myth = load("c-myths.json"); stat = load("c-stats.json")

REGION = {"c-asia":"Asia","c-africa-me":"Africa & Middle East","c-archaeology":"Archaeology",
          "c-linguistics":"Language","c-myths":"Myths"}

content = {"entries": [], "terms": ling.get("terms", []), "myths": myth.get("myths", []),
           "extracts": myth.get("extracts", []), "facts": [], "charts": stat.get("charts", []),
           "bignums": stat.get("bignums", []), "gallery": []}

for src, key in [(asia,"Asia"),(afme,"Africa & Middle East"),(arch,"Archaeology"),
                 (ling,"Language"),(myth,"Myths")]:
    for e in src.get("entries", []):
        e.setdefault("region", key); content["entries"].append(e)
    for fct in src.get("facts", []):
        content["facts"].append({"text": fct, "region": key} if isinstance(fct, str) else fct)
    for g in src.get("gallery", []):
        g.setdefault("region", key); content["gallery"].append(g)

pathlib.Path("app/assets/data/content.json").write_text(
    json.dumps(content, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

print("MERGED counts:", {k: len(v) for k, v in content.items()})
def keys(x): return list(x.keys()) if isinstance(x, dict) else x
print("\nentry[0] keys:", keys(content["entries"][0]))
print("entry sample:", json.dumps(content["entries"][0], ensure_ascii=False)[:300])
print("\ngallery[0]:", json.dumps(content["gallery"][0], ensure_ascii=False)[:300])
print("\nchart[0] keys:", keys(content["charts"][0]), "| data[0]:", content["charts"][0].get("data",[{}])[0])
print("term[0]:", json.dumps(content["terms"][0], ensure_ascii=False)[:200])
print("myth[0] keys:", keys(content["myths"][0]))
print("extract[0]:", json.dumps(content["extracts"][0], ensure_ascii=False)[:250])
print("bignum[0]:", json.dumps(content["bignums"][0], ensure_ascii=False)[:200])
print("\ncontent.json bytes:", pathlib.Path("app/assets/data/content.json").stat().st_size)
