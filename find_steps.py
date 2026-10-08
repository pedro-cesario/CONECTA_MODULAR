import json

log_path = '/home/sdk1/.gemini/antigravity-cli/brain/206ac7cc-4cbf-426a-9cc5-e8a464c5c12e/.system_generated/logs/transcript_full.jsonl'

with open(log_path, 'r') as f:
    for line in f:
        data = json.loads(line)
        content = data.get('content', '')
        if 'const STEPS =' in content and 'export function setupTriagemClinico()' in content:
            print("FOUND IN STEP:", data.get('step_index'))
