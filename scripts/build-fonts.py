#!/usr/bin/env python3
"""Subset the two faces the site ships, from the characters that actually render.

    node build.js && .venv/bin/python scripts/build-fonts.py

Source .woff files live in ~/.cache/ljw-fonts/, outside the served tree — the
full Noto Serif SC is ~8MB per weight and must not ship. Fetch them once with
(older UA, so Google returns one unsplit woff instead of 120 unicode-ranges):

    UA="Mozilla/5.0 (X11; Linux i686) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/6.0.472.63 Safari/537.36"
    curl -A "$UA" "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400&display=swap"
    curl -A "$UA" "https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400&display=swap"
    # then curl the .woff URLs the CSS lists into ~/.cache/ljw-fonts/

Output is assets/fonts/*.woff2. Noto Serif SC ends up ~36KB (the ~190 CJK
characters that appear in display type), Josefin Sans ~3.4KB each. Body copy
uses the system sans stack and ships nothing.

One serif weight only: the reference site builds its hierarchy from size,
colour and tracking rather than bold, which suits Chinese display type better
than a synthesised heavy Songti.
"""
import glob
import html.parser
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.expanduser("~"), ".cache", "ljw-fonts")
OUT = os.path.join(ROOT, "assets", "fonts")

# Class names whose text is drawn in the serif face.
SERIF_CLASSES = {
    "brand-cn",
    "page-title",
    "lede-title",
    "entry-name",
    "cell-title",
    "work-title",
    "work-caption",
    "statement",
    "contact-mail",
    "foot-name",
}
# Latin, digits and symbols: labels, dates, dimensions, the email address.
LATIN = re.compile(r"[\w .,;:!?'\"()\[\]/@#&%+\-–—×·—…“”‘’《》〈〉【】（）]|\d")
CJK = re.compile(r"[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef\u00b7\u00d7]")


VOID = {"img", "br", "hr", "input", "meta", "link", "source"}


class SerifText(html.parser.HTMLParser):
    """Collect text nodes that sit inside an element with a serif class."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.chars = set()

    def handle_starttag(self, tag, attrs):
        classes = {c for k, v in attrs if k == "class" for c in v.split()}
        if tag in VOID:
            return
        if classes & SERIF_CLASSES or self.depth:
            self.depth += 1

    def handle_endtag(self, tag):
        if self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.chars.update(c for c in data if CJK.match(c) or c.isalnum() or LATIN.match(c))


def collect():
    parser = SerifText()
    for path in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
        parser.feed(open(path, encoding="utf8").read())
    # The email and the name appear in the footer/contact markup too.
    parser.chars.update("刘静文THEA（）liubai@gmail.com ·©©0123456789")
    return sorted(c for c in parser.chars if not c.isspace() or c == " ")


FACES = [
    ("notoserifsc-400", "nserif400.woff"),
    ("josefinsans-300", "josefin300.woff"),
    ("josefinsans-400", "josefin400.woff"),
]


def main():
    chars = collect()
    if len(chars) < 40:
        sys.exit("too few characters collected — run `node build.js` first")

    os.makedirs(OUT, exist_ok=True)
    text_file = "/tmp/ljw-serif-chars.txt"
    with open(text_file, "w", encoding="utf8") as fh:
        fh.write("".join(chars))

    cjk = sum(1 for c in chars if CJK.match(c))
    print(f"{len(chars)} characters ({cjk} CJK) to cover")
    for name, src_file in FACES:
        src = os.path.join(SRC, src_file)
        if not os.path.exists(src):
            print(f"  ! missing source {src_file}, skipped")
            continue
        out = os.path.join(OUT, f"{name}.woff2")
        subprocess.run(
            [
                sys.executable,
                "-m",
                "fontTools.subset",
                src,
                f"--text-file={text_file}",
                "--flavor=woff2",
                f"--output-file={out}",
                "--layout-features=kern",
                "--no-hinting",
                "--desubroutinize",
                "--drop-tables+=DSIG",
            ],
            check=True,
        )
        print(f"  {name + '.woff2':26s} {os.path.getsize(out) / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
