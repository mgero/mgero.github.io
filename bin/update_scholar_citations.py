#!/usr/bin/env python

import os
import re
import sys
import tempfile
import unicodedata
from datetime import datetime
from difflib import SequenceMatcher
from html import unescape
from zoneinfo import ZoneInfo

import yaml
from scholarly import scholarly


def load_scholar_user_id() -> str:
    """Load the Google Scholar user ID from the configuration file."""
    config_file = "_data/socials.yml"
    if not os.path.exists(config_file):
        print(f"Configuration file {config_file} not found.")
        sys.exit(1)
    try:
        with open(config_file, "r", encoding="utf-8") as config_stream:
            config = yaml.safe_load(config_stream)
        scholar_user_id = config.get("scholar_userid")
        if not scholar_user_id:
            print(f"No 'scholar_userid' found in {config_file}.")
            sys.exit(1)
        return scholar_user_id
    except yaml.YAMLError as error:
        print(f"Error parsing {config_file}: {error}")
        sys.exit(1)


SCHOLAR_USER_ID: str = load_scholar_user_id()
OUTPUT_FILE: str = "_data/citations.yml"
BIBLIOGRAPHY_FILE: str = "_bibliography/papers.bib"
CV_FILE: str = "_data/cv.yml"


def normalize_title(title: str) -> str:
    """Return a conservative comparison key for Scholar and BibTeX titles."""
    title = unescape(title or "")
    title = re.sub(r"\\[a-zA-Z]+\*?(?:\[[^]]*\])?", " ", title)
    title = re.sub(r"\\[\"'`^~=.]\s*\{?([A-Za-z])\}?", r"\1", title)
    title = title.replace("{", "").replace("}", "")
    title = unicodedata.normalize("NFKD", title)
    title = "".join(char for char in title if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def bib_entries(text: str) -> list[tuple[int, int, str]]:
    """Locate complete BibTeX entries while preserving their formatting."""
    entries = []
    for match in re.finditer(r"(?m)^@\w+\s*\{", text):
        start = match.start()
        opening_brace = text.find("{", start)
        depth = 0
        for index in range(opening_brace, len(text)):
            if text[index] == "{":
                depth += 1
            elif text[index] == "}":
                depth -= 1
                if depth == 0:
                    entries.append((start, index + 1, text[start : index + 1]))
                    break
    return entries


def bib_field(entry: str, field: str) -> str | None:
    """Read a braced field from one BibTeX entry."""
    match = re.search(rf"(?ms)^\s*{re.escape(field)}\s*=\s*\{{(.*?)\}},\s*$", entry)
    return match.group(1).strip() if match else None


def scholar_id_for_entry(
    entry: str, scholar_publications: list[dict], used_ids: set[str]
) -> str | None:
    """Match a BibTeX entry to one unambiguous Scholar record by title and year."""
    title = normalize_title(bib_field(entry, "title") or "")
    year = bib_field(entry, "year")
    if not title:
        return None

    candidates = []
    for publication in scholar_publications:
        publication_id = publication["id"]
        if publication_id in used_ids:
            continue
        scholar_year = publication.get("year")
        if year and scholar_year and year != str(scholar_year):
            continue
        score = SequenceMatcher(None, title, publication["normalized_title"]).ratio()
        if title == publication["normalized_title"]:
            score = 1.0
        candidates.append((score, publication_id))

    candidates.sort(reverse=True)
    if not candidates or candidates[0][0] < 0.94:
        return None
    if len(candidates) > 1 and candidates[0][0] - candidates[1][0] < 0.03:
        return None
    return candidates[0][1]


def atomic_write(path: str, content: str) -> None:
    """Replace a generated file only after its complete content is on disk."""
    directory = os.path.dirname(path) or "."
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=directory, delete=False
    ) as temporary_file:
        temporary_file.write(content)
        temporary_path = temporary_file.name
    os.replace(temporary_path, path)


def update_bibliography_ids(scholar_publications: list[dict]) -> int:
    """Add missing Scholar IDs without rewriting curated BibTeX metadata."""
    if not os.path.exists(BIBLIOGRAPHY_FILE):
        print(f"Warning: {BIBLIOGRAPHY_FILE} not found; skipping BibTeX matching.")
        return 0

    with open(BIBLIOGRAPHY_FILE, "r", encoding="utf-8") as bibliography:
        text = bibliography.read()

    entries = bib_entries(text)
    used_ids = {
        scholar_id
        for _, _, entry in entries
        if (scholar_id := bib_field(entry, "google_scholar_id"))
    }
    replacements = []
    for start, end, entry in entries:
        if bib_field(entry, "google_scholar_id"):
            continue
        scholar_id = scholar_id_for_entry(entry, scholar_publications, used_ids)
        if not scholar_id:
            continue
        closing_brace = entry.rfind("}")
        updated_entry = (
            entry[:closing_brace]
            + f"\tgoogle_scholar_id = {{{scholar_id}}},\n"
            + entry[closing_brace:]
        )
        replacements.append((start, end, updated_entry))
        used_ids.add(scholar_id)

    if not replacements:
        print("No new Google Scholar IDs could be matched safely.")
        return 0

    for start, end, replacement in reversed(replacements):
        text = text[:start] + replacement + text[end:]
    atomic_write(BIBLIOGRAPHY_FILE, text)
    print(f"Added Google Scholar IDs to {len(replacements)} BibTeX entries.")
    return len(replacements)


def update_cv_metrics(author_metrics: dict, today: datetime) -> bool:
    """Update the Scholar summary in the web and downloadable CV source."""
    if not os.path.exists(CV_FILE):
        print(f"Warning: {CV_FILE} not found; skipping the CV metrics summary.")
        return False

    with open(CV_FILE, "r", encoding="utf-8") as cv_stream:
        text = cv_stream.read()

    metric_line = re.compile(
        r'^(?P<indent>\s*)- bullet: "[^"]*Google Scholar citations '
        r'\(h-index \d+\)[^"]*Scopus citations \(h-index \d+\)\."$',
        re.MULTILINE,
    )
    current_line = metric_line.search(text)
    if not current_line:
        print(
            "Warning: the CV metrics summary was not found; leaving the CV unchanged."
        )
        return False

    date_label = f"{today.strftime('%B')} {today.day}, {today.year}"
    replacement = (
        f'{current_line.group("indent")}- bullet: "As of {date_label}: '
        f"{author_metrics['publications']} publications and "
        f"{author_metrics['citations']} Google Scholar citations "
        f"(h-index {author_metrics['h_index']}). As of May 2026: "
        '1025 Scopus citations (h-index 18)."'
    )
    updated_text = metric_line.sub(replacement, text, count=1)
    if updated_text == text:
        return False
    atomic_write(CV_FILE, updated_text)
    print(f"Updated the Google Scholar summary in {CV_FILE}.")
    return True


def get_scholar_citations() -> None:
    """Fetch citations, author metrics, and safely match bibliography entries."""
    print(f"Fetching citations for Google Scholar ID: {SCHOLAR_USER_ID}")
    now = datetime.now(ZoneInfo("Europe/Rome"))
    today = now.strftime("%Y-%m-%d")
    existing_data = {}

    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as citation_stream:
                existing_data = yaml.safe_load(citation_stream) or {}
            last_updated = existing_data.get("metadata", {}).get("last_updated")
            if last_updated:
                print(f"Last updated on: {last_updated}")
        except (OSError, yaml.YAMLError) as error:
            print(f"Warning: could not read {OUTPUT_FILE}: {error}")

    scholarly.set_timeout(15)
    scholarly.set_retries(3)
    try:
        author = scholarly.search_author_id(SCHOLAR_USER_ID)
        author_data = scholarly.fill(author)
    except Exception as error:
        print(f"Error fetching Google Scholar author data: {error}")
        sys.exit(1)

    publications = author_data.get("publications", []) if author_data else []
    if not publications:
        print("Google Scholar returned no publications; keeping the last valid data.")
        sys.exit(1)

    citation_data = {
        "metadata": {"last_updated": today},
        "author": {},
        "papers": {},
    }
    scholar_publications = []
    for publication in publications:
        try:
            publication_id = publication.get("pub_id") or publication.get(
                "author_pub_id"
            )
            if not publication_id:
                continue
            bibliography = publication.get("bib", {})
            title = bibliography.get("title", "Unknown Title")
            year = bibliography.get("pub_year", "Unknown Year")
            citations = publication.get("num_citations", 0)
            short_publication_id = publication_id.split(":", 1)[-1]

            citation_data["papers"][publication_id] = {
                "title": title,
                "year": year,
                "citations": citations,
            }
            scholar_publications.append(
                {
                    "id": short_publication_id,
                    "normalized_title": normalize_title(title),
                    "year": year,
                }
            )
            print(f"Found: {title} ({year}) - Citations: {citations}")
        except Exception as error:
            print(f"Warning: could not process one publication: {error}")

    previous_paper_count = len(existing_data.get("papers", {}))
    if (
        previous_paper_count
        and len(citation_data["papers"]) < previous_paper_count * 0.8
    ):
        print(
            "Google Scholar returned an unexpectedly incomplete publication list; "
            "keeping the last valid data."
        )
        sys.exit(1)

    citation_data["author"] = {
        "name": author_data.get("name", ""),
        "publications": len(citation_data["papers"]),
        "citations": author_data.get("citedby", 0),
        "h_index": author_data.get("hindex", 0),
    }

    update_bibliography_ids(scholar_publications)
    update_cv_metrics(citation_data["author"], now)

    if existing_data:
        unchanged_papers = existing_data.get("papers") == citation_data["papers"]
        unchanged_author = existing_data.get("author") == citation_data["author"]
        already_updated_today = (
            existing_data.get("metadata", {}).get("last_updated") == today
        )
        if unchanged_papers and unchanged_author and already_updated_today:
            print("No changes in Google Scholar metrics.")
            return

    try:
        output = yaml.safe_dump(
            citation_data, width=1000, sort_keys=True, allow_unicode=True
        )
        atomic_write(OUTPUT_FILE, output)
        print(f"Citation data saved to {OUTPUT_FILE}")
    except OSError as error:
        print(f"Error writing citation data: {error}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        get_scholar_citations()
    except Exception as error:
        print(f"Unexpected error: {error}")
        sys.exit(1)
