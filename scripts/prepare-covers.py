"""Generate display-sized covers; original pictures and game files stay intact.

Run with Pillow after adding catalog games. Generated WebP files are committed,
so production builds need no Python or image-processing dependency.
"""
import argparse, hashlib, io, json
from pathlib import Path
from PIL import Image, ImageOps

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--catalog',type=Path,default=root/'public/catalog.json')
parser.add_argument('--output',type=Path,default=root/'public')
args=parser.parse_args()
catalog=json.loads(args.catalog.read_text(encoding='utf-8'))
folder=args.output/'artwork/thumbnails';folder.mkdir(parents=True,exist_ok=True)
before=after=0
for game in catalog['games']:
 original=game.get('originalCover',game['cover'])
 if not original.startswith('/') or original.endswith('.svg'):continue
 source=(root/'public'/original.lstrip('/')).resolve()
 assert source.is_relative_to(root/'public')
 with Image.open(source) as image:
  image.seek(0);image=ImageOps.exif_transpose(image).convert('RGBA')
  image.thumbnail((320,320),Image.Resampling.LANCZOS)
  buffer=io.BytesIO();image.save(buffer,format='WEBP',quality=82,method=6)
 data=buffer.getvalue();name=f"game-{game['id']}-{hashlib.sha256(data).hexdigest()[:16]}.webp"
 (folder/name).write_bytes(data)
 game['originalCover']=original;game['cover']='/artwork/thumbnails/'+name
 before+=source.stat().st_size;after+=len(data)
args.catalog.write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps({'originalCoverBytes':before,'displayCoverBytes':after,'reductionPercent':round((1-after/before)*100,1)}))
