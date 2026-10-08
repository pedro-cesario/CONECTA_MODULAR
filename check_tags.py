from html.parser import HTMLParser
class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
    def handle_starttag(self, tag, attrs):
        if tag in ['div', 'section', 'main', 'header', 'footer']:
            self.stack.append((tag, self.getpos()[0]))
    def handle_endtag(self, tag):
        if tag in ['div', 'section', 'main', 'header', 'footer']:
            if not self.stack:
                print(f"Extra </{tag}> at line {self.getpos()[0]}")
                return
            idx = -1
            for i in range(len(self.stack)-1, -1, -1):
                if self.stack[i][0] == tag:
                    idx = i
                    break
            if idx != -1:
                self.stack.pop(idx)
            else:
                print(f"Extra </{tag}> at line {self.getpos()[0]}")
parser = MyHTMLParser()
with open('frontend/index.html', 'r') as f:
    parser.feed(f.read())
if parser.stack:
    for s in parser.stack:
        print(f"Unclosed <{s[0]}> from line {s[1]}")
else:
    print("HTML balanced")
