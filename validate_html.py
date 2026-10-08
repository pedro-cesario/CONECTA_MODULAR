from html.parser import HTMLParser
class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.void_elements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']
        self.errors = []
    def handle_starttag(self, tag, attrs):
        if tag not in self.void_elements:
            self.tags.append((tag, self.getpos()))
    def handle_endtag(self, tag):
        if tag in self.void_elements: return
        if not self.tags:
            self.errors.append(f"Line {self.getpos()[0]}: Unexpected closing tag </{tag}>")
            return
        last_tag, pos = self.tags.pop()
        if last_tag != tag:
            self.errors.append(f"Line {self.getpos()[0]}: Expected </{last_tag}> from line {pos[0]}, but found </{tag}>")
            # Try to recover by popping until we find a match
            while self.tags:
                last_tag, pos = self.tags.pop()
                if last_tag == tag: break

parser = MyHTMLParser()
with open('frontend/index.html', 'r') as f:
    parser.feed(f.read())
if parser.errors:
    for e in parser.errors: print(e)
    exit(1)
if parser.tags:
    print(f"Unclosed tags: {parser.tags}")
    exit(1)
print("HTML is balanced!")
