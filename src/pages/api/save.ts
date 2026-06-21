import type { APIRoute } from "astro";
import * as cheerio from "cheerio";

// Handle the preflight CORS request from the Chrome Extension
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*", // Allows your extension to connect
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Extension-Request"
    }
  });
};

export const POST: APIRoute = async (context) => {
  const request = context.request;
  
  // Access your Cloudflare D1 Database (Requires @astrojs/cloudflare adapter)
  const env = context.locals.runtime?.env;

  try {
    const data = await request.json();
    const { pin, keyword, mainSearchHtml } = data;

    // 1. Load the raw HTML sent by the extension into Cheerio
    const $ = cheerio.load(mainSearchHtml);

    // 2. Extract Organic Links
    let organicUrls: string[] = [];
    $('h3').each((i, el) => {
      let href = $(el).closest('a').attr('href');
      if (href && href.startsWith('http') && !href.includes('google.com')) {
        organicUrls.push(href);
      }
    });

    // 3. Extract AI Overview Data
    let aiOverviewBox = $('#Odp5De, .Kevs9, [data-initial-sections]').first();
    let sourceLinks: string[] = [];

    if (aiOverviewBox.length > 0) {
      // Remove noise tags securely on the server
      aiOverviewBox.find('script, style, svg, noscript, button, [role="button"]').remove();
      
      aiOverviewBox.find('a').each((i, el) => {
         let href = $(el).attr('href');
         if (href && href.startsWith("http")) sourceLinks.push(href);
      });
    }

    // 4. Save to your D1 Database (if configured in your Astro Cloudflare project)
    if (env && env.DB) {
      await env.DB.prepare(
        "INSERT INTO search_tracking (user_pin, timestamp, keyword, source_links, organic_links) VALUES (?, ?, ?, ?, ?)"
      ).bind(pin, Date.now(), keyword, JSON.stringify([...new Set(sourceLinks)]), JSON.stringify([...new Set(organicUrls)])).run();
    }

    // 5. Generate the random delay exactly as the extension used to (15 to 45 seconds)
    const randomDelaySeconds = Math.floor(Math.random() * (45 - 15 + 1)) + 15;

    return new Response(JSON.stringify({ 
        success: true, 
        nextSearchDelaySeconds: randomDelaySeconds 
    }), { 
        status: 200, 
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, X-Extension-Request"
        } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }
    });
  }
};