#!/usr/bin/env python3
import argparse
import os
import smtplib
from email.message import EmailMessage


def main():
    parser = argparse.ArgumentParser(description="Send email via Aberer SMTP")
    parser.add_argument("--to", required=True, help="Recipient address")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--body", help="Plaintext body")
    parser.add_argument("--html-body", help="Path to HTML body file")
    parser.add_argument("--cc", help="Comma-separated CC list")
    parser.add_argument("--bcc", help="Comma-separated BCC list")
    parser.add_argument("--from", dest="sender", default=os.environ.get("SMTP_USER"))
    args = parser.parse_args()

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    passwd = os.environ["SMTP_PASS"]

    msg = EmailMessage()
    msg["From"] = args.sender
    msg["To"] = args.to
    if args.cc:
        msg["Cc"] = args.cc
    if args.subject:
        msg["Subject"] = args.subject
    if args.body:
        msg.set_content(args.body)
    else:
        msg.set_content("")
    if args.html_body:
        with open(args.html_body, "r", encoding="utf-8") as fh:
            msg.add_alternative(fh.read(), subtype="html")

    recipients = [addr.strip() for addr in args.to.split(",")]
    if args.cc:
        recipients.extend(addr.strip() for addr in args.cc.split(","))
    if args.bcc:
        recipients.extend(addr.strip() for addr in args.bcc.split(","))

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, passwd)
        server.send_message(msg, from_addr=args.sender, to_addrs=recipients)


if __name__ == "__main__":
    main()
