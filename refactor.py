import os
import re

with open('src/app.js', 'r') as f:
    content = f.read()

# Remove the IIFE wrapper
content = re.sub(r'^\(function\(\) \{\n\s*\'use strict\';\n', '', content)
content = re.sub(r'\n\}\)\(\);\s*$', '', content)

sections = {}
current_section = "Main"
lines = content.split('\n')
for line in lines:
    m = re.match(r'^\s*// ── (.*?) ─+', line)
    if m:
        current_section = m.group(1).strip()
        if current_section not in sections:
            sections[current_section] = []
    if current_section not in sections:
        sections[current_section] = []
    sections[current_section].append(line)

for k, v in sections.items():
    sections[k] = '\n'.join(v)

# Let's see all sections found
print("Sections found:", list(sections.keys()))
