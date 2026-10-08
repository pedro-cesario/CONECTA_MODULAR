import json

log_path = '/home/sdk1/.gemini/antigravity-cli/brain/206ac7cc-4cbf-426a-9cc5-e8a464c5c12e/.system_generated/logs/transcript_full.jsonl'

with open(log_path, 'r') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = data.get('content', '')
            if 'renderPAPaciente' in content and 'function renderPAPaciente' in content:
                print("FOUND IN STEP:", data.get('step_index'))
                # Print a snippet of the tool_calls or output if it's a model step
                if 'tool_calls' in data:
                    print(json.dumps(data['tool_calls'], indent=2)[:500])
                elif 'output' in content:
                    pass
        except Exception:
            pass
