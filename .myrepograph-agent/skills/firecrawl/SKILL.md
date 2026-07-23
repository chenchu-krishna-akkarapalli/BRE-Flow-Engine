---
name: firecrawl
description: Teaches use of the Firecrawl CLI for reliable web scraping, recursive crawling, and browser interaction so live internet data can be pulled directly into local markdown files. Use this when the user wants to scrape a website, crawl multiple pages of a site, or pull external web content into local files for further processing, especially when simple fetches aren't reliable enough (JS-heavy pages, pagination, multi-page crawls).
---

# Firecrawl

Reliable web scraping and crawling via the Firecrawl CLI, producing clean local markdown output from live web content.

## When to use this

- Scraping a single page's content into clean markdown (especially JS-rendered pages where a plain fetch returns mostly empty markup).
- Recursively crawling a site (e.g. "grab all docs pages under /docs") rather than one URL at a time.
- Any task requiring browser-level interaction to reach the actual content (waiting for JS render, following redirects, handling pagination).

## Core commands

### Single-page scrape
```bash
firecrawl scrape <url> --output <path>.md
```
Renders the page (including JS-driven content) and converts it to clean markdown, saved locally.

### Recursive crawl
```bash
firecrawl crawl <base-url> --max-depth <n> --limit <n> --output-dir <dir>
```
Follows links from the base URL up to the given depth/page limit, saving each page as a separate markdown file in the output directory. Use `--include`/`--exclude` path patterns to scope the crawl to relevant sections (e.g. only `/docs/*`) rather than crawling an entire site indiscriminately.

### Structured extraction
When the goal is structured data rather than raw markdown, use Firecrawl's extraction mode with a schema/prompt describing the fields to pull (e.g. product name, price) so output comes back as structured JSON instead of freeform markdown.

## Workflow

1. Confirm the scope: single page vs. crawl, and if a crawl, how deep/how many pages — don't crawl an entire domain when only a subsection is needed.
2. Run the scrape/crawl, saving output to a working directory.
3. Verify a sample of the output actually captured the intended content (not just a loading skeleton or paywall/cookie-notice page).
4. Process the resulting markdown/JSON files for whatever the user's downstream task is (summarization, data extraction, import into another tool).

## Guardrails

- Respect `robots.txt` and site terms — don't crawl sites that explicitly disallow it, and don't attempt to bypass paywalls or authentication.
- Rate-limit crawls to avoid hammering a target site; use the tool's built-in delay/concurrency controls rather than maximizing speed.
- Don't scrape content behind login walls without the user's own authenticated access explicitly provided.
- Copyright still applies to scraped content — when using scraped text in a response, follow standard citation/paraphrase rules rather than reproducing large verbatim chunks.
