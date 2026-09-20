#!/usr/bin/env python3
"""Extract portable light SVG previews from delivered Archify HTML files.

This is a static document transformation. It uses only Python's standard
library: no browser, HTML script execution, network or diagram layout engine.
The authored SVG geometry and labels are copied verbatim. Only a background,
light-theme paint CSS, embedded licensed fonts and provenance are added.

Usage: python3 docs/diagrams/export-static.py [delivered-diagram.html ...]
With no arguments, export the four GoodCall maps beside this script.
Do not pass index pages or visual-check contact sheets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def export_preview(source: Path) -> dict:
    raw = source.read_bytes()
    html = raw.decode("utf-8")
    delivery_path = source.with_suffix(".delivery.json")
    if not delivery_path.exists():
        delivery_path = source.with_suffix(".receipt.json")
    delivery = json.loads(delivery_path.read_text())
    require(delivery.get("ok") is True, "Source has no successful delivery receipt")
    require(delivery["artifact"]["sha256"] == sha256(raw), "HTML differs from its delivery receipt")
    require(delivery["artifact"]["bytes"] == len(raw), "HTML byte count differs from delivery receipt")
    svgs = re.findall(r"<svg\b.*?</svg>", html, re.S)
    require(len(svgs) == 1, "Expected exactly one initial diagram SVG")
    svg = svgs[0]
    root = ET.fromstring(svg)
    require(not re.search(r"<(?:script|foreignObject)\b|\son\w+\s*=", svg, re.I), "SVG contains active content")
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] in {"image", "use"}:
            for key, value in element.attrib.items():
                if key.rsplit("}", 1)[-1] == "href":
                    require(value.startswith(("#", "data:")), "SVG requires an external asset")

    styles = re.findall(r"<style\b[^>]*>(.*?)</style>", html, re.S)
    font_styles = [s for s in styles if "@font-face" in s]
    require(len(font_styles) == 1, "Expected one self-contained font stylesheet")
    font_css = font_styles[0]
    require("SIL OPEN FONT LICENSE" in font_css, "Embedded font licence is missing")
    for url in re.findall(r"url\(\s*['\"]?([^)'\"]+)", font_css):
        require(url.startswith("data:"), "Font stylesheet requires an external asset")
    css = "\n".join(s for s in styles if s is not font_css)
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    font_css = "\n".join(line.rstrip() for line in font_css.splitlines())
    light = re.search(r'\[data-theme="light"\]\s*\{([^{}]*)\}', css)
    require(light is not None, "Standalone light-theme variable block is missing")
    variables = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", light.group(1)))
    body = re.search(r"(?:^|\})\s*body\s*\{([^{}]*)\}", css, re.S)
    family = re.search(r"font-family\s*:\s*([^;]+);", body.group(1) if body else "")
    require(family is not None, "Source font family is missing")
    classes = {name for names in re.findall(r'class="([^"]+)"', svg) for name in names.split()}
    selected_rules = []
    represented_classes = set()
    selector_pattern = re.compile(r"(?:svg\s+)?\.[\w-]+(?:\s+>\s+\*|\s+\.[\w-]+)?$")
    for selector_group, declarations in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        selected = []
        for selector in selector_group.split(","):
            selector = selector.strip()
            names = set(re.findall(r"\.([\w-]+)", selector))
            if selector_pattern.fullmatch(selector) and names and names <= classes:
                selected.append(selector)
                represented_classes |= names
        if selected:
            def replace_var(match: re.Match) -> str:
                key = match.group(1)
                require(key in variables, f"Unresolved light-theme variable: {key}")
                return variables[key]
            resolved = re.sub(r"var\((--[\w-]+)\)", replace_var, declarations)
            require("var(" not in resolved, "Unsupported CSS variable expression")
            selected_rules.append(f"{', '.join(selected)} {{{resolved}}}")
    require(classes <= represented_classes, f"Unresolved SVG classes: {sorted(classes - represented_classes)}")
    require("]]>" not in font_css, "Font stylesheet cannot be wrapped safely in CDATA")
    paint_css = "\n".join([
        f"svg {{font-family: {family.group(1)}; color: {variables['--text']};}}",
        *selected_rules,
    ])
    # Match the viewer's READ presentation for sequence previews. Fine notes
    # remain in the copied SVG and in the interactive source; the renderer's
    # default READ view shows calls and context without those annotations.
    detail_level = "read" if delivery.get("type") == "sequence" else "full"
    if detail_level == "read":
        require(
            '.diagram-container[data-detail-level="read"] svg [data-detail="fine"]' in css,
            "Source READ presentation rule is missing",
        )
        paint_css += '\nsvg [data-detail="fine"] {opacity: 0; pointer-events: none;}'
    require("]]>" not in paint_css, "Paint stylesheet cannot be wrapped safely in CDATA")
    viewbox = root.attrib.get("viewBox", "").split()
    require(len(viewbox) == 4, "Source SVG viewBox is missing")
    width, height = viewbox[2:]
    provenance = {
        "kind": "static-document-extraction",
        "source": source.name,
        "source_sha256": sha256(raw),
        "source_bytes": len(raw),
        "source_svg_sha256": sha256(svg.encode()),
        "source_delivery": delivery_path.name,
        "theme": "light",
        "reading_depth": detail_level,
        "geometry_and_labels": "copied verbatim from the initial delivered SVG",
        "browser_invoked": False,
        "html_scripts_executed": False,
        "network_used": False,
    }
    opening_end = svg.index(">")
    opening = svg[:opening_end]
    if not root.attrib.get("xmlns") and not root.tag.startswith("{"):
        opening += ' xmlns="http://www.w3.org/2000/svg"'
    opening += f' width="{width}" height="{height}" data-theme="light">'
    additions = (
        '\n<metadata id="static-preview-provenance"><![CDATA[' + json.dumps(provenance, sort_keys=True) + ']]></metadata>'
        '\n<style type="text/css"><![CDATA[' + font_css + '\n' + paint_css + ']]></style>'
        f'\n<rect data-static-preview-background="true" x="{viewbox[0]}" y="{viewbox[1]}" width="{width}" height="{height}" fill="{variables["--panel"]}"/>'
    )
    result = '<?xml version="1.0" encoding="UTF-8"?>\n' + opening + additions + svg[opening_end + 1:] + '\n'
    ET.fromstring(result)
    # Everything after the newly inserted metadata/styles/background is the
    # untouched original SVG body. No renderer geometry or label is rewritten.
    require(result.endswith(svg[opening_end + 1:] + '\n'), "Source SVG body changed")
    output = source.with_suffix(".preview.svg")
    output.write_text(result)
    return {"source": str(source), "output": str(output), "source_sha256": sha256(raw), "preview_sha256": sha256(result.encode()), "preview_bytes": len(result.encode()), "preserved_svg_classes": len(classes), "geometry_and_labels": "unchanged", "browser_invoked": False}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", nargs="*", type=Path)
    args = parser.parse_args()
    sources = args.html or [
        Path(__file__).resolve().parent / f"{name}.html"
        for name in ("system-overview", "workspace-detail", "review-drafting", "review-publication")
    ]
    for source in sources:
        print(json.dumps(export_preview(source), sort_keys=True))


if __name__ == "__main__":
    main()
