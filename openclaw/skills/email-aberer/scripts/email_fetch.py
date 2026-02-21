#!/usr/bin/env python3
import argparse
import email
import imaplib
import json
import os
from email.header import decode_header
from typing import List, Dict


def decode(value):
    if isinstance(value, bytes):
        try:
            return value.decode()
        except Exception:
            return value.decode("utf-8", errors="ignore")
    if isinstance(value, str):
        return value
    return str(value)


def parse_message(raw_msg: bytes) -> Dict:
    msg = email.message_from_bytes(raw_msg)
    headers = {}
    for key in ("From", "To", "Subject", "Date"):
        value = msg.get(key, "")
        parts = decode_header(value)
        headers[key.lower()] = " ".join(
            decode(text) for text, _ in parts if text is not None
        )
    snippet = ""
    for part in msg.walk():
        if part.get_content_type() == "text/plain" and not part.get_filename():
            try:
                snippet = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="ignore")
            except Exception:
                snippet = part.get_payload()
            snippet = snippet.strip().replace("\r", " ").replace("\n", " ")
            snippet = snippet[:300]
            break
    return {
        **headers,
        "snippet": snippet
    }


def search_query(query: str, unread: bool) -> str:
    search_terms: List[str] = []
    if unread:
        search_terms.append("UNSEEN")
    if query:
        search_terms.append(f'TEXT "{query}"')
    if not search_terms:
        return "ALL"
    return " ".join(search_terms)


def main():
    parser = argparse.ArgumentParser(description="Fetch messages from Aberer IMAP")
    parser.add_argument("--limit", type=int, default=10, help="Number of messages to return")
    parser.add_argument("--unread", action="store_true", help="Only unread messages")
    parser.add_argument("--search", default="", help="IMAP TEXT search query")
    parser.add_argument("--save", help="Directory to save raw messages")
    args = parser.parse_args()

    host = os.environ["IMAP_HOST"]
    user = os.environ["IMAP_USER"]
    passwd = os.environ["IMAP_PASS"]

    with imaplib.IMAP4_SSL(host) as client:
        client.login(user, passwd)
        client.select("INBOX")
        status, data = client.search(None, search_query(args.search, args.unread))
        if status != "OK":
            raise SystemExit(f"Search failed: {status} {data}")
        ids = data[0].split()
        ids = ids[-args.limit:]
        messages = []
        os.makedirs(args.save, exist_ok=True) if args.save else None
        for msg_id in reversed(ids):
            status, payload = client.fetch(msg_id, "(RFC822)")
            if status != "OK":
                continue
            raw = payload[0][1]
            entry = parse_message(raw)
            entry["id"] = msg_id.decode()
            messages.append(entry)
            if args.save:
                path = os.path.join(args.save, f"{entry['id']}.eml")
                with open(path, "wb") as fh:
                    fh.write(raw)
        json.dump({"messages": messages}, fp=os.sys.stdout, indent=2)


if __name__ == "__main__":
    main()
