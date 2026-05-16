
const fs = require('fs');
const content = fs.readFileSync('products.html', 'utf8');

const tags = content.match(/<[a-zA-Z1-6]+|><\/[a-zA-Z1-6]+>|<\/[a-zA-Z1-6]+>/g);
let stack = [];
let lines = content.split('\n');

function getLine(offset) {
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        count += lines[i].length + 1;
        if (count > offset) return i + 1;
    }
    return lines.length;
}

// Simple tag balancer
const openTags = content.matchAll(/<([a-zA-Z1-6-]+)(\s[^>]*)?>/g);
const closeTags = content.matchAll(/<\/([a-zA-Z1-6-]+)>/g);

let allTags = [];
for (const match of openTags) {
    if (match[0].endsWith('/>')) continue; // self closing
    allTags.push({ type: 'open', name: match[1], index: match.index, line: getLine(match.index) });
}
for (const match of closeTags) {
    allTags.push({ type: 'close', name: match[1], index: match.index, line: getLine(match.index) });
}

allTags.sort((a, b) => a.index - b.index);

let activeStack = [];
for (const tag of allTags) {
    if (tag.type === 'open') {
        if (['img', 'input', 'br', 'hr', 'link', 'meta'].includes(tag.name)) continue;
        activeStack.push(tag);
    } else {
        if (activeStack.length === 0) {
            // console.log(`Error: Unexpected closing tag </${tag.name}> at line ${tag.line}`);
        } else {
            const last = activeStack.pop();
            if (last.name !== tag.name) {
                // console.log(`Error: Mismatched tag. Opened <${last.name}> at line ${last.line}, closed with </${tag.name}> at line ${tag.line}`);
            }
        }
    }
}

if (activeStack.length > 0) {
    activeStack.forEach(t => // console.log(`Error: Unclosed tag <${t.name}> at line ${t.line}`)
    );
}
