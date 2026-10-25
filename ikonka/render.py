# SVG → PNG (640 для аватарки бота, 180 и 32 — проверка читаемости в маленьком круге)
import asyncio, pathlib
from playwright.async_api import async_playwright
d=pathlib.Path(__file__).resolve().parent
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(channel='chrome',headless=True)
    for s,r in ((640,0),(180,0)):
      h=d/f'_t{s}.html'; h.write_text(f'<body style="margin:0;background:transparent"><img style="display:block;border-radius:{r}%" src="ikonka.svg" width={s} height={s}></body>')
      pg=await b.new_page(viewport={'width':s,'height':s})
      await pg.goto(h.as_uri()); await pg.wait_for_timeout(500)
      await pg.screenshot(path=str(d/f'ikonka_{s}.png'),omit_background=True,timeout=120000); h.unlink()
    await b.close()
asyncio.run(main())
