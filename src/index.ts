import puppeteer from '@cloudflare/puppeteer'
import sanitize from 'sanitize-filename'
import { nanoid } from 'nanoid'

export interface Env {
  bucketUrl: string
  mybrowser: any
  puppeteer: R2Bucket
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { searchParams } = new URL(request.url)
    let url = searchParams.get('url')
    let img: Buffer
    let thumbnail: Buffer
    if (url) {
      const browser = await puppeteer.launch(env.mybrowser)
      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 960 })
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
      try {
        const response = await page.goto(url)
        if (response.status() !== 200) {
          await browser.close()
          return new Response(JSON.stringify({ error: 'Failed to load the page, got a ' + response.status() + ' response.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      }
      catch (error) {
        await browser.close()
        return new Response(JSON.stringify({ error: 'Failed to load the page, got a ' + error + ' response.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      
      await page.waitForFunction('document.readyState === "complete"')
      img = (await page.screenshot({ fullPage: true, type: 'jpeg', quality: 80 })) as Buffer
      const title = sanitize(await page.title(), { replacement: '-' }).replace(/\s+/g, '-')
      const id = nanoid(5)

      const titleString = `${title}_${id}.jpg`
      thumbnail = (await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 960 }, type: 'jpeg', quality: 80 })) as Buffer
      const thumbnailTitle = `thumbnail_${title}_${id}.jpg`

      await browser.close()
      await env.puppeteer.put(titleString, img)
      await env.puppeteer.put(thumbnailTitle, thumbnail)
      return new Response(JSON.stringify({ full: `${env.bucketUrl}/${titleString}`, thumbnail: `${env.bucketUrl}/${thumbnailTitle}` }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      return new Response(JSON.stringify({ error: 'Please add the ?url=https://example.com/ parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}
