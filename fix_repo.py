with open('backend/src/modules/triagem-pa/TriagemPaClinicoRepository.js', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.strip() == '}' and 'module.exports' not in line and len(new_lines) > 20 and not any('class TriagemPaClinicoRepository' in l for l in lines[lines.index(line)+1:]):
        # find the last closing brace before the appended methods
        pass
# Actually, it's easier to just recreate the file properly.
